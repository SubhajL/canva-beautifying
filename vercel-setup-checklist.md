# ✅ Vercel Free Plan Setup Checklist

## Prerequisites
- [ ] Node.js installed
- [ ] Git repository ready
- [ ] Environment variables from `.env.local`

## Part 1: Vercel Setup (5 minutes)

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login
```bash
vercel login
```
- [ ] Choose "Continue with GitHub"
- [ ] Authorize in browser

### 3. Deploy
```bash
vercel
```
- [ ] Answer: **Y** (Set up and deploy)
- [ ] Select: Your username
- [ ] Answer: **N** (Link to existing)
- [ ] Name: `beautify-ai` (or press enter)
- [ ] Directory: `./` (press enter)
- [ ] Modify: **N**

### 4. Note Your URLs
- [ ] Preview URL: _________________________
- [ ] Dashboard: https://vercel.com/dashboard

## Part 2: Environment Variables (10 minutes)

### 5. Go to Vercel Dashboard
- [ ] Click your project
- [ ] Go to Settings → Environment Variables

### 6. Add Each Variable
Copy from your `.env.local`:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `R2_ACCOUNT_ID`
- [ ] `R2_ACCESS_KEY_ID`
- [ ] `R2_SECRET_ACCESS_KEY`
- [ ] `R2_BUCKET_NAME`
- [ ] `R2_PUBLIC_URL`
- [ ] `REDIS_URL`
- [ ] `OPENAI_API_KEY`
- [ ] `GOOGLE_AI_API_KEY`
- [ ] `REPLICATE_API_TOKEN`

### 7. Redeploy
- [ ] Click "Redeploy" button

## Part 3: Domain Setup (10 minutes)

### 8. Get Your Domain
**If you don't have beautify-ai.com yet:**

Option A - Cloudflare (Cheapest ~$10/year):
- [ ] Go to https://dash.cloudflare.com
- [ ] Register → Search `beautify-ai.com`
- [ ] Purchase

Option B - Namecheap (~$13/year):
- [ ] Go to https://namecheap.com
- [ ] Search `beautify-ai.com`
- [ ] Purchase

### 9. Add Domain to Vercel
- [ ] In Vercel: Settings → Domains
- [ ] Enter: `beautify-ai.com`
- [ ] Click "Add"

### 10. Configure DNS
Add these records at your domain registrar:

**A Record:**
- [ ] Type: `A`
- [ ] Name: `@`
- [ ] Value: `76.76.21.21`

**CNAME Record:**
- [ ] Type: `CNAME`
- [ ] Name: `www`
- [ ] Value: `cname.vercel-dns.com`

### 11. Wait & Verify
- [ ] Wait 5-30 minutes
- [ ] Check: https://beautify-ai.com
- [ ] Verify SSL certificate (🔒)

## Part 4: Final Setup

### 12. Test Everything
- [ ] Visit: https://beautify-ai.com
- [ ] Visit: https://www.beautify-ai.com
- [ ] Test a few pages
- [ ] Check console for errors

### 13. Connect GitHub (Optional but Recommended)
- [ ] Vercel Dashboard → Settings → Git
- [ ] Connect GitHub repository
- [ ] Enable auto-deploy on push

## 🎉 Done! Total Cost:

| Item | Cost |
|------|------|
| Vercel Hosting | $0/month |
| Domain Name | ~$1/month ($12/year) |
| **Total** | **~$1/month** |

## 📞 Quick Support:

**DNS Not Working?**
- Check: https://www.whatsmydns.net/
- Make sure Cloudflare proxy is OFF (gray cloud)

**Site Not Loading?**
- Check build logs: `vercel logs`
- Verify env variables are set
- Try redeploying: `vercel --prod`

**Free Plan Limits:**
- 100 GB bandwidth/month
- Perfect for launch & early growth!