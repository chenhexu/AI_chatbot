# Troubleshooting Lightsail SSH Connection Issues

## 🔍 Quick Diagnosis

If you can't connect to your Lightsail instance after leaving it running, follow these steps:

## Step 1: Check Instance Status in AWS Console

1. Go to **AWS Lightsail Console**: https://lightsail.aws.amazon.com
2. Click on your instance (e.g., `bluebank-server`)
3. Check the **Status**:
   - ✅ **Running** = Instance is up, but SSH might be down
   - ⚠️ **Stopped** = Instance was shut down (needs restart)
   - ❌ **Pending** = Instance is starting up
   - 🔴 **Error** = Instance has a problem

## Step 2: Check Instance Metrics

In the Lightsail console, check the **Metrics** tab:
- **CPU Utilization** - Should be < 100%
- **Memory Utilization** - Should be < 100%
- **Network In/Out** - Should show activity if crawler is running
- **Disk Usage** - Should be < 100%

**If CPU or Memory is at 100%**, the instance might be overloaded.

## Step 3: Try Alternative Connection Methods

### Option A: Use Lightsail Browser SSH (Recommended First)

1. In Lightsail console, click your instance
2. Click **"Connect using SSH"** button (top right)
3. This uses AWS's built-in terminal (bypasses local SSH issues)

### Option B: Restart the Instance

If the browser SSH also fails:

1. In Lightsail console, click your instance
2. Click **"Stop"** (wait for it to fully stop)
3. Click **"Start"** (wait 1-2 minutes for it to boot)
4. Try connecting again

⚠️ **Warning**: Restarting will temporarily stop the crawler, but PM2 should auto-restart it.

### Option C: Use Local SSH (if you have SSH key)

```bash
# From your local Windows machine
ssh -i path/to/your-key.pem ubuntu@99.79.69.130

# Or if using default Windows SSH
ssh ubuntu@99.79.69.130
```

## Step 4: Check What Happened (After Reconnecting)

Once you can connect, check:

```bash
# Check if PM2 is running
pm2 list

# Check crawler status
pm2 logs crawler --lines 50

# Check system resources
free -h                    # RAM usage
df -h                      # Disk space
top                        # CPU/Memory usage (press 'q' to exit)

# Check if disk is full
du -sh ~/crawler-app/data/*

# Check system logs for errors
sudo journalctl -u ssh -n 50
dmesg | tail -20
```

## Common Issues & Solutions

### Issue 1: Instance Ran Out of Memory

**Symptoms**: Can't connect, CPU/Memory at 100%

**Solution**:
```bash
# After reconnecting, check what's using memory
ps aux --sort=-%mem | head -10

# Restart PM2 processes
pm2 restart all

# Or restart the crawler only
pm2 restart crawler
```

### Issue 2: Disk Full

**Symptoms**: Can't save files, connection drops

**Solution**:
```bash
# Check disk usage
df -h

# If disk is full, clean up old data
# Check crawler data size
du -sh ~/crawler-app/data

# If too large, you might need to:
# 1. Delete old crawled data
# 2. Or increase instance storage (costs money)
```

### Issue 3: SSH Service Crashed

**Symptoms**: Instance is running but can't connect

**Solution**: Restart the instance (see Step 3, Option B)

### Issue 4: Network/Firewall Issue

**Symptoms**: Connection timeout

**Solution**:
1. Check Lightsail **Networking** tab
2. Ensure SSH port (22) is open
3. Try restarting the instance

## Step 5: Prevent Future Issues

### Monitor Resources Regularly

```bash
# Set up a simple monitoring script
cat > ~/check-resources.sh << 'EOF'
#!/bin/bash
echo "=== Resource Check ==="
echo "Memory:"
free -h
echo ""
echo "Disk:"
df -h
echo ""
echo "Top processes:"
ps aux --sort=-%mem | head -5
EOF

chmod +x ~/check-resources.sh

# Run it periodically
~/check-resources.sh
```

### Set Up PM2 Auto-Restart Limits

```bash
# Prevent infinite restart loops
pm2 set pm2:autodump true
```

### Monitor Crawler Data Size

```bash
# Check data folder size
du -sh ~/crawler-app/data

# If it's getting too large (> 5GB), consider:
# 1. Reducing maxPages in crawler config
# 2. Cleaning old data periodically
# 3. Upgrading instance storage
```

## 🆘 Emergency Recovery

If nothing works:

1. **Stop the instance** in Lightsail console
2. **Take a snapshot** (backup) before doing anything risky
3. **Start the instance** again
4. **Reconnect and check logs**:
   ```bash
   pm2 logs crawler --lines 100
   ```

## 📊 Check Crawler Status (After Reconnecting)

```bash
# Check if crawler is still running
pm2 status

# View recent logs
pm2 logs crawler --lines 100

# Check how many pages were crawled
ls -la ~/crawler-app/data/scraped/ | wc -l
ls -la ~/crawler-app/data/external/ | wc -l
ls -la ~/crawler-app/data/pdf/ | wc -l
```

## 💡 Quick Fixes

### If Instance is Running but SSH Fails:

1. **Wait 2-3 minutes** (sometimes temporary network issues)
2. **Try browser SSH** in Lightsail console
3. **Restart instance** if browser SSH also fails

### If Crawler Stopped:

```bash
# After reconnecting, restart it
cd ~/crawler-app
pm2 restart crawler

# Or start it fresh
pm2 start ecosystem.config.js
```

---

## Next Steps

1. ✅ Check instance status in Lightsail console
2. ✅ Try browser SSH first
3. ✅ If that fails, restart the instance
4. ✅ After reconnecting, check PM2 and crawler logs
5. ✅ Verify crawler is still running

Let me know what you find!

