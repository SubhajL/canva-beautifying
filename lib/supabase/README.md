# Supabase Setup Guide

## Prerequisites

1. Create a Supabase account at [https://supabase.com](https://supabase.com)
2. Create a new project

## Setup Steps

### 1. Create a New Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New project"
3. Fill in:
   - Project name: `beautifyai` (or your preferred name)
   - Database Password: Generate a strong password
   - Region: Choose closest to your users
   - Pricing Plan: Free tier is fine to start

### 2. Get Your API Keys

1. Go to Settings → API
2. Copy these values to your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (keep secret!)

### 3. Run Database Schema

1. Go to SQL Editor in Supabase dashboard
2. Create a new query
3. Copy and paste the contents of `schema.sql`
4. Click "Run" to execute

### 4. Configure Authentication

#### Enable Email Authentication
1. Go to Authentication → Providers
2. Email is enabled by default
3. Configure email templates if needed

#### Enable Google OAuth
1. Go to Authentication → Providers → Google
2. Enable Google provider
3. Add your Google OAuth credentials:
   - Get these from [Google Cloud Console](https://console.cloud.google.com)
   - Create OAuth 2.0 Client ID
   - Add redirect URL: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
4. Add credentials to Supabase

#### Enable Microsoft OAuth
1. Go to Authentication → Providers → Azure (Microsoft)
2. Enable Azure provider
3. Add your Microsoft OAuth credentials:
   - Get these from [Azure Portal](https://portal.azure.com)
   - Register an application
   - Add redirect URL: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
4. Add credentials to Supabase

### 5. Configure Auth Settings

1. Go to Authentication → Settings
2. Configure:
   - Site URL: `http://localhost:3000` (for development)
   - Redirect URLs: Add `http://localhost:3000/auth/callback`
   - Email confirmations: Enable/disable as needed
   - External providers: Check Google and Microsoft are configured

### 6. Test Your Setup

Run the test script:

```bash
node scripts/test-supabase.js
```

## Environment Variables

Your `.env.local` should have:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Usage Examples

### Sign Up
```typescript
import { useAuth } from '@/contexts/auth-context'

const { signUp } = useAuth()
await signUp(email, password, { name: 'John Doe' })
```

### Sign In
```typescript
const { signIn, signInWithGoogle } = useAuth()

// Email/password
await signIn(email, password)

// OAuth
await signInWithGoogle()
```

### Check Authentication
```typescript
const { user, loading } = useAuth()

if (loading) return <div>Loading...</div>
if (!user) return <div>Not authenticated</div>
```

### Protected Routes
Routes are automatically protected by middleware. To make a route public, add it to the middleware matcher exclusions.

### Database Queries
```typescript
import { createClient } from '@/lib/supabase/server'

// Get user's enhancements
const supabase = await createClient()
const { data: enhancements } = await supabase
  .from('enhancements')
  .select('*')
  .order('created_at', { ascending: false })
```

## Security Notes

1. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
2. Use Row Level Security (RLS) policies (already configured)
3. Validate user permissions in API routes
4. Use the server client for sensitive operations

## Troubleshooting

**"Invalid API key"**
- Check your environment variables are correct
- Ensure `.env.local` is loaded (restart dev server)

**"User not found"**
- Check if user exists in Authentication → Users
- Verify email confirmation if required

**OAuth not working**
- Verify redirect URLs match exactly
- Check OAuth app credentials are correct
- Ensure providers are enabled in Supabase