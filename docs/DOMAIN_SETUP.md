# Custom Domain Setup: askme.tarch.ca

## Step 1: Add Domain in Vercel

1. Go to your Vercel project dashboard
2. Click on **Settings** → **Domains**
3. Click **Add Domain**
4. Enter: `askme.tarch.ca`
5. Click **Add**

## Step 2: Configure DNS in Cloudflare

Vercel will show you DNS records to add. You'll need to add these in Cloudflare:

### Option A: CNAME Record (Recommended)
- **Type**: CNAME
- **Name**: `askme` (or `@` if it's the root domain)
- **Target**: Use the exact value Vercel shows (e.g., `4a17296edc0da01a.vercel-dns-017.com.`)
- **Proxy status**: **DNS only (gray cloud)** - **IMPORTANT: Must be gray cloud, NOT orange (proxied)**

### Option B: A Record (Alternative)
- **Type**: A
- **Name**: `askme` (or `@`)
- **Target**: `76.76.21.21` (Vercel's IP - Vercel will show you the exact IP)
- **Proxy status**: DNS only (gray cloud)

## Step 3: Wait for DNS Propagation

- DNS changes can take a few minutes to 24 hours
- Cloudflare usually propagates quickly (5-15 minutes)
- Vercel will show "Valid Configuration" when it's ready

## Step 4: SSL Certificate

- Vercel automatically provisions SSL certificates
- Your site will be available at `https://askme.tarch.ca`
- This happens automatically after DNS is configured

## Troubleshooting

If the domain doesn't work:
1. Check DNS records in Cloudflare match Vercel's requirements
2. Make sure the domain is pointing to Vercel (not another service)
3. Wait a bit longer for DNS propagation
4. Check Vercel dashboard for any error messages


