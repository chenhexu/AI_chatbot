# Restarting the Crawler on Server

## Check Current Status

First, check what PM2 processes are running:

```bash
pm2 list
```

This will show all PM2 processes. If `crawler` is not listed, it's not running.

## Check if Crawler Finished

The crawler might have completed and exited. Check the logs:

```bash
# Check PM2 logs
pm2 logs crawler --lines 50

# Or check log files directly
cat ~/crawler-app/logs/crawler-out.log | tail -50
cat ~/crawler-app/logs/crawler-error.log | tail -50
```

## Start the Crawler

### Option 1: Start with PM2 (Recommended)

```bash
cd ~/crawler-app

# Make sure the start script is executable
chmod +x start-crawler.sh

# Start with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs crawler --lines 50
```

### Option 2: Start Directly (for testing)

```bash
cd ~/crawler-app
npm run crawl
```

This will run in the foreground (you'll see output). Press `Ctrl+C` to stop.

## Update Code First (Important!)

Before restarting, make sure you have the latest code with CPU fixes:

```bash
cd ~/crawler-app

# If using git
git pull

# OR manually update files:
# 1. lib/crawler/crawler.ts - should have rateLimitMs: 3000
# 2. scripts/crawl-school-website.ts - should have rateLimitMs: 3000
```

## Update Environment Variables

Make sure `.env.local` has the slower rate limit:

```bash
nano ~/crawler-app/.env.local
```

Should contain:
```env
CRAWLER_START_URL=https://collegesaintlouis.ecolelachine.com/
CRAWLER_MAX_DEPTH=5
CRAWLER_MAX_PAGES=2000
CRAWLER_RATE_LIMIT_MS=3000
CRAWLER_DATA_FOLDER=./data/scraped
```

Save: `Ctrl+X`, then `Y`, then `Enter`

## Full Restart Process

```bash
# 1. Go to crawler directory
cd ~/crawler-app

# 2. Pull latest code (if using git)
git pull

# 3. Make sure start script is executable
chmod +x start-crawler.sh

# 4. Stop any existing crawler (if it exists)
pm2 stop crawler 2>/dev/null || true
pm2 delete crawler 2>/dev/null || true

# 5. Start fresh
pm2 start ecosystem.config.js

# 6. Check status
pm2 status

# 7. View logs
pm2 logs crawler --lines 50

# 8. Save PM2 configuration (so it auto-starts on reboot)
pm2 save
pm2 startup
```

## Verify It's Working

```bash
# Check PM2 status
pm2 status
# Should show "crawler" as "online"

# Check logs
pm2 logs crawler --lines 20
# Should show crawling activity

# Check CPU usage (should be low now)
# In Lightsail console, check Metrics tab
```

## Troubleshooting

### If PM2 says "script not found":

```bash
# Check if files exist
ls -la ~/crawler-app/start-crawler.sh
ls -la ~/crawler-app/ecosystem.config.js

# Make sure start script is executable
chmod +x ~/crawler-app/start-crawler.sh
```

### If crawler exits immediately:

```bash
# Check error logs
pm2 logs crawler --err --lines 50

# Try running directly to see errors
cd ~/crawler-app
npm run crawl
```

### If "npm run crawl" fails:

```bash
# Check if node_modules exists
ls -la ~/crawler-app/node_modules

# If not, install dependencies
cd ~/crawler-app
npm install
```

## Monitor After Starting

Keep an eye on:
1. **PM2 status**: `pm2 status` (should show "online")
2. **Logs**: `pm2 logs crawler` (should show crawling activity)
3. **CPU metrics** in Lightsail console (should stay low, <20%)

---

**After restarting, the crawler should run with the new CPU-friendly settings!** 🚀

