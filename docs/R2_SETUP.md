# Cloudflare R2 Setup Guide

## 1. Create R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** in the sidebar
3. Click **Create bucket**
4. Name it: `beautifyai-storage`
5. Leave location as automatic

## 2. Configure Public Access

1. Click on your `beautifyai-storage` bucket
2. Go to **Settings** tab
3. Under **Public access**, click **Allow public access**
4. Confirm the security implications
5. Copy the **Public bucket URL** (format: `https://pub-xxxxx.r2.dev`)
6. Add this URL to your `.env.local` as `R2_PUBLIC_URL`

## 3. Apply CORS Configuration

### Option A: Using Cloudflare Dashboard (Easier)
1. In your bucket settings, go to **CORS** section
2. Click **Add CORS policy**
3. Add the following rules:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5000", "https://your-domain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Option B: Using Wrangler CLI
1. Install Wrangler: `npm install -g wrangler`
2. Authenticate: `wrangler login`
3. Apply CORS config:
```bash
wrangler r2 bucket cors put beautifyai-storage --rules ./lib/r2/cors-config.json
```

## 4. Create API Token

1. Go to **R2** → **Manage R2 API tokens**
2. Click **Create API token**
3. Configure:
   - **Token name**: BeautifyAI Production
   - **Permissions**: Object Read & Write
   - **Specify bucket**: beautifyai-storage
   - **TTL**: Leave blank for permanent
4. Click **Create API Token**
5. Save the credentials:
   - `Access Key ID` → `R2_ACCESS_KEY_ID`
   - `Secret Access Key` → `R2_SECRET_ACCESS_KEY`
   - `Account ID` is shown in R2 overview → `R2_ACCOUNT_ID`

## 5. Create Folder Structure

R2 doesn't have real folders, but we use prefixes. The app will create these automatically:
- `original/` - User uploaded files
- `enhanced/` - AI-processed files
- `temp/` - Temporary processing files
- `assets/` - Generated assets (backgrounds, elements)

## 6. Test Your Configuration

Run the R2 test script:
```bash
npm run test:r2
```

This will:
- Test authentication
- Upload a test file
- Generate a signed URL
- Verify public access
- Clean up test files

## Security Notes

1. **Public Access**: Only enhanced files should be publicly accessible. Original uploads use signed URLs.
2. **CORS Origins**: Update the allowed origins when deploying to production
3. **API Keys**: Never commit R2 credentials to git
4. **Bucket Names**: R2 bucket names are globally unique

## Troubleshooting

### "Access Denied" errors
- Verify API token has Object Read & Write permissions
- Check if bucket name in .env matches actual bucket name
- Ensure Account ID is correct

### CORS errors
- Make sure your local dev URL is in AllowedOrigins
- Check that the CORS policy was applied successfully
- Try clearing browser cache

### Public URL not working
- Ensure public access is enabled in bucket settings
- Wait a few minutes for DNS propagation
- Try accessing a file directly via the public URL