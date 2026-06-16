import { mkdir } from "node:fs/promises";
import path from "node:path";
import PptxGenJS from "pptxgenjs";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { writeFile } from "node:fs/promises";

const outputDirectory = path.join(process.cwd(), "deliverables");
const colors = {
  ink: "20252F",
  muted: "6F7480",
  ivory: "F7F4EE",
  white: "FFFFFF",
  indigo: "6257D9",
  indigoLight: "ECEAFF",
  coral: "C9694F",
  line: "D9D6DF",
  green: "2F7D63",
};

const shapeType = new PptxGenJS().ShapeType;

const metrics = [
  ["Resale listings", "5,440"],
  ["Retail reference products", "19,919"],
  ["Condition labels discovered", "3,053"],
  ["Condition labels parsed", "3,052"],
  ["Text RAG documents", "2,138"],
  ["Visual images indexed", "4,413"],
];

function tableRows(rows: string[][]): PptxGenJS.TableRow[] {
  return rows.map((row) => row.map((text) => ({ text })));
}

const features = [
  "Text-based pricing and brand intelligence",
  "Gemini image identification and condition estimation",
  "OCR for brand, size, material, product code, and label text",
  "Local MiniLM text embeddings with FAISS retrieval",
  "Local CLIP visual embeddings and nearest-image search",
  "Multi-view warehouse capture with quality checks",
  "Human correction and feedback logging",
  "Responsive laptop and Android browser interface",
];

function slideTitle(slide: PptxGenJS.Slide, title: string, subtitle?: string) {
  slide.addText(title, {
    x: 0.7,
    y: 0.45,
    w: 11.9,
    h: 0.5,
    fontFace: "Aptos Display",
    fontSize: 25,
    bold: true,
    color: colors.ink,
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.72,
      y: 1.02,
      w: 11.3,
      h: 0.32,
      fontFace: "Aptos",
      fontSize: 10.5,
      color: colors.muted,
      margin: 0,
    });
  }
  slide.addShape(shapeType.line, {
    x: 0.7,
    y: 1.38,
    w: 11.9,
    h: 0,
    line: { color: colors.line, width: 1 },
  });
}

function addFooter(slide: PptxGenJS.Slide, number: number) {
  slide.addText("Resale Intelligence Assistant", {
    x: 0.72,
    y: 7.15,
    w: 3.2,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 7.5,
    color: "9296A0",
    margin: 0,
  });
  slide.addText(String(number), {
    x: 12.1,
    y: 7.12,
    w: 0.45,
    h: 0.2,
    align: "right",
    fontFace: "Aptos",
    fontSize: 8,
    color: "9296A0",
    margin: 0,
  });
}

function addBulletList(
  slide: PptxGenJS.Slide,
  items: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize = 16,
) {
  slide.addText(
    items.map((item) => ({
      text: item,
      options: { bullet: { indent: fontSize }, breakLine: true },
    })),
    {
      x,
      y,
      w,
      h,
      fontFace: "Aptos",
      fontSize,
      color: colors.ink,
      breakLine: false,
      paraSpaceAfter: 10,
      valign: "top",
      margin: 0.05,
    },
  );
}

function addCard(
  slide: PptxGenJS.Slide,
  title: string,
  body: string,
  x: number,
  y: number,
  w: number,
  h: number,
  accent = colors.indigo,
) {
  slide.addShape(shapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: colors.white },
    line: { color: colors.line, width: 1 },
    shadow: { type: "outer", color: "B9B5C4", blur: 1, angle: 45, offset: 1, opacity: 0.15 },
  });
  slide.addShape(shapeType.rect, {
    x,
    y,
    w: 0.06,
    h,
    fill: { color: accent },
    line: { color: accent },
  });
  slide.addText(title, {
    x: x + 0.25,
    y: y + 0.18,
    w: w - 0.45,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 13,
    bold: true,
    color: colors.ink,
    margin: 0,
  });
  slide.addText(body, {
    x: x + 0.25,
    y: y + 0.58,
    w: w - 0.45,
    h: h - 0.72,
    fontFace: "Aptos",
    fontSize: 10.5,
    color: colors.muted,
    valign: "top",
    margin: 0,
  });
}

