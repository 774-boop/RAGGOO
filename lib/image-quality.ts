export type ImageQuality = {
  width: number;
  height: number;
  brightness: number;
  sharpness: number;
  issues: string[];
  acceptable: boolean;
};

export async function inspectImageQuality(file: File): Promise<ImageQuality> {
  const bitmap = await createImageBitmap(file);
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Image quality check is unavailable.");

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  let brightnessTotal = 0;

  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    const value =
      pixels[offset] * 0.299 +
      pixels[offset + 1] * 0.587 +
      pixels[offset + 2] * 0.114;
    gray[index] = value;
    brightnessTotal += value;
  }

  const edges: number[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      edges.push(
        Math.abs(
          gray[index - 1] +
            gray[index + 1] +
            gray[index - width] +
            gray[index + width] -
            4 * gray[index],
        ),
      );
    }
  }

  const brightness = brightnessTotal / gray.length;
  const sharpness =
    edges.reduce((total, value) => total + value, 0) / Math.max(edges.length, 1);
  const issues: string[] = [];
  if (originalWidth < 640 || originalHeight < 480) issues.push("Low resolution");
  if (brightness < 45) issues.push("Too dark");
  if (brightness > 225) issues.push("Overexposed");
  if (sharpness < 5) issues.push("Possibly blurry");

  return {
    width: originalWidth,
    height: originalHeight,
    brightness: Math.round(brightness),
    sharpness: Math.round(sharpness * 10) / 10,
    issues,
    acceptable: issues.length === 0,
  };
}
