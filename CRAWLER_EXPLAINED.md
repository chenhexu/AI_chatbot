# How the Crawler Works - Explained Simply

## Do I Need to Create Folders?

**No!** The crawler automatically creates all folders when it runs. You don't need to do anything.

When you run `npm run crawl`, it automatically creates:
```
data/scraped/
  ├── pages/     ← HTML pages saved as text files
  ├── pdfs/      ← PDF documents
  ├── excel/     ← Excel files
  ├── images/    ← Images
  └── other/     ← Other file types
```

## How Does It Know What's What?

The crawler identifies content by **file type** and **HTML structure**:

### 1. **File Types (Automatic)**
- **PDFs**: Any link ending in `.pdf` → goes to `pdfs/` folder
- **Excel**: Any link ending in `.xlsx` or `.xls` → goes to `excel/` folder
- **Images**: Any `<img>` tag → goes to `images/` folder
- **Text**: Everything else → goes to `pages/` folder as text files

### 2. **Text Extraction (Smart)**
For messy pages like your homepage, the crawler:
- ✅ Removes navigation menus, headers, footers
- ✅ Finds the main content area (`<main>`, `<article>`, `.content`)
- ✅ Preserves headings (H1-H6) as section markers
- ✅ Extracts paragraphs and lists
- ✅ Organizes text with section headers

### Example: Your Homepage

When it crawls `https://collegesaintlouis.ecolelachine.com/`, it will:

1. **Extract Text Sections:**
   ```
   ## TOUT SAVOIR AU SUJET DES ADMISSIONS
   Des questions au sujet des ADMISSIONS ? Cliquez ici...
   Admissions 2026-2027 : informations importantes...
   
   ## ACTUALITÉS
   Info-parents novembre 2025
   Info-parents mi-septembre 2025
   ...
   ```

2. **Find PDF Links:**
   - "Info-parents novembre 2025" PDF → downloads to `pdfs/`
   - "Admissions 2026-2027" PDF → downloads to `pdfs/`

3. **Find Images:**
   - Logo, banners, photos → downloads to `images/`

4. **Follow Links:**
   - Finds all links on the page
   - Only follows links from the same domain
   - Crawls those pages too (up to max depth)

## What Gets Saved Where?

| Content Type | How It's Identified | Where It Goes |
|-------------|---------------------|---------------|
| **Text from pages** | HTML content | `pages/homepage_abc123.txt` |
| **PDF documents** | Links ending in `.pdf` | `pdfs/info-parents-nov_xyz.pdf` |
| **Excel files** | Links ending in `.xlsx` | `excel/schedule_def456.xlsx` |
| **Images** | `<img>` tags | `images/logo_ghi789.png` |
| **Other files** | `.doc`, `.ppt`, etc. | `other/document_jkl012.doc` |

## How the Chatbot Uses It

When the chatbot loads documents, it:
1. Reads all `.txt` files from `pages/` folder
2. Processes them through RAG (chunking, indexing)
3. Uses them to answer questions

**The chatbot doesn't care about the messy structure** - it just reads the text and finds relevant information when you ask questions!

## Example Flow

```
1. You run: npm run crawl

2. Crawler visits homepage:
   - Extracts: "TOUT SAVOIR AU SUJET DES ADMISSIONS..."
   - Finds PDF: "info-parents-novembre-2025.pdf"
   - Downloads PDF → saves to pdfs/
   - Saves text → saves to pages/homepage_abc123.txt
   - Finds links → adds to queue

3. Crawler visits next page:
   - Extracts text → saves to pages/about_def456.txt
   - ... and so on

4. Chatbot loads documents:
   - Reads pages/*.txt files
   - Processes through RAG
   - Ready to answer questions!
```

## Tips for Better Results

1. **Run the crawler regularly** - Website content changes, so re-crawl monthly
2. **Check the pages folder** - See what text was extracted
3. **Adjust max depth** - If you want deeper crawling, increase `CRAWLER_MAX_DEPTH`
4. **Check metadata.json** - See what was crawled and when

## Current Limitations

- **Doesn't understand semantic meaning** - It extracts by file type, not by topic
- **Text is one big file per page** - Sections are preserved but not separated into different files
- **No OCR for images** - Images are downloaded but text in images isn't extracted (yet)

The good news: **The chatbot's RAG system handles the messy text just fine!** It chunks it intelligently and finds relevant information when you ask questions.