function addFlow(
  slide: PptxGenJS.Slide,
  labels: string[],
  y: number,
  accent = colors.indigo,
) {
  const startX = 0.75;
  const gap = 0.18;
  const totalWidth = 11.85;
  const boxWidth = (totalWidth - gap * (labels.length - 1)) / labels.length;
  labels.forEach((label, index) => {
    const x = startX + index * (boxWidth + gap);
    slide.addShape(shapeType.roundRect, {
      x,
      y,
      w: boxWidth,
      h: 0.88,
      rectRadius: 0.06,
      fill: { color: index === labels.length - 1 ? colors.indigoLight : colors.white },
      line: { color: index === labels.length - 1 ? accent : colors.line, width: 1 },
    });
    slide.addText(label, {
      x: x + 0.08,
      y: y + 0.18,
      w: boxWidth - 0.16,
      h: 0.48,
      align: "center",
      valign: "middle",
      fontFace: "Aptos",
      fontSize: 10.5,
      bold: index === labels.length - 1,
      color: colors.ink,
      margin: 0,
    });
    if (index < labels.length - 1) {
      slide.addShape(shapeType.chevron, {
        x: x + boxWidth - 0.01,
        y: y + 0.31,
        w: gap + 0.02,
        h: 0.25,
        fill: { color: "AAA7B1" },
        line: { color: "AAA7B1" },
      });
    }
  });
}

