# Deployment Guide

This guide will help you deploy the AI chatbot to your school website.

## Deployment Options

### Option 1: Vercel (Recommended - Easiest for Next.js)

Vercel is the easiest way to deploy Next.js applications:

1. **Install Vercel CLI** (optional, can also use web interface):
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```
   Or use the web interface at [vercel.com](https://vercel.com)

3. **Set Environment Variables** in Vercel dashboard:
   - Go to your project → Settings → Environment Variables
   - Add all variables from `.env.local`:
     - `OPENAI_API_KEY`
     - `OPENAI_MODEL`
     - `GOOGLE_SERVICE_ACCOUNT_KEY` (see special handling below)
     - `GOOGLE_DOC_FULL_ID`

4. **Service Account JSON File**:
   - Option A: Convert JSON to environment variable (recommended)
     - Copy the entire JSON content
     - In Vercel, create environment variable `GOOGLE_SERVICE_ACCOUNT_JSON` with the full JSON as value
     - Update code to read from env var instead of file (see below)
   - Option B: Use Vercel's file storage or secrets manager

### Option 2: Self-Hosted Server

If you have your own server:

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start the production server**:
   ```bash
   npm start
   ```

3. **Set environment variables** on your server (same as `.env.local`)

4. **Place service account JSON file** on the server

5. **Use a process manager** like PM2:
   ```bash
   npm install -g pm2
   pm2 start npm --name "ai-chatbot" -- start
   ```

### Option 3: Embed in Existing Website

If you want to embed this chatbot into your existing school website:

1. Deploy the chatbot as a separate service (using Vercel or your server)
2. Embed it using an iframe or integrate the API endpoints
3. Or create a chat widget component that can be included

## Important: Service Account JSON Handling

For production, you have two options:

### Option A: Environment Variable (Recommended)

1. Convert the JSON file to a base64 string or keep as JSON string
2. Store it as an environment variable
3. Update the code to read from environment variable

### Option B: Secure File Storage

1. Store the JSON file securely on your server
2. Ensure it's not accessible via web
3. Update the path in environment variables

## Environment Variables for Production

Make sure these are set in your deployment platform:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-nano
GOOGLE_SERVICE_ACCOUNT_KEY=./college-saint-louis-docs-b0c8e845eba9.json
# OR if using env var:
# GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_DOC_FULL_ID=1tClsLLSOjsxRlfqj_8M8N3h_YGciblW6uSzHXOJaGL8
```

## Security Checklist

- [ ] Never commit `.env.local` or service account JSON to git
- [ ] Use environment variables in your deployment platform
- [ ] Ensure service account JSON is stored securely
- [ ] Set up proper CORS if embedding in another domain
- [ ] Consider rate limiting for API endpoints
- [ ] Monitor API usage and costs

## Testing After Deployment

1. Test the chatbot with various questions
2. Check server logs for any errors
3. Verify Google Docs are being fetched correctly
4. Monitor OpenAI API usage

## Custom Domain (Optional)

If using Vercel:
1. Go to project settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

## Need Help?

- Check Next.js deployment docs: https://nextjs.org/docs/deployment
- Vercel docs: https://vercel.com/docs
- Check server logs if issues occur

