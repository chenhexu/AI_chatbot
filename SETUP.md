# Quick Setup Guide

## Important: Environment Variables

Since `.env.local` files are protected, you need to create it manually:

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your actual values:
   - `OPENAI_API_KEY`: Your OpenAI API key (already provided)
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: Path to your service account JSON file
   - `GOOGLE_DOC_FULL_ID`: Extract from the Google Doc URL (the ID between `/d/` and `/edit`)
   - `GOOGLE_DOC_TEST_ID`: Same as above for the test document

## Google Docs ID Extraction

From a URL like:
```
https://docs.google.com/document/d/1tClsLLSOjsxRlfqj_8M8N3h_YGciblW6uSzHXOJaGL8/edit?usp=sharing
```

The document ID is: `1tClsLLSOjsxRlfqj_8M8N3h_YGciblW6uSzHXOJaGL8`

## Service Account Setup

1. Ensure your Google Service Account JSON file is in the project root
2. Share your Google Docs with the service account email (found in the JSON file)
3. Update the path in `.env.local` to point to your JSON file

## First Run

After setting up `.env.local`:

```bash
npm install
npm run dev
```

Visit http://localhost:3000 to see the chatbot!


