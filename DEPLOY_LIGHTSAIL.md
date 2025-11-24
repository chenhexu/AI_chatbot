# Deploying Crawler to AWS Lightsail

## 🎯 Safe Deployment (Won't Mess Up Your Other Project)

We'll deploy the crawler in a completely isolated way:
- Separate directory
- Separate Node.js process
- Can be started/stopped independently
- Won't interfere with your existing project

## 📋 Prerequisites

Your Lightsail instance:
- ✅ Ubuntu (from screenshot)
- ✅ 1 GB RAM, 1 vCPU (should be enough for crawler)
- ✅ SSH access

## 🚀 Step-by-Step Deployment

### 1. Connect to Your Server

```bash
ssh ubuntu@99.79.69.130
# Or use the Lightsail browser SSH
```

### 2. Create Isolated Directory

```bash
# Create a separate directory for the crawler
mkdir -p ~/crawler-app
cd ~/crawler-app
```

### 3. Check Server Resources (Optional but Recommended)

Before starting, check if you have enough resources:

```bash
# Quick resource check
free -h                    # Check RAM
df -h                      # Check disk space
ps aux --sort=-%mem | head -10  # Check running processes
pm2 list                   # Check PM2 processes (if your other project uses it)
```

**See `CHECK_RESOURCES.md` for detailed resource checking guide.**

### 4. Install Node.js (if not already installed)

