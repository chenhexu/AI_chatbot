# Check Server Resources Before Starting Crawler

## 🔍 Quick Resource Check Commands

Run these commands on your Lightsail server to see current usage:

### 1. Check Total RAM and Current Usage

```bash
# See total RAM, used, free, and available
free -h

# More detailed view
cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable"
```

**What to look for:**
- `MemTotal`: Total RAM (should be ~1GB on your instance)
- `MemAvailable`: Available RAM for new processes
- Your crawler needs: ~100-200 MB RAM

### 2. Check Storage Usage

```bash
# See disk usage for entire system
df -h

# See disk usage for your home directory
du -sh ~/*

# See disk usage for your other project (if you know where it is)
# Replace /path/to/other/project with actual path
du -sh /path/to/other/project
```dddddddddddddd 

**What to look for:**
- Total disk: 40 GB (from your Lightsail specs)
- Available space: Should show in `df -h`
- Crawler will use: ~100-500 MB for code, potentially several GB for scraped data

### 3. Check Running Processes (Your Other Project)

```bash
# See all running processes with RAM usage
ps aux --sort=-%mem | head -20

# See processes using most CPU
top -b -n 1 | head -20

# Check if PM2 is running (for your other project)
pm2 list

# See PM2 process memory usage
pm2 monit
```

**What to look for:**
- Processes from your other project
- Their RAM usage (RSS column)
- Total RAM used by all processes

### 4. Check Your Other Project Specifically

```bash
# If your other project uses PM2
pm2 list
pm2 show <your-project-name>  # Shows detailed memory usage

# If your other project runs as a service
systemctl status <your-service-name>

# Find your other project's directory and check its size
find ~ -maxdepth 2 -type d -name "*project*" 2>/dev/null
# Then check size:
du -sh ~/path/to/other/project
```

### 5. Estimate Crawler Storage Needs

```bash
# Check how much space is available
df -h ~

# Estimate:
# - Code: ~50 MB
# - node_modules: ~200-300 MB
# - Scraped data: 
#   * Pages: ~1-5 MB per 100 pages
#   * PDFs: ~1-10 MB each
#   * Total estimate: 500-2000 pages = 5-25 MB pages + PDFs could be 50-500 MB
#   * Total: ~100 MB - 1 GB for typical crawl
```

## 📊 Complete Resource Check Script

Run this all-in-one command:

```bash
echo "=== SYSTEM RESOURCES ===" && \
echo "RAM:" && free -h && \
echo -e "\n=== DISK USAGE ===" && \
df -h && \
echo -e "\n=== TOP PROCESSES (by RAM) ===" && \
ps aux --sort=-%mem | head -10 && \
echo -e "\n=== PM2 PROCESSES ===" && \
pm2 list 2>/dev/null || echo "PM2 not installed or no processes" && \
echo -e "\n=== HOME DIRECTORY SIZE ===" && \
du -sh ~/* 2>/dev/null | sort -h
```

## 🎯 What You Need

### Your Lightsail Instance:
- **RAM**: 1 GB total
- **Storage**: 40 GB total

### Crawler Requirements:
- **RAM**: ~100-200 MB (very lightweight)
- **Storage**: 
  - Code: ~50 MB
  - Dependencies: ~300 MB
  - Scraped data: ~100 MB - 1 GB (depends on how much it crawls)

### Safe Limits:
- **Available RAM**: Should have at least 200-300 MB free for crawler
- **Available Storage**: Should have at least 5 GB free (for safety)

## ⚠️ If Resources Are Low

If you're running low on resources:

1. **Clean up old files:**
```bash
# Remove old logs
sudo journalctl --vacuum-time=7d

# Remove old package cache
sudo apt-get clean

# Remove unused packages
sudo apt-get autoremove
```

2. **Limit crawler memory:**
   - Already set in `ecosystem.config.js`: `max_memory_restart: '500M'`
   - This will restart crawler if it uses more than 500 MB

3. **Monitor while running:**
```bash
# Watch resources in real-time
watch -n 2 'free -h && echo && df -h ~'
```

## ✅ Quick Check Before Starting

Run this quick check:

```bash
# Check if you have enough resources
FREE_RAM=$(free -m | awk 'NR==2{printf "%.0f", $7}')
FREE_DISK=$(df -h ~ | awk 'NR==2 {print $4}')

echo "Available RAM: ${FREE_RAM} MB"
echo "Available Disk: ${FREE_DISK}"

if [ "$FREE_RAM" -lt 200 ]; then
  echo "⚠️  WARNING: Low RAM! Only ${FREE_RAM} MB available"
else
  echo "✅ RAM looks good"
fi
```

## 📝 Notes

- The crawler is lightweight and won't use much RAM
- Storage depends on how much content it crawls
- Your other project should be fine - crawler runs independently
- PM2 will auto-restart crawler if it uses too much memory (500 MB limit)



