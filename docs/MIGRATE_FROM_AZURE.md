# Migrating Database from Azure to Render/Other PostgreSQL

This guide helps you migrate your AI chatbot database from Azure PostgreSQL to Render or another PostgreSQL provider before stopping your Azure subscription.

## Why Migrate?

- **Preserve classification data**: Your `chunks.subject` column contains valuable AI-generated classifications
- **Cost savings**: Move to a cheaper/free tier database
- **Avoid data loss**: Don't lose months of classification work

## Step 1: Estimate Your Database Size

First, check if 1GB storage is enough for your database:

```bash
# Set your Azure database URL
$env:DATABASE_URL = "postgresql://user:password@azure-host:5432/database"

# Run the estimation script
npm run estimate-db-size
```

This will show you:
- Current database size
- Table sizes
- Whether 1GB is sufficient
- Growth estimates

### Storage Requirements

**Typical sizes:**
- Small chatbot: 50-200 MB
- Medium chatbot: 200-500 MB
- Large chatbot: 500 MB - 1 GB+

**1GB is usually enough if:**
- You have < 100,000 chunks
- Average chunk size < 10 KB
- You're not storing very large PDFs

## Step 2: Choose Your Database Provider

### Option A: Render PostgreSQL (Recommended for simplicity)

**Free Tier:**
- ✅ 1GB storage
- ✅ 0.1 CPU (shared)
- ✅ Free forever
- ⚠️ Limited to 1GB, may need upgrade later

**Starter Tier ($7/month):**
- ✅ 1GB storage
- ✅ 0.5 CPU
- ✅ Better performance than free tier

**Pros:**
- Easy setup with `render.yaml`
- Automatic connection string injection
- Good for small-medium chatbots

**Cons:**
- 0.1 CPU on free tier is very slow
- Limited storage on free tier

### Option B: Supabase (Recommended for performance)

**Free Tier:**
- ✅ 500MB storage
- ✅ 0.25 CPU
- ✅ Free forever
- ✅ Better performance than Render free tier

**Pro Tier ($25/month):**
- ✅ 8GB storage
- ✅ 2 CPU
- ✅ Much better performance

**Pros:**
- Better free tier performance
- More storage on paid tier
- Good developer experience

**Cons:**
- Free tier only 500MB (may not be enough)
- Paid tier more expensive than Render

### Option C: Neon (Recommended for storage)

**Free Tier:**
- ✅ 3GB storage
- ✅ 0.25 CPU
- ✅ Free forever
- ✅ Best free tier storage

**Pros:**
- Most storage on free tier (3GB)
- Good performance
- Serverless PostgreSQL

**Cons:**
- Newer service (less established)
- May have connection limits on free tier

### Option D: Railway

**Hobby Tier ($5/month):**
- ✅ 1GB storage
- ✅ 0.5 CPU
- ✅ Good performance

**Pros:**
- Affordable
- Good performance
- Easy setup

**Cons:**
- Not free
- Limited storage

## Step 3: Create Target Database

### For Render:

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "PostgreSQL"
3. Choose:
   - **Name**: `ai-chatbot-db`
   - **Plan**: Free (or Starter for $7/month)
   - **Region**: Choose closest to your app
4. Click "Create Database"
5. Copy the **Internal Database URL** (for migration)
6. Copy the **External Connection String** (for your app)

### For Supabase:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project
3. Go to Settings → Database
4. Copy the **Connection string** (URI format)

### For Neon:

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project
3. Copy the **Connection string**

## Step 4: Run Migration

### Prerequisites

Install dependencies if needed:
```bash
npm install
```

### Migration Steps

1. **Set environment variables:**

```powershell
# Azure database (source)
$env:AZURE_DATABASE_URL = "postgresql://user:password@azure-host:5432/database"

# Target database (Render/Supabase/Neon)
$env:TARGET_DATABASE_URL = "postgresql://user:password@target-host:5432/database"
# OR use RENDER_DATABASE_URL if migrating to Render
$env:RENDER_DATABASE_URL = "postgresql://user:password@render-host:5432/database"
```

2. **Run the migration script:**

```bash
npm run migrate-azure-to-render
```

This will:
- ✅ Connect to both databases
- ✅ Create schema in target database
- ✅ Copy all documents
- ✅ Copy all chunks **WITH classification data** (subject column)
- ✅ Copy failed classifications
- ✅ Preserve existing data (won't duplicate)

**Migration time:**
- Small DB (< 10K chunks): 1-5 minutes
- Medium DB (10K-50K chunks): 5-15 minutes
- Large DB (50K+ chunks): 15-60 minutes

3. **Verify migration:**

Check the final counts printed by the script. They should match your Azure database.

## Step 5: Update Your Application

### For Render Deployment:

1. Go to your Render service dashboard
2. Go to "Environment" tab
3. Update `DATABASE_URL` to your new database connection string
4. Save (this will restart your app)

### For Other Deployments:

Update your `DATABASE_URL` environment variable to point to the new database.

## Step 6: Test Your Application

1. **Check health endpoint:**
   ```
   https://your-app.com/api/health
   ```
   Should show database connected.

2. **Test classification:**
   - Ask a question that requires classification
   - Check logs to see if subject filtering works
   - Verify chunks have `subject` values

3. **Check database stats:**
   ```
   https://your-app.com/api/db-stats
   ```
   Should show your migrated data.

## Step 7: Stop Azure Subscription

Once you've verified everything works:

1. Go to Azure Portal
2. Navigate to your subscription
3. Cancel/stop the subscription
4. **Wait 24-48 hours** before final deletion (in case you need to recover)

## Troubleshooting

### Migration fails with "connection timeout"

- Check firewall rules on target database
- For Azure: Ensure "Allow Azure services" is enabled
- For Render: Use internal connection string during migration
- For Supabase/Neon: Check IP allowlist

### "SSL required" error

- Azure requires SSL: `?sslmode=require`
- Render: Usually not required
- Supabase/Neon: Check connection string format

### Classification data missing

- Check that `chunks.subject` column exists in target
- Verify migration script completed successfully
- Check logs for any errors during chunk migration

### Database size exceeds 1GB

- Consider upgrading to a paid tier
- Or migrate to Neon (3GB free tier)
- Or clean up old/unused data first

## Performance Considerations (0.1 CPU)

If your target database has 0.1 CPU (Render free tier):

**What to expect:**
- ⚠️ Slow queries (2-10 seconds for complex queries)
- ⚠️ Limited concurrent connections
- ⚠️ May timeout on large operations

**Optimizations:**
- Use indexes (already created by schema)
- Limit batch sizes in classification
- Consider upgrading to 0.5 CPU if too slow

**When to upgrade:**
- Query times > 5 seconds consistently
- Frequent timeouts
- Multiple users accessing simultaneously

## Cost Comparison

| Provider | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| Render | 1GB, 0.1 CPU | $7/mo: 1GB, 0.5 CPU | Simple setup |
| Supabase | 500MB, 0.25 CPU | $25/mo: 8GB, 2 CPU | Better performance |
| Neon | 3GB, 0.25 CPU | $19/mo: 10GB, 1 CPU | Most storage |
| Railway | None | $5/mo: 1GB, 0.5 CPU | Affordable paid |

## Next Steps

After migration:
1. ✅ Monitor database size growth
2. ✅ Set up database backups (if not automatic)
3. ✅ Test classification performance
4. ✅ Update documentation with new connection info
5. ✅ Cancel Azure subscription

## Need Help?

- Check migration script logs for detailed error messages
- Verify connection strings are correct
- Test database connections separately before migration
- Check provider documentation for connection requirements
