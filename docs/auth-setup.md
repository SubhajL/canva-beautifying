# Authentication Setup Guide

## Prerequisites

Before the authentication system can work, you need to configure the following:

## 1. Supabase Project Setup

1. Create a Supabase project at https://supabase.com
2. Get your project URL and anon key from the Supabase dashboard

## 2. Environment Variables

Create a `.env.local` file in the project root with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. OAuth Provider Configuration

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:5000/auth/callback` (for development)
   - `https://your-domain.com/auth/callback` (for production)
6. In Supabase Dashboard:
   - Go to Authentication > Providers
   - Enable Google provider
   - Add your Google Client ID and Client Secret

### Microsoft OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Register a new application in Azure AD
3. Add redirect URIs:
   - `http://localhost:5000/auth/callback` (for development)
   - `https://your-domain.com/auth/callback` (for production)
4. Create a client secret
5. In Supabase Dashboard:
   - Go to Authentication > Providers
   - Enable Azure (Microsoft) provider
   - Add your Application (client) ID and Client Secret
   - Set the Azure tenant URL (usually `https://login.microsoftonline.com/common` for multi-tenant)

## 4. Supabase Authentication Settings

1. In Supabase Dashboard, go to Authentication > URL Configuration
2. Set the following:
   - Site URL: `http://localhost:5000` (for development)
   - Redirect URLs: Add `http://localhost:5000/auth/callback`

## 5. Email Templates (Optional)

In Supabase Dashboard > Authentication > Email Templates, you can customize:
- Confirmation email
- Password reset email
- Magic link email

## 6. Database Setup

Run the SQL migrations from `/lib/supabase/schema.sql` in the Supabase SQL editor to create:
- Users table with proper structure
- Row Level Security policies
- Trigger for automatic user creation

## Testing the Setup

1. Start the development server: `npm run dev`
2. Try registering with email/password
3. Test Google OAuth login
4. Test Microsoft OAuth login
5. Test password reset flow
6. Verify protected routes redirect to login

## Troubleshooting

### Common Issues:

1. **OAuth redirect mismatch**: Ensure redirect URIs in provider settings match exactly
2. **CORS errors**: Check Supabase project settings for allowed origins
3. **Email not sending**: Verify SMTP settings in Supabase (or use default Supabase email service)
4. **User not created in database**: Check if the database trigger is properly set up

### Debug Tips:

- Check browser console for errors
- Monitor Supabase logs in the dashboard
- Verify environment variables are loaded correctly
- Test with Supabase Auth UI first to isolate issues