async function generatePresentation() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Resale Intelligence Assistant Project";
  pptx.subject = "RAG chatbot for thrift and resale businesses";
  pptx.title = "Resale Intelligence Assistant";
  pptx.company = "Semester Project";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
  };

  let slideNumber = 1;

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slide.addShape(shapeType.ellipse, {
      x: 9.7,
      y: -1.2,
      w: 4.8,
      h: 4.8,
      fill: { color: colors.indigoLight, transparency: 8 },
      line: { color: colors.indigoLight, transparency: 100 },
    });
    slide.addShape(shapeType.roundRect, {
      x: 0.8,
      y: 0.75,
      w: 0.75,
      h: 0.75,
      rectRadius: 0.08,
      fill: { color: colors.indigo },
      line: { color: colors.indigo },
    });
    slide.addText("RI", {
      x: 0.8,
      y: 0.91,
      w: 0.75,
      h: 0.26,
      align: "center",
      fontFace: "Aptos",
      fontSize: 18,
      bold: true,
      color: colors.white,
      margin: 0,
    });
    slide.addText("RESALE INTELLIGENCE ASSISTANT", {
      x: 0.82,
      y: 2,
      w: 10.8,
      h: 0.5,
      fontFace: "Aptos",
      fontSize: 13,
      bold: true,
      color: colors.indigo,
      charSpacing: 2.3,
      margin: 0,
    });
    slide.addText("An evidence-led RAG system for clothing resale decisions", {
      x: 0.8,
      y: 2.55,
      w: 10.9,
      h: 1.35,
      fontFace: "Aptos Display",
      fontSize: 34,
      bold: true,
      color: colors.ink,
      breakLine: false,
      margin: 0,
    });
    slide.addText(
      "Text retrieval, image understanding, OCR, visual similarity, warehouse capture, and human feedback.",
      {
        x: 0.82,
        y: 4.18,
        w: 8.7,
        h: 0.7,
        fontFace: "Aptos",
        fontSize: 16,
        color: colors.muted,
        margin: 0,
      },
    );
    slide.addText("Semester Project  |  Prepared by: [Student Name]", {
      x: 0.82,
      y: 6.45,
      w: 6.5,
      h: 0.3,
      fontFace: "Aptos",
      fontSize: 10.5,
      color: colors.muted,
      margin: 0,
    });
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slideTitle(slide, "Problem and motivation");
    addCard(
      slide,
      "Fragmented decisions",
      "Warehouse workers and resellers often estimate price, condition, and listing strategy manually.",
      0.75,
      1.72,
      3.75,
      1.55,
    );
    addCard(
      slide,
      "Weak evidence",
      "General-purpose chatbots may invent values when the available resale dataset does not cover an item.",
      4.78,
      1.72,
      3.75,
      1.55,
      colors.coral,
    );
    addCard(
      slide,
      "Slow intake",
      "Separate tools are normally required for image capture, OCR, pricing research, and inventory review.",
      8.8,
      1.72,
      3.75,
      1.55,
      colors.green,
    );
    slide.addText("Project response", {
      x: 0.78,
      y: 3.82,
      w: 3,
      h: 0.35,
      fontFace: "Aptos",
      fontSize: 16,
      bold: true,
      color: colors.ink,
      margin: 0,
    });
    addBulletList(
      slide,
      [
        "Ground answers in retrieved resale, retail, and condition records.",
        "Use images as identification evidence, not as unsupported price evidence.",
        "Keep workers in control through confirmation and correction.",
        "Run text and image embeddings locally to reduce recurring API cost.",
      ],
      0.8,
      4.3,
      11.3,
      2.2,
      16,
    );
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slideTitle(slide, "Project objectives and users");
    addCard(slide, "Thrift store owners", "Understand pricing, brand value, and profitable listing priorities.", 0.75, 1.7, 3.75, 1.45);
    addCard(slide, "Warehouse staff", "Capture items consistently and verify machine-generated attributes.", 4.78, 1.7, 3.75, 1.45);
    addCard(slide, "Online resellers", "Generate evidence-based price ranges and condition-aware recommendations.", 8.8, 1.7, 3.75, 1.45);
    slide.addText("Core objectives", {
      x: 0.78,
      y: 3.72,
      w: 3,
      h: 0.35,
      fontFace: "Aptos",
      fontSize: 16,
      bold: true,
      color: colors.ink,
      margin: 0,
    });
    addBulletList(slide, features, 0.8, 4.12, 11.4, 2.5, 14.5);
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slideTitle(slide, "Datasets", "Three data sources are processed separately and combined at retrieval time.");
    const positions = [
      [0.75, 1.75],
      [4.78, 1.75],
      [8.8, 1.75],
    ];
    [
      ["Resale listings", "5,440 rows", "Brand, condition, price, title, category and linked product images."],
      ["SSENSE retail reference", "19,919 rows", "Brand, product description, retail price and department."],
      ["Clothing condition corpus", "3,053 labels", "Pilling, stains, holes, damage, material, usage and multi-view images."],
    ].forEach(([title, count, body], index) => {
      const [x, y] = positions[index];
      addCard(slide, title, `${count}\n\n${body}`, x, y, 3.75, 2.1, index === 1 ? colors.coral : index === 2 ? colors.green : colors.indigo);
    });
    slide.addText("Verified processing results", {
      x: 0.78,
      y: 4.35,
      w: 4,
      h: 0.35,
      fontFace: "Aptos",
      fontSize: 16,
      bold: true,
      color: colors.ink,
      margin: 0,
    });
    slide.addTable(tableRows(metrics), {
      x: 0.8,
      y: 4.78,
      w: 6.6,
      h: 1.75,
      border: { color: colors.line, pt: 1 },
      fill: { color: colors.white },
      color: colors.ink,
      fontFace: "Aptos",
      fontSize: 10.5,
      rowH: 0.29,
      margin: 0.08,
      colW: [4.9, 1.7],
    });
    slide.addText(
      "One malformed condition JSON is reported and skipped instead of silently corrupting the pipeline.",
      {
        x: 8.05,
        y: 4.85,
        w: 4.1,
        h: 1.2,
        fontFace: "Aptos",
        fontSize: 15,
        bold: true,
        color: colors.coral,
        margin: 0,
      },
    );
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slideTitle(slide, "System architecture");
    addFlow(slide, ["Raw datasets", "Cleaning scripts", "LangChain documents", "Local embeddings", "FAISS stores", "Gemini answer"], 2.05);
    addFlow(slide, ["Camera / upload", "Gemini vision + OCR", "CLIP image vector", "Visual neighbors", "Text retrieval", "Worker review"], 4.2, colors.coral);
    slide.addText(
      "Two retrieval channels are combined: text evidence supports pricing and condition reasoning, while visual neighbors support identification.",
      {
        x: 1.45,
        y: 5.62,
        w: 10.4,
        h: 0.7,
        align: "center",
        fontFace: "Aptos",
        fontSize: 15,
        color: colors.muted,
        margin: 0,
      },
    );
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slideTitle(slide, "Text RAG pipeline");
    addFlow(slide, ["User question", "MiniLM embedding", "FAISS similarity search", "Top-k context", "Gemini generation"], 1.85);
    addCard(slide, "True RAG", "Knowledge is not hardcoded. Cleaned records are transformed into LangChain documents, embedded, and retrieved.", 0.8, 3.25, 3.7, 1.65);
    addCard(slide, "Grounded answers", "The system distinguishes resale prices from retail references and refuses unsupported category transfers.", 4.82, 3.25, 3.7, 1.65, colors.green);
    addCard(slide, "Aggregated evidence", "Comparable listings are grouped by brand, type, category, and condition with quartile and median prices.", 8.83, 3.25, 3.7, 1.65, colors.coral);
    slide.addText("Example validated result", {
      x: 0.8,
      y: 5.5,
      w: 3,
      h: 0.3,
      fontFace: "Aptos",
      fontSize: 14,
      bold: true,
      color: colors.ink,
      margin: 0,
    });
    slide.addText("Gently used Carhartt denim: $40-$80, median $58, based on 147 listings.", {
      x: 0.8,
      y: 5.93,
      w: 11.2,
      h: 0.55,
      fontFace: "Aptos Display",
      fontSize: 22,
      bold: true,
      color: colors.indigo,
      margin: 0,
    });
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slideTitle(slide, "Image intelligence: vision, OCR and visual search");
    addCard(slide, "Gemini vision", "Estimates brand, item type, category, color, condition and visible defects from up to three views.", 0.75, 1.75, 3.75, 1.75);
    addCard(slide, "Structured OCR", "Extracts readable brand, size, product code, material, manufacturing country and raw label text.", 4.78, 1.75, 3.75, 1.75, colors.coral);
    addCard(slide, "Local CLIP search", "Embeds uploaded images and retrieves visually similar verified resale photos from a FAISS index.", 8.8, 1.75, 3.75, 1.75, colors.green);
    slide.addText("Evidence fusion", {
      x: 0.78,
      y: 4.08,
      w: 3,
      h: 0.35,
      fontFace: "Aptos",
      fontSize: 16,
      bold: true,
      color: colors.ink,
      margin: 0,
    });
    addFlow(slide, ["OCR brand", "Visual attributes", "Nearest images", "Text comparables", "Final recommendation"], 4.58);
    slide.addText(
      "Visual matches support identification but are never used as the sole pricing source.",
      {
        x: 2.1,
        y: 5.88,
        w: 9,
        h: 0.4,
        align: "center",
        fontFace: "Aptos",
        fontSize: 14,
        color: colors.coral,
        bold: true,
        margin: 0,
      },
    );
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slideTitle(slide, "Warehouse workflow and feedback loop");
    addFlow(slide, ["Front photo", "Back photo", "Label close-up", "Quality checks", "AI analysis", "Worker correction"], 1.82);
    addCard(slide, "Image quality", "Client-side checks flag low resolution, darkness, overexposure and likely blur before analysis.", 0.8, 3.28, 3.7, 1.6);
    addCard(slide, "Human verification", "Workers edit predicted brand, category, condition, color and visible issues before approval.", 4.82, 3.28, 3.7, 1.6, colors.green);
    addCard(slide, "Feedback record", "Predictions, corrections, OCR, quality metrics and notes are saved. User photos are not retained.", 8.83, 3.28, 3.7, 1.6, colors.coral);
    slide.addText("Why this matters", {
      x: 0.82,
      y: 5.46,
      w: 2.8,
      h: 0.3,
      fontFace: "Aptos",
      fontSize: 14,
      bold: true,
      color: colors.ink,
      margin: 0,
    });
    slide.addText(
      "Corrections expose where the model fails most often and create the basis for future classifiers, evaluations and retraining.",
      {
        x: 0.82,
        y: 5.9,
        w: 11.2,
        h: 0.65,
        fontFace: "Aptos Display",
        fontSize: 20,
        bold: true,
        color: colors.indigo,
        margin: 0,
      },
    );
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slideTitle(slide, "Technology stack");
    const stack = [
      ["Frontend", "Next.js 16, React 19, TypeScript, responsive CSS"],
      ["Generation and vision", "Google Gemini Flash-Lite through LangChain"],
      ["Text embeddings", "Local all-MiniLM-L6-v2 sentence transformer"],
      ["Visual embeddings", "Local CLIP ViT-B/32"],
      ["Retrieval", "FAISS text and visual indexes"],
      ["Data processing", "TypeScript, csv-parse, csv-stringify"],
      ["Feedback", "JSONL audit trail with worker corrections"],
      ["Runtime", "Node.js, browser webcam APIs, Android support"],
    ];
    stack.forEach(([title, body], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      addCard(slide, title, body, 0.78 + col * 6.03, 1.7 + row * 1.3, 5.72, 1.05, index % 3 === 1 ? colors.coral : index % 3 === 2 ? colors.green : colors.indigo);
    });
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slideTitle(slide, "Testing and validated results");
    slide.addTable(
      tableRows([
        ["Test", "Result"],
        ["Dataset inspection and cleaning", "Passed"],
        ["3,052 valid condition records produced", "Passed"],
        ["2,138 text documents embedded and indexed", "Passed"],
        ["4,413 resale images embedded with CLIP", "Passed"],
        ["Known Carhartt image OCR", "Carhartt read correctly"],
        ["Exact-image visual retrieval", "Similarity 1.00"],
        ["Text and image chat endpoints", "Passed"],
        ["TypeScript and production build", "Passed"],
        ["Laptop and Android LAN access", "Passed"],
      ]),
      {
        x: 0.8,
        y: 1.72,
        w: 8.2,
        h: 4.8,
        border: { color: colors.line, pt: 1 },
        fill: { color: colors.white },
        color: colors.ink,
        fontFace: "Aptos",
        fontSize: 11,
        rowH: 0.48,
        margin: 0.09,
        bold: false,
        colW: [5.35, 2.85],
      },
    );
    slide.addShape(shapeType.roundRect, {
      x: 9.45,
      y: 1.75,
      w: 2.75,
      h: 2.35,
      rectRadius: 0.08,
      fill: { color: colors.indigo },
      line: { color: colors.indigo },
    });
    slide.addText("Validated pricing example", {
      x: 9.75,
      y: 2.08,
      w: 2.15,
      h: 0.35,
      align: "center",
      fontFace: "Aptos",
      fontSize: 11,
      bold: true,
      color: "D9D6FF",
      margin: 0,
    });
    slide.addText("$44-$81", {
      x: 9.68,
      y: 2.55,
      w: 2.3,
      h: 0.55,
      align: "center",
      fontFace: "Aptos Display",
      fontSize: 29,
      bold: true,
      color: colors.white,
      margin: 0,
    });
    slide.addText("Used Carhartt casual pants\nMedian $55 / 208 listings", {
      x: 9.68,
      y: 3.22,
      w: 2.3,
      h: 0.55,
      align: "center",
      fontFace: "Aptos",
      fontSize: 10,
      color: "EAE8FF",
      margin: 0,
    });
    slide.addText("The system also refused to price a Carhartt jacket when the resale dataset only supported bottoms.", {
      x: 9.48,
      y: 4.55,
      w: 2.8,
      h: 1.1,
      fontFace: "Aptos",
      fontSize: 13,
      bold: true,
      color: colors.coral,
      margin: 0,
    });
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slideTitle(slide, "Limitations");
    addBulletList(
      slide,
      [
        "The resale pricing dataset mainly contains bottoms and six major brands.",
        "Listing prices are not the same as final sold prices.",
        "Gemini can misread brands, labels, materials and subtle damage.",
        "CLIP retrieves visually similar shapes and styles, not guaranteed exact products.",
        "Condition labels use mixed conventions and price bands.",
        "The current feedback store is JSONL rather than a transactional database.",
        "Android live webcam APIs require HTTPS; HTTP uses the native camera picker.",
        "The system supports decisions but should not automatically publish prices without review.",
      ],
      0.9,
      1.65,
      11.4,
      4.9,
      17,
    );
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.ivory };
    slideTitle(slide, "Future development");
    const roadmap = [
      ["1", "Pricing model", "Train a regression model using size, brand, condition, color, region and actual sale outcomes."],
      ["2", "Inventory system", "Add item IDs, barcodes, storage locations, acquisition cost, status and marketplace exports."],
      ["3", "Specialist vision", "Introduce logo detection, defect segmentation, material classification and exact product matching."],
      ["4", "Persistent platform", "Move feedback and inventory to PostgreSQL with authentication, roles and audit history."],
      ["5", "Deployment", "Package with Docker and expose through HTTPS for reliable Android webcam access."],
      ["6", "Continuous evaluation", "Compare prediction, worker correction, recommended price and final sold price."],
    ];
    roadmap.forEach(([number, title, body], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 0.75 + col * 6.05;
      const y = 1.65 + row * 1.68;
      slide.addShape(shapeType.roundRect, {
        x,
        y,
        w: 5.75,
        h: 1.35,
        rectRadius: 0.06,
        fill: { color: colors.white },
        line: { color: colors.line, width: 1 },
      });
      slide.addShape(shapeType.ellipse, {
        x: x + 0.22,
        y: y + 0.28,
        w: 0.62,
        h: 0.62,
        fill: { color: colors.indigoLight },
        line: { color: colors.indigoLight },
      });
      slide.addText(number, {
        x: x + 0.22,
        y: y + 0.42,
        w: 0.62,
        h: 0.2,
        align: "center",
        fontFace: "Aptos",
        fontSize: 12,
        bold: true,
        color: colors.indigo,
        margin: 0,
      });
      slide.addText(title, {
        x: x + 1.05,
        y: y + 0.2,
        w: 4.3,
        h: 0.28,
        fontFace: "Aptos",
        fontSize: 13,
        bold: true,
        color: colors.ink,
        margin: 0,
      });
      slide.addText(body, {
        x: x + 1.05,
        y: y + 0.56,
        w: 4.35,
        h: 0.58,
        fontFace: "Aptos",
        fontSize: 10,
        color: colors.muted,
        margin: 0,
      });
    });
    addFooter(slide, slideNumber++);
  }

  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.indigo };
    slide.addText("Conclusion", {
      x: 0.82,
      y: 0.75,
      w: 3,
      h: 0.4,
      fontFace: "Aptos",
      fontSize: 13,
      bold: true,
      color: "DCD9FF",
      charSpacing: 2,
      margin: 0,
    });
    slide.addText(
      "A working multimodal RAG assistant that combines evidence, automation and human judgment.",
      {
        x: 0.8,
        y: 1.55,
        w: 11.2,
        h: 1.65,
        fontFace: "Aptos Display",
        fontSize: 34,
        bold: true,
        color: colors.white,
        margin: 0,
      },
    );
    slide.addText(
      "The system is not a universal resale oracle. Its value comes from transparent retrieval, explicit limitations, multi-source evidence, and a worker correction loop.",
      {
        x: 0.82,
        y: 3.75,
        w: 9.6,
        h: 1,
        fontFace: "Aptos",
        fontSize: 18,
        color: "E5E3FF",
        margin: 0,
      },
    );
    slide.addText("Questions?", {
      x: 0.82,
      y: 6.15,
      w: 4,
      h: 0.65,
      fontFace: "Aptos Display",
      fontSize: 30,
      bold: true,
      color: colors.white,
      margin: 0,
    });
    addFooter(slide, slideNumber++);
  }

  await pptx.writeFile({
    fileName: path.join(outputDirectory, "Resale-Intelligence-Assistant-Presentation.pptx"),
  });
}

