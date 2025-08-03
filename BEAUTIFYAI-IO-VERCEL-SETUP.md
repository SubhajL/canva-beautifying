# 🚀 Setting Up beautifyai.io with Vercel Free Tier

## Step 1: Deploy to Vercel First

Open your terminal and run:

```bash
# 1. Install Vercel CLI (if not already)
npm install -g vercel

# 2. Login to Vercel
vercel login
```

Choose **"Continue with GitHub"** when prompted.

## Step 2: Deploy Your App

In your project directory:

```bash
vercel
```

When prompted:
- **Set up and deploy?** → `Y`
- **Which scope?** → Your username
- **Link to existing project?** → `N`
- **Project name?** → `beautifyai`
- **Directory?** → `./` (press Enter)
- **Override settings?** → `N`

Wait for deployment... You'll get a URL like:
- `https://beautifyai-xxxxx.vercel.app`

## Step 3: Add Your Domain to Vercel

1. Go to: https://vercel.com/dashboard
2. Click on your project
3. Go to **Settings** → **Domains**
4. Type: `beautifyai.io`
5. Click **Add**

Vercel will show you two options:
- ✅ Add beautifyai.io
- ✅ Add www.beautifyai.io

Add BOTH for best results!

## Step 4: Configure DNS Records

You need to add these DNS records where your domain is registered:

### Required DNS Records:

**For root domain (beautifyai.io):**
```
Type: A
Name: @ (or leave blank)
Value: 76.76.21.21
TTL: 300 (or Auto)
```

**For www subdomain:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 300 (or Auto)
```

### Where is Your Domain Registered?

#### If at Namecheap:
1. Login to Namecheap
2. Dashboard → Domain List → Manage
3. Click **Advanced DNS**
4. Delete existing records for @ and www
5. Add the records above

#### If at GoDaddy:
1. Login to GoDaddy
2. My Products → Domains → Manage
3. Click **DNS**
4. Update/Add the records above

#### If at Google Domains:
1. Login to domains.google.com
2. Click your domain
3. Go to **DNS** → **Manage custom records**
4. Add the records above

#### If at Cloudflare:
1. Login to Cloudflare
2. Select beautifyai.io
3. Go to **DNS**
4. Add records with **Proxy status: DNS only** (gray cloud)

## Step 5: Add Environment Variables

While DNS is propagating, let's add your environment variables:

1. In Vercel Dashboard → **Settings** → **Environment Variables**
2. Add each of these:

```
NEXT_PUBLIC_SUPABASE_URL=your_value_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_value_here
SUPABASE_SERVICE_ROLE_KEY=your_value_here
R2_ACCOUNT_ID=your_value_here
R2_ACCESS_KEY_ID=your_value_here
R2_SECRET_ACCESS_KEY=your_value_here
R2_BUCKET_NAME=beautifyai-storage
R2_PUBLIC_URL=your_value_here
OPENAI_API_KEY=your_value_here
GOOGLE_AI_API_KEY=your_value_here
REPLICATE_API_TOKEN=your_value_here
```

3. After adding all, click **"Redeploy"** → **"Redeploy with existing Build Cache"**

## Step 6: Verify Domain Setup

1. Wait 5-30 minutes for DNS propagation
2. Check status at: https://www.whatsmydns.net
   - Search for: beautifyai.io
   - Should show: 76.76.21.21

3. In Vercel Dashboard, you'll see:
   - ✅ beautifyai.io (Valid Configuration)
   - ✅ www.beautifyai.io (Valid Configuration)

## Step 7: Test Your Live Site!

Once DNS propagates, test:
- https://beautifyai.io
- https://www.beautifyai.io

Both should work with SSL certificates! 🔒

## 📧 Bonus: Set Up Email Forwarding

Since you have the domain, let's set up email forwarding:

### Option 1: If Domain is at Cloudflare (Free)
1. Go to Email → Email Routing
2. Add destination address (your Gmail)
3. Create routing rules:
   - `hello@beautifyai.io` → your@gmail.com
   - `support@beautifyai.io` → your@gmail.com

### Option 2: If Domain is Elsewhere
Use ImprovMX (free):
1. Go to https://improvmx.com
2. Add domain: beautifyai.io
3. Set up forwarding addresses
4. Add their MX records to your DNS

## 🎯 Quick Checklist:

- [ ] Deployed to Vercel
- [ ] Added beautifyai.io in Vercel
- [ ] Updated DNS records
- [ ] Added environment variables
- [ ] Redeployed with env vars
- [ ] Waited for DNS propagation
- [ ] Tested https://beautifyai.io
- [ ] Set up email forwarding

## 🚨 Troubleshooting:

**Domain not working?**
- Check DNS propagation: https://www.whatsmydns.net
- Ensure you added both A and CNAME records
- If using Cloudflare, proxy must be OFF (gray cloud)

**SSL Certificate error?**
- Wait a bit longer (Vercel needs to provision it)
- Make sure DNS is properly configured

**Site loads but looks broken?**
- Check environment variables
- Redeploy after adding env vars
- Check browser console for errors

## ✅ Success!

Your app is now live at:
- https://beautifyai.io
- https://www.beautifyai.io

With:
- ✅ Free hosting (Vercel)
- ✅ Free SSL certificates
- ✅ Global CDN
- ✅ Auto-deploy on git push

Total monthly cost: $2.50 (just the domain!)