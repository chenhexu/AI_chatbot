# Clean Start - Delete Data & Restart Crawler

## 🗑️ Delete All Scraped Data

### Option 1: Using the Script (Recommended)

```bash
cd ~/crawler-app
chmod +x scripts/delete-scraped-data.sh
./scripts/delete-scraped-data.sh
```

### Option 2: Manual Deletion

```bash
cd ~/crawler-app

# Delete all scraped data
rm -rf data/scraped/*

# Delete subdirectories
rm -rf data/scraped/pages
rm -rf data/scraped/external
rm -rf data/scraped/pdf
rm -rf data/scraped/excel

# Delete index files
rm -f data/scraped/crawl-index.json
rm -f data/scraped/*.json
```

### Option 3: Quick One-Liner

```bash
cd ~/crawler-app && rm -rf data/scraped/* && echo "✅ Data deleted"
```

## ✅ Verify Data is Deleted

```bash
# Check if directory is empty
ls -la ~/crawler-app/data/scraped/

# Should show only . and .. (empty directory)
```

## 🚀 Restart Crawler with New Settings

### Step 1: Update Code

```bash
cd ~/crawler-app
git pull
```

### Step 2: Update Environment Variables

```bash
nano ~/crawler-app/.env.local
```

Make sure it has:
```env
CRAWLER_START_URL=https://collegesaintlouis.ecolelachine.com/
CRAWLER_MAX_DEPTH=4
CRAWLER_MAX_PAGES=2000
CRAWLER_RATE_LIMIT_MS=3000
CRAWLER_DATA_FOLDER=./data/scraped
```

Save: `Ctrl+X`, then `Y`, then `Enter`

### Step 3: Start Crawler

```bash
# Make sure start script is executable
chmod +x ~/crawler-app/start-crawler.sh

# Start with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs crawler --lines 50
```

## 🔍 New Features

The crawler now has **automatic resource monitoring**:

- ✅ **CPU Monitoring**: Stops if CPU > 80%
- ✅ **RAM Monitoring**: Stops if RAM > 80%
- ✅ **Disk Monitoring**: Stops if disk > 85%
- ✅ **Auto-Stop**: Stops gracefully before resources are exhausted
- ✅ **SSH Protection**: Leaves enough resources for SSH access

The crawler will:
- Check resources every 10 pages
- Display resource status
- Stop automatically if thresholds are exceeded
- Log a clear message when stopping

## 📊 Monitor Resources

After starting, you can monitor:

```bash
# Check PM2 status
pm2 status

# View crawler logs (includes resource checks)
pm2 logs crawler --lines 50

# Check system resources manually
free -h    # RAM
df -h      # Disk
top        # CPU (press 'q' to exit)
```

## 🎯 What Changed

1. **Max Depth**: Reduced from 5 to 4
2. **Resource Monitoring**: Added automatic CPU/RAM/Disk checks
3. **Auto-Stop**: Crawler stops before resources are exhausted
4. **Better Logging**: Shows resource status every 10 pages

---

**The crawler will now protect your server and stop before it causes problems!** 🛡️