function heading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel]) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 220, after: 100 },
  });
}

function body(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color: colors.ink })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 130, line: 330 },
  });
}

function bullet(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color: colors.ink })],
    bullet: { level: 0 },
    spacing: { after: 75, line: 300 },
  });
}

function tableCell(text: string, bold = false) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D7D4DD" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D7D4DD" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D7D4DD" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D7D4DD" },
    },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 20, color: colors.ink })],
        spacing: { before: 60, after: 60 },
      }),
    ],
  });
}

async function generateReport() {
  const sections: Paragraph[] = [];
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 900, after: 200 },
      children: [
        new TextRun({
          text: "RESALE INTELLIGENCE ASSISTANT",
          bold: true,
          size: 42,
          color: colors.indigo,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 500 },
      children: [
        new TextRun({
          text: "A Multimodal RAG Chatbot for Thrift and Resale Businesses",
          bold: true,
          size: 30,
          color: colors.ink,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Semester Project Report",
          size: 24,
          color: colors.muted,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 260, after: 70 },
      children: [new TextRun({ text: "Prepared by: [Student Name]", size: 22 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Course: [Course Name]", size: 22 })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
    heading("Executive Summary", HeadingLevel.HEADING_1),
    body(
      "The Resale Intelligence Assistant is a multimodal retrieval-augmented generation system designed for thrift store owners, warehouse workers, and online clothing resellers. It provides evidence-based pricing, brand comparison, condition reasoning, image-assisted identification, optical character recognition, visual similarity search, and a guided warehouse intake workflow.",
    ),
    body(
      "The implementation combines three datasets: 5,440 resale listings, 19,919 SSENSE retail-reference products, and 3,053 clothing condition labels with linked images. Cleaned records are transformed into LangChain documents, embedded locally, and stored in FAISS. Google Gemini generates the final response using only retrieved evidence. User images are analyzed by Gemini Vision and a local CLIP image encoder. A worker correction loop records model errors without retaining uploaded images.",
    ),
    heading("1. Introduction", HeadingLevel.HEADING_1),
    body(
      "Second-hand fashion businesses frequently make pricing and sorting decisions with incomplete information. A warehouse worker may identify an item visually, estimate its condition, and assign a price without consistent access to comparable listings or retail references. This creates variation between workers and increases the risk of underpricing valuable items or wasting time on low-value stock.",
    ),
    body(
      "The project addresses this problem through a RAG architecture. Instead of asking a general-purpose language model to answer from memory, the system retrieves relevant records from project datasets and supplies them as context. This makes the source of the recommendation visible and allows the model to refuse questions that are unsupported by the available data.",
    ),
    heading("2. Problem Statement", HeadingLevel.HEADING_1),
    body(
      "The central problem is to support pricing, condition assessment, brand intelligence, and warehouse intake while reducing unsupported model guesses. The system must combine structured resale data with image evidence and maintain a human review step because visual models can misread brands, labels, materials, and garment categories.",
    ),
    heading("3. Project Objectives", HeadingLevel.HEADING_1),
    ...features.map(bullet),
    heading("4. Scope", HeadingLevel.HEADING_1),
    body(
      "The completed scope includes text RAG, image upload, camera capture, Gemini visual analysis, OCR, CLIP visual embeddings, FAISS retrieval, multi-view warehouse intake, image-quality warnings, worker correction, and feedback reporting. Automatic marketplace publishing, user authentication, payment processing, and model retraining are outside the current scope.",
    ),
    heading("5. Dataset Analysis", HeadingLevel.HEADING_1),
  );

  const metricRows = [
    new TableRow({
      children: [tableCell("Dataset / Output", true), tableCell("Count", true)],
    }),
    ...metrics.map(
      ([name, count]) =>
        new TableRow({ children: [tableCell(name), tableCell(count)] }),
    ),
  ];
  const reportChildren: (Paragraph | Table)[] = [
    ...sections,
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: metricRows,
    }),
    heading("5.1 Resale Dataset", HeadingLevel.HEADING_2),
    body(
      "The primary resale file contains 5,440 listings. Important fields include brand, title, category path, condition, price, seller information, location, department, and image path. A total of 4,413 listing rows have verified matching images under the bottoms image directory. The data mainly represents bottoms and six brands, which limits category coverage.",
    ),
    heading("5.2 SSENSE Retail Reference", HeadingLevel.HEADING_2),
    body(
      "The retail reference dataset contains 19,919 products with brand, description, price in US dollars, and department. It supports retail-versus-resale reasoning but does not directly provide sold-market evidence.",
    ),
    heading("5.3 Clothing Condition Dataset", HeadingLevel.HEADING_2),
    body(
      "Six monthly folders contain 3,053 label JSON files and 7,711 images. The labels describe category, item type, pilling, condition score, price band, stains, holes, damage, material, season, usage, and other attributes. The cleaning process parses 3,052 files and reports one malformed source file.",
    ),
    heading("6. Data Processing", HeadingLevel.HEADING_1),
    body(
      "The inspect-data script reports row counts, columns, missing values, and sample records. The cleaning script creates resale_products.csv, retail_reference.csv, and condition_guide.csv. It normalizes condition names, infers item types from category paths, validates image links, recursively discovers condition labels, and preserves image paths for later vision processing.",
    ),
    heading("7. System Architecture", HeadingLevel.HEADING_1),
    body(
      "The architecture contains two retrieval channels. The text channel converts aggregated dataset records into local MiniLM embeddings and stores them in FAISS. The image channel converts verified resale photos into normalized 512-dimensional CLIP vectors and stores them in a separate inner-product FAISS index. Gemini performs generation, image understanding, and structured OCR.",
    ),
    bullet("Text flow: question -> MiniLM embedding -> FAISS -> retrieved context -> Gemini answer."),
    bullet("Image flow: camera/upload -> Gemini vision and OCR -> CLIP embedding -> visual neighbors."),
    bullet("Evidence fusion: OCR, visual attributes, visual neighbors, and text comparables are combined."),
    bullet("Warehouse flow: multi-view capture -> quality checks -> recommendation -> worker correction -> feedback."),
    heading("8. Text Retrieval-Augmented Generation", HeadingLevel.HEADING_1),
    body(
      "Comparable resale listings are grouped by brand, item type, category, and condition. The system computes a typical range using the first and third quartiles and also stores a median and sample size. Retail references are grouped by brand and department. Condition records are grouped by item characteristics and visible defects. These summaries become LangChain documents.",
    ),
    body(
      "At runtime, the user question is embedded locally using all-MiniLM-L6-v2. The nearest documents are retrieved from FAISS and inserted into a system instruction. Gemini is instructed to distinguish retail and resale evidence, mention sample sizes, disclose limitations, and refuse unsupported claims.",
    ),
    heading("9. Image Understanding and OCR", HeadingLevel.HEADING_1),
    body(
      "The image endpoint accepts JPEG, PNG, and WebP files up to 8 MB. It supports a single chat image or three warehouse views: front, back, and label. Gemini returns a structured object containing brand, item type, category, color, condition, visible damage, confidence, and OCR fields.",
    ),
    body(
      "OCR fields include raw readable text, brand, product code, size, material, and country of manufacture. The prompt explicitly requires Unknown rather than invented text. When a readable OCR brand is available, it is treated as stronger evidence than appearance-based brand guessing.",
    ),
    heading("10. Visual Embeddings", HeadingLevel.HEADING_1),
    body(
      "A one-time build script embeds 4,413 verified resale images using CLIP ViT-B/32. The vectors are normalized and stored in an inner-product FAISS index, making the scores equivalent to cosine similarity. Uploaded front and back images are embedded locally and averaged before search. Label images are excluded from garment-shape similarity.",
    ),
    body(
      "Visual neighbors support identification but do not directly determine price. The results are reranked by OCR or visually identified brand when possible. This prevents visually similar garments from unrelated luxury brands from dominating the recommendation.",
    ),
    heading("11. Warehouse Workflow", HeadingLevel.HEADING_1),
    body(
      "Warehouse mode guides the worker through front, back, and optional label capture. Client-side checks estimate resolution, brightness, exposure, and sharpness. Quality warnings advise a retake but do not permanently block analysis. After Gemini and RAG produce a recommendation, the worker can edit the predicted attributes and save feedback.",
    ),
    heading("12. Feedback and Continuous Improvement", HeadingLevel.HEADING_1),
    body(
      "Feedback records are appended as JSON Lines. Each record contains the original prediction, correction, changed fields, image-view names, quality metrics, OCR evidence, timestamp, and notes. Uploaded image bytes are not stored. A reporting command calculates correction rates and identifies the fields that fail most frequently.",
    ),
    heading("13. User Interface", HeadingLevel.HEADING_1),
    body(
      "The interface is implemented in Next.js and TypeScript. It provides a responsive chat assistant, camera and upload controls, OCR evidence chips, loading indicators, a guided warehouse workflow, visual match scores, editable review fields, and an Android-compatible camera fallback. The final theme uses a warm ivory background and indigo signature color.",
    ),
    heading("14. Testing and Results", HeadingLevel.HEADING_1),
    body(
      "The project was tested through dataset scripts, TypeScript compilation, production builds, direct API calls, known-image validation, local browser access, and Android LAN access. The text vector store contains 2,138 documents. The visual index contains 4,413 images. A known Carhartt image produced OCR text Carhartt and retrieved itself with similarity 1.00.",
    ),
    body(
      "A supported pricing query for gently used Carhartt denim returned a typical range of $40-$80 and a median of $58 from 147 listings. A used Carhartt cargo-pants image was mapped to the dataset's casual-pants taxonomy and returned $44-$81 with a median of $55 from 208 listings. The system also correctly refused to price a Carhartt jacket because the primary resale dataset does not contain jacket comparables.",
    ),
    heading("15. Privacy and Security", HeadingLevel.HEADING_1),
    body(
      "User-uploaded photos are processed in memory and are not saved by the application. The Gemini API key is stored in .env.local, which is excluded from version control. The system validates file types and size. For production deployment, HTTPS, authentication, rate limiting, object-storage policies, and database access controls should be added.",
    ),
    heading("16. Storage Usage", HeadingLevel.HEADING_1),
    body(
      "Most disk usage comes from the source image datasets and machine-learning dependencies rather than the vector indexes. The project workspace is approximately 6.1 GB. The bottoms image folder is about 2.42 GB, the monthly condition folders total about 2.12 GB, node_modules is about 1.24 GB, and the Next.js build cache is about 0.24 GB. Outside the project, the cached CLIP model is about 1.70 GB and the npm cache is about 1.44 GB. The text and visual FAISS indexes together are only about 14 MB.",
    ),
    heading("17. Limitations", HeadingLevel.HEADING_1),
    bullet("The primary resale dataset mainly contains bottoms and a limited brand set."),
    bullet("Listing prices may differ from final sold prices."),
    bullet("Condition and OCR remain estimates and require human verification."),
    bullet("CLIP similarity does not guarantee exact product identity."),
    bullet("Feedback uses JSONL instead of a transactional database."),
    bullet("The current application is a decision-support tool, not an autonomous pricing authority."),
    heading("18. Future Work", HeadingLevel.HEADING_1),
    bullet("Train a structured pricing model using listing and actual sale outcomes."),
    bullet("Add inventory IDs, barcodes, bins, acquisition cost, status and exports."),
    bullet("Add logo detection, material classification and defect segmentation."),
    bullet("Move feedback and inventory to PostgreSQL with user roles."),
    bullet("Deploy with Docker and HTTPS for reliable mobile webcam access."),
    bullet("Measure recommendation error against actual sale price."),
    heading("19. Conclusion", HeadingLevel.HEADING_1),
    body(
      "The Resale Intelligence Assistant demonstrates a complete multimodal RAG workflow for clothing resale decisions. It combines structured data, text embeddings, image embeddings, OCR, language generation, camera capture, and human feedback. The project also demonstrates an important engineering principle: model output becomes more useful when it is constrained by evidence, limitations are made explicit, and workers can correct the system.",
    ),
    heading("Appendix A: Main Commands", HeadingLevel.HEADING_1),
    bullet("npm run inspect:data"),
    bullet("npm run clean:data"),
    bullet("npm run build:vectors"),
    bullet("npm run build:visuals"),
    bullet("npm run inspect:feedback"),
    bullet("npm run dev"),
    bullet("npm run build"),
  ];

  const document = new Document({
    creator: "Resale Intelligence Assistant Project",
    title: "Resale Intelligence Assistant Project Report",
    description: "Semester project report for a multimodal RAG chatbot",
    styles: {
      default: {
        document: {
          run: { font: "Aptos", size: 22, color: colors.ink },
          paragraph: { spacing: { line: 330 } },
        },
        heading1: {
          run: { font: "Aptos Display", size: 32, bold: true, color: colors.indigo },
          paragraph: { spacing: { before: 300, after: 140 } },
        },
        heading2: {
          run: { font: "Aptos", size: 25, bold: true, color: colors.ink },
          paragraph: { spacing: { before: 220, after: 100 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 900 },
          },
        },
        children: reportChildren,
      },
    ],
  });

  await writeFile(
    path.join(outputDirectory, "Resale-Intelligence-Assistant-Report.docx"),
    await Packer.toBuffer(document),
  );
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([generatePresentation(), generateReport()]);
  console.log(`Generated deliverables in ${outputDirectory}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
