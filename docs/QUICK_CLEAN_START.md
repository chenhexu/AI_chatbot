# Quick Clean Start Guide

## 🗑️ Delete All Scraped Data (On Server)

```bash
cd ~/crawler-app
rm -rf data/scraped/*
echo "✅ Data deleted"
```

## 🔄 Update & Restart

```bash
cd ~/crawler-app

# Pull latest code
git pull

# Update .env.local
nano .env.local
# Make sure: CRAWLER_MAX_DEPTH=4 and CRAWLER_RATE_LIMIT_MS=3000

# Start crawler
chmod +x start-crawler.sh
pm2 start ecosystem.config.js

# Check logs
pm2 logs crawler --lines 50
```

## ✅ What's New

- **Max Depth**: Now 4 (was 5)
- **Auto Resource Monitoring**: Stops if CPU > 80%, RAM > 80%, or Disk > 85%
- **Protects SSH**: Stops before resources are exhausted
- **Resource Reports**: Shows status every 10 pages

---

**That's it! The crawler will now protect your server automatically.** 🛡️

