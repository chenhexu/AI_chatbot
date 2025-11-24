# Quick Upload Guide - Fix SSH Key Issue

## The Problem
You're getting "Permission denied (publickey)" because Windows SCP doesn't know which SSH key to use.

## ✅ Easiest Solution: Use Git

### Step 1: Push to GitHub (if not already)
```powershell
cd C:\Projects\AI_Chatbot
git add .
git commit -m "Ready for deployment"
git push
```

### Step 2: On Your Server (via Lightsail Browser SSH)
1. Go to Lightsail console → Your instance → Connect tab
2. Click "Connect using SSH" (opens browser terminal)
3. Run these commands:
```bash
mkdir -p ~/crawler-app
cd ~/crawler-app
git clone https://github.com/YOUR_USERNAME/AI_Chatbot.git .
# Replace YOUR_USERNAME with your GitHub username
```

### Step 3: Continue with Setup
```bash
npm install
# ... rest of setup from DEPLOY_LIGHTSAIL.md
```

---

## Alternative: Fix SCP with SSH Key

### Step 1: Download SSH Key from Lightsail
1. In Lightsail console → Connect tab
2. Click "Download default key"
3. Save it somewhere (e.g., `C:\Users\YourName\Downloads\lightsail-key.pem`)

### Step 2: Use SCP with Key
```powershell
cd C:\Projects\AI_Chatbot
scp -i C:\Users\YourName\Downloads\lightsail-key.pem -r . ubuntu@99.79.69.130:~/crawler-app/
```

**Note**: If you get permission errors on the key file:
```powershell
# Remove inheritance and set permissions
icacls "C:\Users\YourName\Downloads\lightsail-key.pem" /inheritance:r
icacls "C:\Users\YourName\Downloads\lightsail-key.pem" /grant:r "%username%:R"
```

---

## Alternative: Use WinSCP (GUI - Easiest for Windows)

1. Download WinSCP: https://winscp.net/eng/download.php
2. Install and open
3. New Session:
   - **File protocol**: SFTP
   - **Host name**: 99.79.69.130
   - **User name**: ubuntu
   - **Advanced** → **SSH** → **Authentication**:
     - Check "Allow agent forwarding"
     - **Private key file**: Browse to your downloaded Lightsail key
4. Click "Login"
5. Navigate to `~/crawler-app/` (or create it)
6. Drag and drop your project files

---

## Recommended: Git Method
The Git method is easiest because:
- ✅ No SSH key configuration needed
- ✅ Easy to update later (`git pull`)
- ✅ Works from browser SSH
- ✅ No file permission issues

