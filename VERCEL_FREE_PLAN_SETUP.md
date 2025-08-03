# 🚀 Vercel Free Plan + Custom Domain Setup Guide

## Step 1: Create Vercel Account (Free)

1. Go to: https://vercel.com/signup
2. Click **"Continue with GitHub"** (recommended)
3. Authorize Vercel to access your GitHub
4. Select **Hobby** plan (FREE)

## Step 2: Install Vercel CLI

Open your terminal and run:

```bash
npm install -g vercel
```

## Step 3: Login to Vercel

```bash
vercel login
```

Choose: **Continue with GitHub**

## Step 4: Deploy Your App

In your project directory (`/Users/subhajlimanond/dev/canva-beautifying`):

```bash
vercel
```

When prompted:

1. **Set up and deploy "~/dev/canva-beautifying"?** → `Y`
2. **Which scope do you want to deploy to?** → Select your username
3. **Link to existing project?** → `N` (create new)
4. **What's your project's name?** → `beautify-ai` (or press enter for default)
5. **In which directory is your code located?** → `./` (press enter)
6. **Want to modify these settings?** → `N`

Wait for deployment... ⏳

## Step 5: Your App is Live! 

You'll get URLs like:
- Preview: https://beautify-ai-[random].vercel.app
- Inspect: https://vercel.com/[username]/beautify-ai

## Step 6: Add Environment Variables

### Via Vercel Dashboard:

1. Go to: https://vercel.com/dashboard
2. Click on your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable from your `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
REDIS_URL
OPENAI_API_KEY
GOOGLE_AI_API_KEY
REPLICATE_API_TOKEN
```

5. After adding all, click **"Redeploy"** button

## Step 7: Domain Name Setup

### Option A: If You Already Own beautify-ai.com

1. In Vercel Dashboard → **Settings** → **Domains**
2. Type: `beautify-ai.com`
3. Click **Add**
4. Vercel will show DNS records to add

### Option B: If You Need to Buy the Domain First

#### Recommended: Cloudflare Registrar (Cheapest)
1. Go to: https://dash.cloudflare.com/sign-up
2. Add your domain to Cloudflare (free plan)
3. Go to **Registrar** → **Transfer or Register**
4. Search: `beautify-ai.com`
5. Purchase (~$10/year)

#### Alternative: Namecheap
1. Go to: https://www.namecheap.com
2. Search: `beautify-ai.com`
3. Purchase (~$13/year)

## Step 8: Configure DNS Records

After adding domain in Vercel, you'll see instructions like:

### For Root Domain (beautify-ai.com):
```
Type: A
Name: @ (or blank)
Value: 76.76.21.21
TTL: Auto (or 300)
```

### For WWW (www.beautify-ai.com):
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: Auto (or 300)
```

### Where to Add DNS Records:

#### If Using Cloudflare:
1. Login to Cloudflare
2. Select your domain
3. Go to **DNS** tab
4. Click **Add Record**
5. Add both records above
6. **Important**: Set Proxy status to **"DNS only"** (gray cloud)

#### If Using Namecheap:
1. Login to Namecheap
2. Dashboard → **Domain List** → **Manage**
3. Go to **Advanced DNS**
4. Add both records above

#### If Using Google Domains:
1. Login to Google Domains
2. Click your domain
3. Go to **DNS** → **Manage custom records**
4. Add both records above

## Step 9: Wait for DNS Propagation

- Usually takes: 5-30 minutes
- Maximum: 48 hours (rare)
- Check status: https://www.whatsmydns.net/

## Step 10: Verify Domain in Vercel

1. Go back to Vercel Dashboard
2. You'll see your domain status
3. Once verified, you'll see:
   - ✅ beautify-ai.com
   - ✅ www.beautify-ai.com
   - 🔒 SSL Certificate (automatic)

## 🎉 Success! Your App is Live!

Your BeautifyAI app is now accessible at:
- https://beautify-ai.com
- https://www.beautify-ai.com

Both with free SSL certificates!

## 📊 Free Plan Limits (Generous!):

- **Bandwidth**: 100 GB/month
- **Serverless Functions**: 100 GB-hours
- **Build Minutes**: 6,000 minutes/month
- **Deployments**: Unlimited
- **Team Members**: 1
- **Sites**: Unlimited

## 🚨 Quick Troubleshooting:

### Domain Not Working?
```bash
# Check DNS propagation
nslookup beautify-ai.com
dig beautify-ai.com

# Or use online tool
https://www.whatsmydns.net/
```

### Environment Variables Not Working?
- Click **"Redeploy"** after adding variables
- Make sure names match exactly
- Check build logs for errors

### Build Failing?
```bash
# Test locally first
npm run build

# Check Vercel logs
vercel logs
```

## 📱 Next Steps:

1. **Test your live site**: https://beautify-ai.com
2. **Monitor usage**: Vercel Dashboard → Analytics
3. **Set up GitHub integration**: For auto-deployments
4. **Add team members**: When you need to (requires Pro)

## 💰 When to Upgrade to Pro?

Upgrade when you hit these limits:
- 100 GB bandwidth/month (~100k visitors)
- Need team collaboration
- Want password-protected previews
- Need advanced analytics

## 🎯 Quick Commands:

```bash
# Deploy updates
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs

# Pull environment variables
vercel env pull
```

---

**Congratulations! 🎉** Your app is live on your custom domain with $0/month hosting!