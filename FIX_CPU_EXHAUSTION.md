# Fixing CPU Exhaustion on Lightsail

## 🔴 Problem

Your crawler exhausted the CPU burst capacity on your Lightsail instance:
- CPU ran at 100% for ~4.5 hours
- Burst credits depleted to 0%
- Instance is now throttled (very slow, can't connect via SSH)

## ✅ Solution Steps

### Step 1: Restart the Instance (Recover SSH Access)

1. Go to **AWS Lightsail Console**: https://lightsail.aws.amazon.com
2. Click on your instance (`bluebank-server`)
3. Click **"Stop"** button (wait until fully stopped)
4. Click **"Start"** button (wait 2-3 minutes for it to boot)
5. Try connecting via **browser SSH** (click "Connect using SSH" button)

### Step 2: Update Crawler Code on Server

Once you can connect, update the crawler with the CPU-friendly settings:

```bash
# Connect to server
cd ~/crawler-app

# Pull latest changes (if using git)
git pull

# OR manually update the files:
# 1. Update lib/crawler/crawler.ts (rateLimitMs: 3000)
# 2. Update scripts/crawl-school-website.ts (rateLimitMs: 3000)
```

### Step 3: Update Environment Variables

Edit `.env.local` on the server:

```bash
nano ~/crawler-app/.env.local
```

Change/add these settings:

```env
# Slower rate limit to avoid CPU exhaustion
CRAWLER_RATE_LIMIT_MS=3000

# Optional: Reduce max pages if needed
CRAWLER_MAX_PAGES=1000

# Optional: Reduce depth
CRAWLER_MAX_DEPTH=4
```

Save and exit (Ctrl+X, then Y, then Enter)

### Step 4: Restart Crawler with New Settings

```bash
# Stop current crawler
pm2 stop crawler

# Restart with new settings
pm2 restart crawler

# Check logs
pm2 logs crawler --lines 50
```

### Step 5: Monitor CPU Usage

Keep an eye on CPU metrics in Lightsail console:
- Should stay below 20% average
- Burst capacity should gradually recover
- If it spikes again, increase `CRAWLER_RATE_LIMIT_MS` to 5000

## 📊 What Changed

### Before (Too Aggressive):
- Rate limit: **1000ms** (1 second between requests)
- No CPU recovery pauses
- Result: CPU at 100% → burst credits exhausted

### After (CPU-Friendly):
- Rate limit: **3000ms** (3 seconds between requests)
- **10-second pause every 20 pages** to let CPU recover
- Result: CPU stays low, burst credits can recover

## 🎯 Recommended Settings for Burstable Instances

For a **1 GB RAM, 1 vCPU burstable** Lightsail instance:

```env
# Conservative (safest)
CRAWLER_RATE_LIMIT_MS=5000
CRAWLER_MAX_PAGES=500
CRAWLER_MAX_DEPTH=4

# Balanced (recommended)
CRAWLER_RATE_LIMIT_MS=3000
CRAWLER_MAX_PAGES=1000
CRAWLER_MAX_DEPTH=5

# Aggressive (risky - may exhaust CPU again)
CRAWLER_RATE_LIMIT_MS=2000
CRAWLER_MAX_PAGES=2000
CRAWLER_MAX_DEPTH=5
```

## 🔍 Monitor Resources

After restarting, check resources:

```bash
# Check memory
free -h

# Check disk
df -h

# Check CPU usage (press 'q' to exit)
top

# Check PM2 status
pm2 status
pm2 logs crawler --lines 20
```

## ⚠️ If CPU Still Spikes

If CPU usage is still high after these changes:

1. **Increase rate limit further**:
   ```bash
   # Edit .env.local
   CRAWLER_RATE_LIMIT_MS=5000  # 5 seconds
   ```

2. **Reduce max pages**:
   ```bash
   CRAWLER_MAX_PAGES=500
   ```

3. **Reduce depth**:
   ```bash
   CRAWLER_MAX_DEPTH=3
   ```

4. **Restart crawler**:
   ```bash
   pm2 restart crawler
   ```

## 💡 Long-Term Solutions

### Option 1: Upgrade Instance (Costs More)
- Upgrade to a **non-burstable** instance (fixed CPU)
- Or upgrade to a larger burstable instance (more burst credits)

### Option 2: Run Crawler in Batches
- Crawl 200-300 pages at a time
- Stop for a few hours to let CPU recover
- Resume crawling

### Option 3: Use a Different Server
- Use a VPS with fixed CPU (not burstable)
- Examples: DigitalOcean, Linode, Hetzner

## 📈 Understanding Burst Credits

Lightsail burstable instances have:
- **Baseline CPU**: ~10-20% (always available)
- **Burst credits**: Allow 100% CPU for limited time
- **Recovery**: Credits regenerate slowly when CPU is low

**Your instance**: Ran at 100% for 4.5 hours → exhausted all credits
**Recovery time**: May take 12-24 hours of low CPU usage to fully recover

## ✅ Quick Checklist

- [ ] Restart Lightsail instance
- [ ] Connect via browser SSH
- [ ] Update crawler code (git pull or manual)
- [ ] Update `.env.local` with `CRAWLER_RATE_LIMIT_MS=3000`
- [ ] Restart PM2 crawler
- [ ] Monitor CPU metrics in Lightsail console
- [ ] Verify CPU stays below 20% average

---

**After fixing, the crawler will run slower but won't exhaust CPU!** 🎉

