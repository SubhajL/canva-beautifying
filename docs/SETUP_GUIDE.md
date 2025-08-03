# BeautifyAI Setup Guide

This guide will help you set up all the required services for BeautifyAI.

## Prerequisites

- Node.js 18+ installed
- Cloudflare account
- Supabase account
- (Optional) AI API keys for Gemini, OpenAI, or Anthropic

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd canva-beautifying

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

## Step 2: Supabase Setup

### 2.1 Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New project"
3. Fill in:
   - Organization: Your org
   - Project name: beautifyai
   - Database password: Generate a strong password
   - Region: Choose closest to your users
4. Click "Create new project" and wait for setup

### 2.2 Get API Keys

1. Go to **Settings** → **API**
2. Copy these values to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

### 2.3 Run Database Migrations

1. Go to **SQL Editor** in Supabase
2. Click "New query"
3. Copy and paste the contents of `lib/supabase/schema.sql`
4. Click "Run" to create all tables

### 2.4 Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider (should be on by default)
3. For Google OAuth:
   - Click **Google**
   - Follow the guide to set up OAuth consent screen
   - Add authorized redirect URL: `https://<project-ref>.supabase.co/auth/v1/callback`
4. For Microsoft OAuth:
   - Click **Azure (Microsoft)**
   - Follow the guide to register an app in Azure
   - Add redirect URL

### 2.5 Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize the confirmation email template
3. Update the redirect URL to your app domain

## Step 3: Cloudflare R2 Setup

Follow the detailed guide in [R2_SETUP.md](./R2_SETUP.md)

Quick steps:
1. Create bucket named `beautifyai-storage`
2. Enable public access
3. Create API token with Object Read & Write
4. Apply CORS configuration
5. Add credentials to `.env.local`

## Step 4: Run the Application

```bash
# Run development server
npm run dev

# Open http://localhost:5000
```

## Step 5: Test the Setup

### 5.1 Test Supabase Connection
```bash
npm run test:supabase
```

### 5.2 Test R2 Storage
```bash
npm run test:r2
```

### 5.3 Test Authentication Flow
1. Go to http://localhost:5000/signup
2. Create a test account
3. Check your email for confirmation
4. Try logging in at http://localhost:5000/login

### 5.4 Test File Upload
1. Log in to your account
2. Go to http://localhost:5000/upload
3. Try uploading an image or PDF
4. Check if file appears in R2 bucket

## Step 6: AI Configuration (Optional for Phase 1)

If you want to test AI features:

1. Get API keys from:
   - [Google AI Studio](https://makersuite.google.com/app/apikey) for Gemini
   - [OpenAI Platform](https://platform.openai.com/api-keys) for GPT-4
   - [Anthropic Console](https://console.anthropic.com/) for Claude

2. Add to `.env.local`:
   ```
   GEMINI_API_KEY=your-key
   OPENAI_API_KEY=your-key
   ANTHROPIC_API_KEY=your-key
   ```

3. Test AI integration:
   ```bash
   npm run test:ai
   ```

## Common Issues & Solutions

### "Authentication required" error
- Make sure you're logged in
- Check if Supabase URL and keys are correct
- Verify email confirmation was completed

### File upload fails
- Check R2 credentials in `.env.local`
- Verify bucket name is exactly `beautifyai-storage`
- Ensure R2 API token has correct permissions

### CORS errors
- Apply CORS config to R2 bucket
- Add `http://localhost:5000` to allowed origins
- Clear browser cache and retry

### Social login not working
- Ensure OAuth providers are configured in Supabase
- Check redirect URLs match exactly
- Verify client IDs and secrets are correct

## Next Steps

Once everything is working:

1. **Complete Authentication (Task 3)**
   - Add forgot password flow
   - Implement user profile page
   - Add logout functionality

2. **Start Document Analysis (Task 8)**
   - Begin implementing the AI analysis engine
   - Create enhancement pipeline

3. **Deploy to Production**
   - Set up Vercel deployment
   - Configure production environment variables
   - Update CORS for production domain

## Support

If you encounter issues:
1. Check the error logs in browser console
2. Verify all environment variables are set
3. Run the test scripts to isolate issues
4. Check Supabase and Cloudflare dashboards for errors