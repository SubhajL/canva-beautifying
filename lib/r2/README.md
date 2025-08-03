# Cloudflare R2 Setup Guide

## Prerequisites

1. Create a Cloudflare account
2. Enable R2 in your Cloudflare dashboard
3. Create a new R2 bucket named `beautifyai-storage`

## Configuration Steps

### 1. Create R2 API Token

1. Go to R2 > Manage R2 API Tokens
2. Create a new API token with the following permissions:
   - Object Read & Write
   - Bucket List
3. Save the credentials

### 2. Configure CORS

Upload the `cors-config.json` file to your R2 bucket:

```bash
# Using wrangler CLI
wrangler r2 bucket cors put beautifyai-storage --file ./lib/r2/cors-config.json
```

### 3. Set Environment Variables

Copy `.env.example` to `.env.local` and fill in your R2 credentials:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_ACCESS_KEY_ID=your_access_key_id  
CLOUDFLARE_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFLARE_R2_BUCKET_NAME=beautifyai-storage
CLOUDFLARE_R2_PUBLIC_URL=https://your-custom-domain.com # Optional
```

### 4. Optional: Configure Public Access

For public access without signed URLs:

1. Set up a custom domain for your R2 bucket
2. Configure the domain in Cloudflare
3. Update `CLOUDFLARE_R2_PUBLIC_URL` in your env

## Folder Structure

The R2 bucket uses the following folder structure:

```
beautifyai-storage/
├── original/          # Original uploaded documents
│   └── {userId}/
│       └── {timestamp}-{filename}
├── enhanced/          # AI-enhanced documents
│   └── {userId}/
│       └── {timestamp}-{filename}
├── temp/              # Temporary processing files
│   └── {userId}/
│       └── {timestamp}-{filename}
└── assets/            # Generated assets (backgrounds, etc)
    └── {userId}/
        └── {timestamp}-{filename}
```

## Usage Examples

### Upload a file

```typescript
import { uploadFile } from "@/lib/r2"

const result = await uploadFile({
  file: fileObject,
  userId: "user123",
  filename: "worksheet.pdf",
  folder: "ORIGINAL",
})

console.log(result.url) // File URL
```

### Generate signed URL

```typescript
import { getDownloadUrl } from "@/lib/r2"

const url = await getDownloadUrl(
  "original/user123/1234567890-worksheet.pdf",
  3600, // Expires in 1 hour
  "My Worksheet.pdf" // Download filename
)
```

### Delete a file

```typescript
import { deleteFile } from "@/lib/r2"

await deleteFile("original/user123/1234567890-worksheet.pdf")
```

## Security Notes

1. Never expose R2 credentials in client-side code
2. Always validate file types and sizes before upload
3. Implement proper authentication before file operations
4. Use signed URLs for temporary access
5. Set appropriate CORS policies for your domains