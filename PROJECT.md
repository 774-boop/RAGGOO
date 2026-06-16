# Resale Intelligence Assistant

A text-first RAG chatbot for resale pricing, brand comparison, clothing
condition analysis, and listing decisions.

## Datasets

- `updated_dataset.csv`: 5,440 resale listings. Images are referenced under
  `bottoms/bottoms/`.
- `ssense_dataset.csv`: 19,919 retail reference products.
- `sep2022/` through `feb2023/`: 3,053 clothing condition label files with
  front, back, and optional brand images.

One condition label is malformed and is reported and skipped:

`oct2022/2022-10-17/labels_2022_10_17_07_40_32.json`

## Commands

```powershell
npm run inspect:data
npm run inspect:feedback
npm run clean:data
npm run build:vectors
npm run build:visuals
npm run dev
```

Before building the vector store, create a free Google AI Studio API key and set
`GOOGLE_API_KEY` in `.env.local`. The vector build uses a local MiniLM
embedding model and saves the FAISS index under `vectorstore/`.

## RAG Flow

1. The cleaning script creates:
   - `data/processed/resale_products.csv`
   - `data/processed/retail_reference.csv`
   - `data/processed/condition_guide.csv`
2. The vector script aggregates comparable records into LangChain documents.
3. Local sentence-transformer embeddings are stored in FAISS.
4. The API retrieves relevant documents and supplies them to the chat model.
5. The model answers only from retrieved dataset context.

## Image-Assisted RAG

The chat accepts JPEG, PNG, and WebP uploads up to 8 MB. Gemini Vision produces
structured item and visible-condition estimates. Those attributes are used as
the FAISS retrieval query, and the final recommendation remains grounded in the
retrieved datasets. Uploaded images are processed in memory and are not saved.

The API normalizes a small set of direct clothing synonyms to the dataset
taxonomy, such as cargo pants to casual pants and jeans to denim. The answer
discloses this mapping when it uses the normalized category for pricing.

## Warehouse Feedback

Warehouse mode captures front and back views plus an optional label close-up.
Client-side checks flag low resolution, darkness, overexposure, and likely blur
before analysis. Workers review and correct the predicted attributes.

Feedback is appended to `data/feedback/warehouse-feedback.jsonl`. Records
contain predictions, corrections, image-view names, quality metrics, and notes.
Uploaded image bytes are not stored. Run `npm run inspect:feedback` to review
correction rates and the fields that fail most often.

## OCR And Visual Similarity

Gemini extracts readable brand, product code, size, material, manufacturing
country, and raw label text from uploaded views. OCR is included in the text
retrieval query.

`npm run build:visuals` creates a local CLIP/FAISS index from verified resale
photos. Uploaded front/back views are embedded locally and matched against the
nearest known images. Visual matches support identification but are not treated
as exact product matches or sole pricing evidence.
