import "server-only";

export type VisualMetadata = {
  brand: string;
  itemType: string;
  category: string;
  condition: string;
  resalePrice: number;
  description: string;
  imagePath: string;
};

export type VisualMatch = VisualMetadata & {
  similarity: number;
};

export async function visualIndexExists() {
  return false;
}

export async function searchSimilarImages(
  _images: Array<{ buffer: Buffer; mimeType: string; view: string }>,
  _topK = 5,
): Promise<VisualMatch[]> {
  return [];
}
