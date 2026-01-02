# Deploying to Azure App Service (Free Tier)

Azure App Service offers a free tier with 1 CPU core and no timeout limits, making it ideal for this chatbot application.

## Prerequisites

1. **Azure Account**: Sign up at [azure.microsoft.com](https://azure.microsoft.com) (free tier available)
2. **Azure CLI** (optional, for command-line deployment)
3. **GitHub repository** (for continuous deployment)

## Option 1: Deploy via Azure Portal (Recommended)

### Step 1: Create App Service

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"**
3. Search for **"Web App"** and select it
4. Click **"Create"**

### Step 2: Configure Basic Settings

- **Subscription**: Choose your subscription (free tier available)
- **Resource Group**: Create new or use existing
- **Name**: `ai-chatbot` (or your preferred name, must be globally unique)
- **Publish**: **Code**
- **Runtime stack**: **Node.js 20 LTS** (or Node.js 18 LTS)
- **Operating System**: **Linux** (recommended) or Windows
- **Region**: Choose closest to your users

### Step 3: Choose Free Tier Plan

1. Click **"Create new"** under App Service Plan
2. **Name**: `ai-chatbot-plan`
3. **Operating System**: Linux (or Windows)
4. **Region**: Same as above
5. **Pricing tier**: 
   - Click **"Dev/Test"** tab
   - Select **"F1 Free"** (1 GB RAM, 1 GB storage, 60 minutes/day compute)
   - Or **"B1 Basic"** ($13/month, always on, 1.75 GB RAM, 10 GB storage)
6. Click **"OK"**

### Step 4: Review and Create

1. Review all settings
2. Click **"Review + create"**
3. Click **"Create"**
4. Wait for deployment (2-3 minutes)

### Step 5: Configure Environment Variables

1. Go to your App Service in Azure Portal
2. Navigate to **Settings** → **Configuration**
3. Click **"New application setting"** for each variable:

   **Required:**
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = Your PostgreSQL connection string
   - `OPENAI_API_KEY` = Your OpenAI API key
   - `GEMINI_API_KEY` = Your Google Gemini API key
   - `GEMINI_MODEL` = `gemini-2.5-flash-lite` (optional, defaults to this)

   **Optional:**
   - `OPENAI_MODEL` = `gpt-4o-mini` (optional, defaults to this)
   - `ENABLE_SUBJECT_FILTER` = `true` or `false` (optional, defaults to `true`)
     - Set to `false` to disable category/subject filtering in RAG search
     - Useful for testing performance without classification overhead
   - `PORT` = `8080` (Azure sets this automatically, but you can override)

4. Click **"Save"** (this will restart your app)

### Step 6: Configure Deployment

**Option A: GitHub Actions (Recommended)**

1. In Azure Portal, go to **Deployment** → **Deployment Center**
2. Select **GitHub** as source
3. Authorize Azure to access your GitHub
4. Select your repository and branch (`main`)
5. Click **"Save"**
6. Azure will automatically deploy on every push

**Option B: Local Git**

1. In Azure Portal, go to **Deployment** → **Deployment Center**
2. Select **Local Git**
3. Copy the Git URL
4. In your local terminal:
   ```bash
   git remote add azure <your-azure-git-url>
   git push azure main
   ```

**Option C: ZIP Deploy**

1. Build your app locally:
   ```bash
   npm run build
   ```
2. Create a ZIP file of your project (excluding `node_modules`)
3. In Azure Portal, go to **Deployment** → **Deployment Center**
4. Select **ZIP Deploy**
5. Upload your ZIP file

### Step 7: Configure Build Settings

1. Go to **Settings** → **General settings**
2. Set **Startup Command**:
   ```
   npm start
   ```
3. Set **Always On**: **On** (if using Basic tier, free tier doesn't support this)
4. Click **"Save"**

### Step 8: Set Up PostgreSQL Database

**Option A: Azure Database for PostgreSQL (Free Tier)**

1. In Azure Portal, click **"Create a resource"**
2. Search for **"Azure Database for PostgreSQL"**
3. Select **"Flexible Server"** (has free tier)
4. Configure:
   - **Server name**: `ai-chatbot-db`
   - **Region**: Same as your app
   - **PostgreSQL version**: 15 or 16
   - **Compute + storage**: **Burstable B1ms** (free tier eligible)
   - **Storage**: 32 GB (minimum)
5. Set **Admin username** and **Password**
6. Click **"Review + create"** → **"Create"**
7. After creation, go to **Networking**
8. Add firewall rule to allow Azure services
9. Copy the connection string and add to `DATABASE_URL` in App Service

**Option B: External PostgreSQL**

- Use any PostgreSQL database (Render, Supabase, etc.)
- Add connection string to `DATABASE_URL` in App Service

### Step 9: Verify Deployment

1. Go to your App Service → **Overview**
2. Click the **URL** (e.g., `https://ai-chatbot.azurewebsites.net`)
3. You should see your Next.js app
4. Navigate to `/admin/migrate` to set up the database

## Option 2: Deploy via Azure CLI

```bash
# Install Azure CLI (if not installed)
# Windows: https://aka.ms/installazurecliwindows
# Mac: brew install azure-cli
# Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# Create resource group
az group create --name ai-chatbot-rg --location eastus

# Create App Service Plan (Free tier)
az appservice plan create \
  --name ai-chatbot-plan \
  --resource-group ai-chatbot-rg \
  --sku FREE \
  --is-linux

# Create Web App
az webapp create \
  --name ai-chatbot \
  --resource-group ai-chatbot-rg \
  --plan ai-chatbot-plan \
  --runtime "NODE:20-lts"

# Set environment variables
az webapp config appsettings set \
  --name ai-chatbot \
  --resource-group ai-chatbot-rg \
  --settings \
    NODE_ENV=production \
    DATABASE_URL="your-postgres-connection-string" \
    OPENAI_API_KEY="your-openai-key" \
    GEMINI_API_KEY="your-gemini-key"

# Configure deployment from GitHub
az webapp deployment source config \
  --name ai-chatbot \
  --resource-group ai-chatbot-rg \
  --repo-url https://github.com/yourusername/AI_Chatbot \
  --branch main \
  --manual-integration
```

## Important Notes

### Free Tier Limitations

- **F1 Free Plan**:
  - 60 minutes of compute time per day
  - App sleeps after 20 minutes of inactivity
  - 1 GB RAM
  - 1 GB storage
  - No custom domains on free tier
  - No SSL certificates (HTTPS still works with Azure's default)

- **B1 Basic Plan** ($13/month):
  - Always on (no sleep)
  - 1.75 GB RAM
  - 10 GB storage
  - Custom domains supported
  - Better for production

### Performance Tips

1. **Use Basic tier** for production (always on, no cold starts)
2. **Enable Application Insights** for monitoring
3. **Set up auto-scaling** if needed (requires Standard tier)
4. **Use Azure CDN** for static assets (optional)

### Troubleshooting

1. **App not starting**:
   - Check **Log stream** in Azure Portal
   - Check **Deployment logs** in Deployment Center
   - Verify `package.json` has correct `start` script

2. **Database connection issues**:
   - Verify `DATABASE_URL` is correct
   - Check PostgreSQL firewall rules
   - Ensure database is accessible from Azure

3. **Build failures**:
   - Check build logs in Deployment Center
   - Verify Node.js version matches runtime stack
   - Ensure all dependencies are in `package.json`

### Monitoring

1. Go to **Monitoring** → **Metrics** to see:
   - CPU usage
   - Memory usage
   - Response times
   - HTTP errors

2. Enable **Application Insights** for detailed logging

## Next Steps

After deployment:

1. **Migrate database**: Navigate to `/admin/migrate` and run migration
2. **Upload documents**: Use `/admin/upload` to add documents
3. **Test chat**: Try the chat interface to verify everything works
4. **Set up custom domain** (if using Basic tier): Go to **Custom domains** in App Service

## Cost Comparison

| Service | Plan | CPU | RAM | Always On | Cost |
|---------|------|-----|-----|-----------|------|
| **Azure F1** | Free | 1 core | 1 GB | No (sleeps) | $0/month |
| **Azure B1** | Basic | 1 core | 1.75 GB | Yes | $13/month |
| **Render** | Starter | 0.1 core | 512 MB | No | $7/month |
| **Vercel** | Hobby | 1 core | 1 GB | No (serverless) | $0/month |

Azure F1 is great for development/testing, but B1 is recommended for production due to "always on" feature.

