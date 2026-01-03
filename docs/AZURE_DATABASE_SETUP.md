# Setting Up Azure Database for PostgreSQL

This guide will help you create an Azure PostgreSQL database and migrate your data from Render.

## Step 1: Create Azure Database for PostgreSQL

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"**
3. Search for **"Azure Database for PostgreSQL"**
4. Click **"Create"**
5. Select **"Flexible server"** (recommended - more cost-effective)

### Configure Basic Settings

- **Subscription**: Your subscription
- **Resource Group**: Same as your App Service (or create new)
- **Server name**: `ai-chatbot-db` (must be globally unique)
- **Region**: Same region as your App Service (Canada Central)
- **PostgreSQL version**: **16** (or latest available)
- **Workload type**: **Development** (for free tier) or **Production**

### Configure Compute + Storage

- **Compute tier**: 
  - **Burstable** (cheapest, good for development)
  - **General Purpose** (better performance, more expensive)
- **Compute size**:
  - **B1ms** (1 vCore, 2 GB RAM) - ~$12/month
  - **B1s** (1 vCore, 1 GB RAM) - ~$6/month (cheapest)
- **Storage**: Start with **32 GB** (minimum, can increase later)

### Configure Networking

1. **Networking** tab:
   - **Connectivity method**: **Public access** (required for App Service)
   - **Firewall rules**: 
     - Click **"Add current client IP address"** (for your local access)
     - **Allow public access from Azure services**: **Yes** (important!)
     - This allows your App Service to connect

### Configure Security

1. **Security** tab:
   - **Authentication method**: **PostgreSQL authentication** (password)
   - **Admin username**: `ai_chatbot_admin` (or your choice)
   - **Password**: Create a strong password (save it!)
   - **Enable SSL enforcement**: **Enabled** (recommended)

### Review and Create

1. Review all settings
2. Click **"Review + create"**
3. Click **"Create"**
4. Wait for deployment (5-10 minutes)

## Step 2: Get Connection String

1. Go to your PostgreSQL server in Azure Portal
2. Click **"Connection strings"** in the left menu
3. Copy the **"JDBC"** or **"psql"** connection string
4. It will look like:
   ```
   postgresql://ai_chatbot_admin@ai-chatbot-db:YOUR_PASSWORD@ai-chatbot-db.postgres.database.azure.com:5432/postgres
   ```

**Or construct it manually:**
```
postgresql://ai_chatbot_admin:YOUR_PASSWORD@ai-chatbot-db.postgres.database.azure.com:5432/postgres?sslmode=require
```

## Step 3: Update Azure App Service Configuration

1. Go to your App Service in Azure Portal
2. Click **"Configuration"** → **"Application settings"**
3. Find `DATABASE_URL` and click **"Edit"**
4. Replace the Render connection string with your Azure connection string
5. Click **"OK"** → **"Save"** (this restarts your app)

## Step 4: Initialize Database Schema

The app will automatically create the schema on first connection, but you can also do it manually:

1. Go to your App Service → **"Console"** or **"SSH"**
2. Or use Azure Portal → PostgreSQL server → **"Query editor"**
3. Or use a local PostgreSQL client with the connection string

The schema will be created automatically when the app starts and tries to connect.

## Step 5: Migrate Data from Render (Optional)

If you have existing data in Render's database, you can migrate it:

### Option A: Using pg_dump and psql (Recommended)

1. **Export from Render** (on your local machine):
   ```bash
   # Install PostgreSQL client tools if needed
   # Windows: Download from postgresql.org
   # Or use WSL/Windows Subsystem for Linux
   
   pg_dump "YOUR_RENDER_DATABASE_URL" > render_backup.sql
   ```

2. **Import to Azure**:
   ```bash
   psql "YOUR_AZURE_DATABASE_URL" < render_backup.sql
   ```

### Option B: Using Azure Portal Query Editor

1. Export data from Render using pgAdmin or psql
2. Go to Azure Portal → Your PostgreSQL server → **"Query editor"**
3. Paste and run the SQL statements

### Option C: Use the Migration Endpoint

1. Keep your Render `DATABASE_URL` temporarily
2. Visit your Azure app: `https://your-app.azurewebsites.net/admin/migrate`
3. Click **"Migrate Documents"** - this will copy data from Render to Azure
4. Then update `DATABASE_URL` to point to Azure

## Step 6: Verify Connection

1. Visit: `https://your-app.azurewebsites.net/api/health`
2. Check the response - it should show:
   ```json
   {
     "status": "ok",
     "database": {
       "url_set": true,
       "connected": true,
       "chunks_count": 532,
       "documents_count": 10
     }
   }
   ```

## Cost Considerations

### Free Tier Options

Azure doesn't offer a completely free PostgreSQL tier, but:

- **B1s Burstable**: ~$6/month (1 vCore, 1 GB RAM, 32 GB storage)
- **B1ms Burstable**: ~$12/month (1 vCore, 2 GB RAM, 32 GB storage)

### Cost Optimization Tips

1. **Use Burstable tier** for development/testing
2. **Stop the database** when not in use (can restart later)
3. **Use smaller storage** initially (32 GB minimum)
4. **Monitor usage** in Azure Portal → Cost Management

## Troubleshooting

### Connection Issues

1. **Check firewall rules**:
   - Azure Portal → PostgreSQL server → **"Networking"**
   - Ensure **"Allow public access from Azure services"** is enabled
   - Add your App Service's outbound IP if needed

2. **Check SSL**:
   - Azure requires SSL by default
   - Connection string should include `?sslmode=require`

3. **Check credentials**:
   - Verify username and password are correct
   - Username format: `username@servername`

### Performance Issues

1. **Upgrade compute tier** if needed
2. **Add indexes** (app does this automatically)
3. **Monitor metrics** in Azure Portal

## Next Steps

After setting up Azure database:

1. ✅ Update `DATABASE_URL` in App Service
2. ✅ Verify connection via `/api/health`
3. ✅ Migrate data if needed
4. ✅ Test the chatbot
5. ✅ Update Render database URL (optional - can keep as backup)

