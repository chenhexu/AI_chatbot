# Quick Migration Guide: Azure → Render

## Step 1: Get Your Connection Strings

### From Azure Portal:
1. Go to your Azure PostgreSQL server
2. Click "Connection strings" in the left menu
3. Copy the **PostgreSQL** connection string
4. It looks like:
   ```
   postgresql://ai_chatbot_admin:YourPassword@ai-chatbot-db-chenhexu.postgres.database.azure.com:5432/postgres?sslmode=require
   ```

### From Render Dashboard:
1. Go to your new PostgreSQL database
2. Find the **Connection strings** section
3. Copy the **Internal Database URL** (for migration)
   - Looks like: `postgresql://user:password@hostname:5432/dbname`
4. Also copy the **External Connection String** (for your app later)

## Step 2: Run Migration

Open PowerShell in your project directory and run:

```powershell
# Set Azure database URL (source)
$env:AZURE_DATABASE_URL = "postgresql://ai_chatbot_admin:YourPassword@ai-chatbot-db-chenhexu.postgres.database.azure.com:5432/postgres?sslmode=require"

# Set Render database URL (target) - use the Internal Database URL
$env:RENDER_DATABASE_URL = "postgresql://user:password@render-hostname:5432/dbname"

# Run migration
npm run migrate-azure-to-render
```

**Important Notes:**
- Replace `YourPassword` with your actual Azure password (URL-encode special characters like `!` as `%21`)
- Use the **Internal Database URL** from Render for migration
- The migration will take 5-30 minutes depending on your data size
- Don't close the terminal during migration

## Step 3: Verify Migration

The script will show:
- ✅ Number of documents migrated
- ✅ Number of chunks migrated (with classification data)
- ✅ Final counts in target database

Check that the numbers match your Azure database.

## Step 4: Update Your App

### If deploying to Render:
1. Go to your Render service dashboard
2. Go to "Environment" tab
3. Find `DATABASE_URL`
4. Update it to the **External Connection String** from Render
5. Save (app will restart)

### If deploying elsewhere:
Update your `DATABASE_URL` environment variable to the Render External Connection String.

## Step 5: Test

1. Check health: `https://your-app.com/api/health`
2. Test a query that uses classification
3. Verify chunks have `subject` values in the database

## Troubleshooting

**Connection timeout:**
- Make sure you're using the Internal Database URL for migration
- Check that your IP is allowed (Render free tier may have restrictions)

**SSL errors:**
- Azure requires `?sslmode=require` in connection string
- Render usually doesn't need SSL parameters

**Migration slow:**
- Normal for large databases
- 0.1 CPU on free tier is slow, be patient
- Consider running during off-peak hours
