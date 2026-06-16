# Deployment Guide

This app is a Next.js RAG assistant. The production app needs these files in
the deployed repo:

- `app/`, `components/`, `lib/`
- `package.json` and `package-lock.json`
- `next.config.ts`, `tsconfig.json`, Tailwind/PostCSS config
- `vectorstore/faiss.index` and `vectorstore/docstore.json`
- `visualstore/visual.index` and `visualstore/metadata.json`

The large raw image folders and CSV source datasets are ignored because the app
uses the generated FAISS stores at runtime.

## Verify Locally

On Windows PowerShell, use `npm.cmd` if `npm` is blocked by execution policy.

```powershell
npm.cmd install
npm.cmd run build
```

If the indexes are missing, rebuild them before deploying:

```powershell
npm.cmd run clean:data
npm.cmd run build:vectors
npm.cmd run build:visuals
```

## Vercel

Vercel is the recommended first deployment target.

1. Push the project to GitHub.
2. Open https://vercel.com/new.
3. Import the GitHub repository.
4. Keep the default Next.js settings:
   - Framework Preset: `Next.js`
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: leave empty
5. Add environment variables:
   - `GOOGLE_API_KEY`
   - `GEMINI_CHAT_MODEL` with value `gemini-3.1-flash-lite`
6. Deploy.

After deploy, test:

- Open the home page.
- Ask a text-only pricing question.
- Upload one image and ask for identification/pricing.

## Netlify

Use Netlify if you prefer it, but Vercel is usually smoother for Next.js.

1. Push the project to GitHub.
2. Open https://app.netlify.com/start.
3. Import the GitHub repository.
4. Use:
   - Build command: `npm run build`
   - Publish directory: `.next`
5. Add the same environment variables:
   - `GOOGLE_API_KEY`
   - `GEMINI_CHAT_MODEL`
6. Deploy.

## Production Note

`/api/feedback` currently writes warehouse feedback to
`data/feedback/warehouse-feedback.jsonl`. Serverless platforms do not provide
persistent local disk writes, so feedback should be moved to a database for a
real production deployment.

Recommended options:

- Supabase Postgres
- Neon Postgres
- Firebase
- Vercel Postgres

The local FAISS files are acceptable for a demo. For larger production usage,
move retrieval to a hosted vector database such as Qdrant Cloud, Pinecone,
Supabase Vector, or Weaviate.
