# Web Crawler for School Website

This crawler automatically scrapes the Collège Saint-Louis website and stores content for the AI chatbot.

## Features

- ✅ Respects `robots.txt`
- ✅ Rate limiting (3 seconds between requests by default)
- ✅ Extracts text, links, PDFs, Excel files, and images
- ✅ Stores content in organized folders
- ✅ Automatically integrates with chatbot document processor
- ✅ Only crawls pages from the school domain

## Setup

### 1. Environment Variables

Add to `.env.local`:

```env
# Crawler Configuration
CRAWLER_START_URL=https://collegesaintlouis.ecolelachine.com/
CRAWLER_MAX_DEPTH=3
CRAWLER_MAX_PAGES=50
CRAWLER_RATE_LIMIT_MS=3000
CRAWLER_DATA_FOLDER=./data/scraped
```

### 2. Run the Crawler

```bash
npm run crawl
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CRAWLER_START_URL` | Required | Starting URL to crawl |
| `CRAWLER_MAX_DEPTH` | 3 | Maximum depth to crawl (0 = only start page) |
| `CRAWLER_MAX_PAGES` | 50 | Maximum number of pages to crawl |
| `CRAWLER_RATE_LIMIT_MS` | 3000 | Milliseconds between requests (3 seconds) |
| `CRAWLER_DATA_FOLDER` | `./data/scraped` | Where to store scraped content |

## Storage Structure

```
data/scraped/
  ├── pages/          # HTML pages as text files
  ├── pdfs/           # Downloaded PDF files
  ├── excel/          # Downloaded Excel files
  ├── images/         # Downloaded images
  ├── other/          # Other file types
  └── metadata.json   # Crawl history and index
```

## How It Works

1. **Fetches robots.txt** - Checks if crawling is allowed
2. **Crawls pages** - Starts from the start URL, follows links
3. **Extracts content** - Text, links, files, images
4. **Downloads files** - PDFs, Excel, images are saved
5. **Saves text** - HTML pages are saved as text files
6. **Integrates with chatbot** - Files are automatically loaded by the document processor

## Integration with Chatbot

The scraped files are automatically included when the chatbot loads documents:

- Text files from `pages/` folder are processed automatically
- PDFs and Excel files will be processed once their processors are implemented

No code changes needed - just run the crawler and the chatbot will use the new content!

## Legal & Ethical

- ✅ Respects `robots.txt` rules
- ✅ Uses rate limiting to avoid overloading the server
- ✅ Only crawls the school's own domain
- ✅ Identifies itself with User-Agent header

## Troubleshooting

### Crawler stops early
- Check if `CRAWLER_MAX_PAGES` is too low
- Check if `CRAWLER_MAX_DEPTH` is too low

### Files not downloading
- Check network connection
- Verify URLs are accessible
- Check if files are blocked by robots.txt

### Storage issues
- Check available disk space
- Verify `CRAWLER_DATA_FOLDER` path is writable

## Example Output

```
Starting crawl from: https://collegesaintlouis.ecolelachine.com/
Max depth: 3, Max pages: 50
Rate limit: 3000ms between requests

[Depth 0] Crawling: https://collegesaintlouis.ecolelachine.com/
[Depth 1] Crawling: https://collegesaintlouis.ecolelachine.com/about
[Depth 1] Crawling: https://collegesaintlouis.ecolelachine.com/contact
...

=== Crawl Complete ===
Pages crawled: 45
Files downloaded: 12
Links found: 127
Errors: 2

✅ Crawl completed successfully!
📁 Data saved to: ./data/scraped
```




