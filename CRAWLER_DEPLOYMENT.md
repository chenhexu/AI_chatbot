# Crawler Deployment Options

## ⚠️ Vercel Limitations

**Vercel is NOT suitable for long-running crawlers** because:
- Serverless functions have timeout limits (10s hobby, 60s pro)
- Not designed for background jobs
- Functions are stateless and can't maintain long-running processes

## ✅ Better Options for Running Crawler on Server

### Option 1: Railway (Recommended - Easy & Free Tier)
1. Sign up at [railway.app](https://railway.app)
2. Connect your GitHub repo
3. Add environment variables
4. Deploy - Railway runs your Node.js app continuously
5. **Free tier**: $5 credit/month (usually enough for crawler)

### Option 2: Render
1. Sign up at [render.com](https://render.com)
2. Create a "Background Worker"
3. Connect your repo
4. Set build command: `npm install`
5. Set start command: `npm run crawl`
6. **Free tier**: Limited hours/month

### Option 3: DigitalOcean App Platform
1. Sign up at [digitalocean.com](https://digitalocean.com)
2. Create an App
3. Connect your repo
4. Set as background worker
5. **Paid**: ~$5/month

### Option 4: Your Own Server/VPS
- Use any VPS (Hetzner, Linode, etc.)
- Run: `npm run crawl` in a screen/tmux session
- Or use PM2: `pm2 start npm --name crawler -- run crawl`

## 🎛️ Using the Admin UI

1. **Access**: Navigate to `/admin/crawler` in your browser
2. **Configure**:
   - Max Pages: How many pages to crawl
   - Max Depth: How deep to go (1-10)
   - Rate Limit: Speed (500ms - 5000ms)
   - Skip Crawled: Skip already-crawled pages (temporary)
3. **Start/Stop**: Use buttons to control crawler
4. **Monitor**: Watch real-time status and logs

## 🚀 Quick Start (Local)

1. **Temporarily skip already-crawled pages**:
   ```bash
   SKIP_CRAWLED_PAGES=true npm run crawl
   ```

2. **Or set in `.env.local`**:
   ```
   SKIP_CRAWLED_PAGES=true
   ```

3. **Access admin UI**: `http://localhost:3000/admin/crawler`

## 📝 Notes

- The admin UI works locally or on any server
- For production, use a proper job queue (BullMQ) instead of spawning processes
- Consider using a database (PostgreSQL) to store crawler state instead of in-memory

