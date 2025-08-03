# 🚀 Vercel Setup - Step by Step Guide

## Prerequisites Checklist
- [x] Node.js installed
- [x] Git repository (canva-beautifying)
- [x] Environment variables from .env.local
- [ ] Vercel account (we'll create this)

## Step 1: Install Vercel CLI

Open your terminal and run:

```bash
npm install -g vercel
```

## Step 2: Login to Vercel

Run this command and follow the prompts:

```bash
vercel login
```

You'll see options:
- **Continue with GitHub** (Recommended) ✅
- Continue with GitLab
- Continue with Bitbucket
- Continue with Email

## Step 3: Deploy Your First Build

In your project directory (`/Users/subhajlimanond/dev/canva-beautifying`), run:

```bash
vercel
```

You'll be asked:

1. **Set up and deploy "canva-beautifying"?** → Yes
2. **Which scope?** → Select your personal account
3. **Link to existing project?** → No (create new)
4. **What's your project's name?** → beautifyai (or keep default)
5. **In which directory is your code located?** → ./ (current directory)
6. **Want to modify settings?** → No (use detected Next.js settings)

Wait for deployment... ⏳

## Step 4: Your App is Live! 🎉

After deployment, you'll get URLs like:
- Preview: `https://beautifyai-abc123.vercel.app`
- Dashboard: `https://vercel.com/your-username/beautifyai`

## Step 5: Add Environment Variables

### Option A: Via Dashboard (Easier)

1. Go to: https://vercel.com/dashboard
2. Click on your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:

#### Required Variables:

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | All |
| `R2_ACCOUNT_ID` | Your Cloudflare account ID | All |
| `R2_ACCESS_KEY_ID` | Your R2 access key | All |
| `R2_SECRET_ACCESS_KEY` | Your R2 secret | All |
| `R2_BUCKET_NAME` | beautifyai-storage | All |
| `REDIS_URL` | Your Redis URL | All |
| `OPENAI_API_KEY` | Your OpenAI key | All |
| `GOOGLE_AI_API_KEY` | Your Google AI key | All |
| `REPLICATE_API_TOKEN` | Your Replicate token | All |

### Option B: Via CLI

```bash
# Pull current env vars
vercel env pull

# Add a new variable
vercel env add NEXT_PUBLIC_SUPABASE_URL

# Follow prompts for each variable
```

## Step 6: Redeploy with Environment Variables

After adding all environment variables:

```bash
vercel --prod
```

## Step 7: Connect GitHub for Auto-Deploy

1. Go to your project dashboard
2. Click **Settings** → **Git**
3. Click **Connect Git Repository**
4. Select your GitHub repo: `canva-beautifying`
5. Configure:
   - Production Branch: `main`
   - Auto-deploy: Enabled ✅

## Step 8: Add Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your domain: `beautifyai.com`
3. You'll get DNS records to add:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## Step 9: Set Up Redis (Upstash)

1. Go to Vercel Dashboard
2. Click **Storage** → **Create Database**
3. Select **Upstash Redis**
4. Click **Continue** → **Create**
5. It automatically adds `REDIS_URL` to your project!

## Step 10: Enable Web Analytics (Free)

1. Go to your project
2. Click **Analytics** tab
3. Click **Enable Web Analytics**
4. Add to your app layout:

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

## 🎯 Quick Commands Reference

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# List deployments
vercel ls

# View logs
vercel logs

# Remove a deployment
vercel rm [deployment-url]

# Pull environment variables
vercel env pull

# Open dashboard
vercel dashboard
```

## 🚨 Troubleshooting

### Build Fails
```bash
# Check build logs
vercel logs --type=build

# Build locally first
npm run build
```

### Environment Variables Not Working
- Make sure to redeploy after adding variables
- Check variable names match exactly
- Use correct prefix: `NEXT_PUBLIC_` for client-side vars

### Custom Domain Not Working
- DNS propagation can take up to 48 hours
- Check DNS records are correct
- Verify domain ownership in Vercel

## ✅ Success Checklist

- [ ] Vercel CLI installed
- [ ] Logged in to Vercel
- [ ] First deployment successful
- [ ] Environment variables added
- [ ] GitHub connected
- [ ] Auto-deploy enabled
- [ ] Custom domain configured (optional)
- [ ] Analytics enabled

## 🎉 Congratulations!

Your app is now:
- ✅ Live on the internet
- ✅ Auto-deploying on git push
- ✅ Globally distributed via CDN
- ✅ SSL secured
- ✅ Optimized for performance

Next push to GitHub will automatically deploy! 🚀