```bash
# Check if Node.js is installed
node --version

# If not installed, install Node.js 20.x (LTS - recommended)
# Or use 24.x for latest version
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

**Note**: If you see deprecation warnings, you can use Node.js 20.x (LTS) or 24.x (current). Both work fine.

### 5. Clone/Upload Your Project

**Option A: Use Lightsail Browser SSH (Easiest)**
1. Go to Lightsail console → Connect tab
2. Click "Connect using SSH" (browser-based)
3. In the browser terminal, run:
```bash
mkdir -p ~/crawler-app
cd ~/crawler-app
```
4. Then use one of the methods below to get your code there

**Option B: Upload via SCP with SSH Key (Windows)**
1. Download the SSH key from Lightsail:
   - In Lightsail console → Connect tab
   - Click "Download default key"
   - Save it (e.g., to `C:\Users\YourName\.ssh\lightsail-key.pem`)

2. Set correct permissions (if needed):
```powershell
# In PowerShell (run as Administrator if needed)
icacls "C:\Users\YourName\.ssh\lightsail-key.pem" /inheritance:r
icacls "C:\Users\YourName\.ssh\lightsail-key.pem" /grant:r "%username%:R"
```

3. Upload using the key:
```powershell
cd C:\Projects\AI_Chatbot
scp -i C:\Users\YourName\.ssh\lightsail-key.pem -r . ubuntu@99.79.69.130:~/crawler-app/
```

**Option C: Use Git (Recommended - Easiest)**
1. Push your code to GitHub (if not already):
```bash
git add .
git commit -m "Add crawler deployment files"
git push
```

2. On server (via Lightsail browser SSH):
```bash
cd ~/crawler-app
git clone https://github.com/yourusername/AI_Chatbot.git .
# Or if repo is private:
git clone https://your-token@github.com/yourusername/AI_Chatbot.git .
```

**Option D: Use WinSCP (GUI Tool)**
1. Download WinSCP: https://winscp.net/
2. Connect with:
   - Host: 99.79.69.130
   - Username: ubuntu
   - Private key: Use the downloaded Lightsail key
3. Drag and drop files to `~/crawler-app/`

### 6. Install Dependencies

```bash
cd ~/crawler-app
npm install
```

### 7. Set Up Environment Variables

```bash
# Create .env.local file
nano .env.local
```

Add your environment variables:
```env
CRAWLER_START_URL=https://collegesaintlouis.ecolelachine.com/
CRAWLER_MAX_PAGES=2000
CRAWLER_MAX_DEPTH=5
CRAWLER_RATE_LIMIT_MS=1000
CRAWLER_DATA_FOLDER=./data/scraped
SKIP_CRAWLED_PAGES=true
```

Save and exit (Ctrl+X, then Y, then Enter)

### 8. Install PM2 (Process Manager)

PM2 will keep the crawler running even if you disconnect:

```bash
sudo npm install -g pm2
```

### 9. Create PM2 Configuration

```bash
nano ecosystem.config.js
```

Add this content:
```javascript
module.exports = {
  apps: [{
    name: 'crawler',
    script: 'npm',
    args: 'run crawl',
    cwd: '/home/ubuntu/crawler-app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

### 10. Start the Crawler

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs crawler

# Save PM2 configuration (so it auto-starts on reboot)
pm2 save
pm2 startup
```

### 11. Monitor the Crawler

```bash
# View real-time logs
pm2 logs crawler

# View status
pm2 status

# Stop crawler
pm2 stop crawler

# Restart crawler
pm2 restart crawler

# View resource usage
pm2 monit
```

## 🛠️ Useful Commands

### Stop Crawler
```bash
pm2 stop crawler
```

### Start Crawler
```bash
pm2 start crawler
```

### Restart Crawler
```bash
pm2 restart crawler
```

### View Logs
```bash
pm2 logs crawler --lines 100
```

### Check Crawled Data
```bash
ls -lh ~/crawler-app/data/scraped/pages/ | wc -l  # Count pages
ls -lh ~/crawler-app/data/scraped/pdfs/ | wc -l   # Count PDFs
```

## 🔒 Safety Features

✅ **Isolated Directory**: Everything in `~/crawler-app/` - won't touch your other project
✅ **PM2 Process Manager**: Runs independently, won't interfere
✅ **Resource Limits**: PM2 will restart if memory gets too high
✅ **Easy to Stop**: Just `pm2 stop crawler` anytime

## 📊 Resource Usage

With 1 GB RAM:
- Crawler uses ~100-200 MB RAM
- Your other project should be fine
- If needed, you can limit crawler memory in `ecosystem.config.js`

## 🔄 Updating the Crawler

```bash
cd ~/crawler-app
git pull  # If using Git
# Or re-upload files via SCP

npm install  # Update dependencies
pm2 restart crawler  # Restart with new code
```

## 🚨 If Something Goes Wrong

```bash
# Stop everything
pm2 stop all

# Check what's running
pm2 list

# Delete crawler process
pm2 delete crawler

# Your other project is safe - it's in a different directory!
```

## 💡 Optional: Access Admin UI

If you want to access the admin UI from your server:

1. **Install the Next.js app** (if you want the UI):
```bash
cd ~/crawler-app
npm run build
pm2 start npm --name "chatbot" -- start
```

2. **Set up reverse proxy** (nginx) to access it:
```bash
sudo apt install nginx
# Configure nginx to proxy to your Next.js app
```

But for just the crawler, you don't need the UI - PM2 logs are enough!

## ✅ Verification

After setup, verify:
```bash
# Check crawler is running
pm2 status

# Check it's creating files
ls ~/crawler-app/data/scraped/pages/ | head -5

# Check logs
pm2 logs crawler --lines 20
```

Your other project is completely safe - everything is isolated in `~/crawler-app/`!

## 💰 Cost Management & Billing Alerts

**Important:** Set up billing alerts to avoid surprise charges!

See `AWS_BILLING_ALERTS.md` for complete instructions on:
- Setting up billing alerts (50%, 75%, 90%, 100% thresholds)
- Email notifications to monitor costs in real-time
- Cost budgets and resource usage monitoring
- AWS mobile app setup

**Quick setup:**
1. AWS Console → Billing → Billing preferences → Enable "Receive Billing Alerts"
2. CloudWatch → Create billing alarms
3. Subscribe your dad's email to receive alerts
4. Set up cost budgets for detailed tracking

This will prevent surprise charges like the $30 incident!

