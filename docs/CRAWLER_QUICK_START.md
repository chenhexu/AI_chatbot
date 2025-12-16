# Crawler Quick Start Guide

## ⚠️ Things to Know Before Starting

1. **It takes time** - With 3 seconds between requests, crawling 50 pages takes ~2.5 minutes minimum
2. **Internet connection required** - It downloads content from the website
3. **Storage space** - Expect 50-200 MB for a typical school website
4. **Can be stopped** - Press `Ctrl+C` to stop anytime (saves what it already crawled)
5. **First run is slowest** - Subsequent runs skip already-downloaded files

## 📏 How Deep and Wide Does It Crawl?

### **Depth (How Many Clicks Away)**
- **Default: 3 levels deep**
- **Depth 0**: Homepage (`/`)
- **Depth 1**: Pages linked from homepage (`/about`, `/admissions`, etc.)
- **Depth 2**: Pages linked from depth 1 pages
- **Depth 3**: Pages linked from depth 2 pages

**Example:**
```
Depth 0: https://collegesaintlouis.ecolelachine.com/
  ↓
Depth 1: /about, /admissions, /contact
  ↓
Depth 2: /about/history, /admissions/requirements
  ↓
Depth 3: /about/history/founders
```

### **Width (How Many Pages Total)**
- **Default: 50 pages maximum**
- Stops when it reaches 50 pages OR max depth, whichever comes first

## 🎯 How Does It Decide Which Pages to Crawl?

**It uses a Queue (First-In-First-Out) - NOT random!**

1. **Starts with homepage** → adds to queue
2. **Crawls homepage** → finds all links
3. **Adds all links to queue** → in the order found
4. **Crawls next page in queue** → finds its links
5. **Adds those links to queue** → continues...

**Example Flow:**
```
Queue: [homepage]
  ↓ Crawl homepage
Queue: [about, admissions, contact]  ← Links from homepage
  ↓ Crawl "about"
Queue: [admissions, contact, about/history, about/staff]  ← Added links from "about"
  ↓ Crawl "admissions"
Queue: [contact, about/history, about/staff, admissions/requirements]
  ... and so on
```

**Important:**
- ✅ **Systematic** - Crawls in order, not random
- ✅ **No duplicates** - Skips pages already visited
- ✅ **Breadth-first** - Visits all depth 1 pages before depth 2
- ✅ **Respects limits** - Stops at max depth or max pages

## ⏱️ How to Change Time Between Requests

### Option 1: Environment Variable (Recommended)

Add to `.env.local`:
```env
# Time in milliseconds (3000 = 3 seconds)
CRAWLER_RATE_LIMIT_MS=3000

# Or slower (5 seconds)
CRAWLER_RATE_LIMIT_MS=5000

# Or faster (1 second) - NOT recommended, may overload server
CRAWLER_RATE_LIMIT_MS=1000
```

### Option 2: Change Defaults

Edit `scripts/crawl-school-website.ts`:
```typescript
rateLimitMs: parseInt(process.env.CRAWLER_RATE_LIMIT_MS || '5000'), // Changed to 5 seconds
```

## ⚙️ All Configuration Options

Add to `.env.local`:

```env
# Starting URL
CRAWLER_START_URL=https://collegesaintlouis.ecolelachine.com/

# How many levels deep (0 = only homepage, 3 = 3 clicks away)
CRAWLER_MAX_DEPTH=3

# Maximum number of pages to crawl
CRAWLER_MAX_PAGES=50

# Time between requests in milliseconds (3000 = 3 seconds)
CRAWLER_RATE_LIMIT_MS=3000

# Where to save scraped data
CRAWLER_DATA_FOLDER=./data/scraped
```

## 📊 Example Configurations

### **Quick Test (Small Crawl)**
```env
CRAWLER_MAX_DEPTH=1
CRAWLER_MAX_PAGES=10
CRAWLER_RATE_LIMIT_MS=2000
```
→ Crawls ~10 pages, 1 level deep, ~20 seconds

### **Medium Crawl (Recommended)**
```env
CRAWLER_MAX_DEPTH=3
CRAWLER_MAX_PAGES=50
CRAWLER_RATE_LIMIT_MS=3000
```
→ Crawls ~50 pages, 3 levels deep, ~2.5 minutes

### **Full Crawl (Comprehensive)**
```env
CRAWLER_MAX_DEPTH=5
CRAWLER_MAX_PAGES=200
CRAWLER_RATE_LIMIT_MS=3000
```
→ Crawls ~200 pages, 5 levels deep, ~10 minutes

## 🚀 Running the Crawler

```bash
npm run crawl
```

## 📈 What You'll See

```
Starting crawl from: https://collegesaintlouis.ecolelachine.com/
Max depth: 3, Max pages: 50
Rate limit: 3000ms between requests

[Depth 0] Crawling: https://collegesaintlouis.ecolelachine.com/
[Depth 1] Crawling: https://collegesaintlouis.ecolelachine.com/about
[Depth 1] Crawling: https://collegesaintlouis.ecolelachine.com/admissions
[Depth 1] Crawling: https://collegesaintlouis.ecolelachine.com/contact
[Depth 2] Crawling: https://collegesaintlouis.ecolelachine.com/about/history
...

=== Crawl Complete ===
Pages crawled: 45
Files downloaded: 12
Links found: 127
Errors: 2
```

## 💡 Tips

1. **Start small** - Test with `MAX_PAGES=10` first
2. **Check robots.txt** - The crawler respects it automatically
3. **Monitor progress** - Watch the console output
4. **Check results** - Look in `data/scraped/pages/` after crawling
5. **Re-run is faster** - Skips already-downloaded files

## ❓ Troubleshooting

**Crawler stops early?**
- Check `CRAWLER_MAX_PAGES` - might be too low
- Check `CRAWLER_MAX_DEPTH` - might be too low

**Too slow?**
- Reduce `CRAWLER_RATE_LIMIT_MS` (but be respectful!)
- Reduce `CRAWLER_MAX_PAGES`

**Missing pages?**
- Increase `CRAWLER_MAX_DEPTH`
- Increase `CRAWLER_MAX_PAGES`




