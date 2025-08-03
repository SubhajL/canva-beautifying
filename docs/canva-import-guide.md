# Canva Import Feature Guide

## Overview

The Canva Import feature allows users to import their Canva designs directly into BeautifyAI for enhancement. We provide both API-based and manual workflows to ensure all users can import their designs regardless of API availability.

## Import Methods

### 1. Automatic Mode (Default)
- Intelligently selects the best import method
- Uses API if connected and available
- Falls back to manual instructions if API is unavailable
- Recommended for most users

### 2. API Mode
- Direct integration with Canva Connect APIs
- Requires one-time OAuth authentication
- Fastest and most seamless experience
- Features:
  - Automatic high-quality export
  - Direct file transfer
  - No manual download required
  - Progress tracking

### 3. Manual Mode
- Step-by-step instructions for manual download
- Works with all Canva designs
- No authentication required
- Perfect fallback option

## Setup Instructions

### For Users

1. **Using Automatic Mode**
   - Simply paste your Canva URL
   - Click "Import Automatically"
   - Follow any prompts that appear

2. **Connecting Canva Account (for API mode)**
   - Go to Settings → Integrations → Canva
   - Click "Connect Canva Account"
   - Authorize BeautifyAI in the Canva popup
   - Return to the import page

3. **Manual Import Process**
   - Paste your Canva URL
   - Select "Manual" tab
   - Click "Get Manual Instructions"
   - Follow the step-by-step guide
   - Upload the downloaded file

### For Administrators

1. **Enable Canva API Integration**
   ```env
   NEXT_PUBLIC_CANVA_CLIENT_ID=your_client_id
   CANVA_CLIENT_SECRET=your_client_secret
   NEXT_PUBLIC_CANVA_REDIRECT_URI=https://yourdomain.com/api/canva/callback
   NEXT_PUBLIC_CANVA_API_ENABLED=true
   ```

2. **Database Setup**
   Run the migrations:
   ```sql
   -- 20250119_canva_tokens.sql
   -- 20250119_canva_import_logs.sql
   ```

3. **Canva App Configuration**
   - Register at [Canva Developers](https://www.canva.com/developers/)
   - Create a new app
   - Add OAuth redirect URI
   - Request necessary scopes:
     - `design:content:read`
     - `design:meta:read`
     - `asset:read`

## Technical Implementation

### API Workflow
1. User pastes Canva URL
2. System extracts design ID
3. Checks for valid OAuth token
4. If not authenticated, prompts connection
5. Calls Canva Export API
6. Waits for export completion
7. Downloads exported file
8. Uploads to R2 storage
9. Creates document record

### Manual Workflow
1. User pastes Canva URL
2. System validates URL format
3. Returns step-by-step instructions
4. User downloads from Canva
5. User uploads file normally

### Key Components

- **API Client**: `/lib/canva/api-client.ts`
- **OAuth Handler**: `/lib/canva/oauth.ts`
- **Import Component**: `/components/upload/canva-import.tsx`
- **API Routes**:
  - `/api/canva/import` - Main import endpoint
  - `/api/canva/callback` - OAuth callback
  - `/api/canva/auth/*` - Auth management

## Security Considerations

1. **OAuth Security**
   - State parameter prevents CSRF
   - Tokens stored encrypted in database
   - Automatic token refresh
   - User-specific token isolation

2. **Rate Limiting**
   - API calls are rate-limited
   - Fallback to manual on API errors
   - Graceful degradation

3. **Data Privacy**
   - Only requested designs are accessed
   - No background syncing
   - User can disconnect anytime
   - Tokens deleted on disconnect

## Troubleshooting

### Common Issues

1. **"Authentication Required" Error**
   - Solution: Connect Canva account in settings

2. **"Invalid Canva URL" Error**
   - Ensure URL is from canva.com
   - Check design is set to "Anyone with link can view"

3. **API Import Fails**
   - Try manual mode as fallback
   - Check Canva service status
   - Verify design permissions

### Error Codes
- `UNAUTHORIZED` - Token expired or invalid
- `EXPORT_FAILED` - Canva export job failed
- `TIMEOUT` - Export took too long
- `INVALID_URL` - URL format not recognized

## Future Enhancements

1. **Batch Import**
   - Import multiple designs at once
   - Queue management for large imports

2. **Auto-sync**
   - Watch for design updates
   - Automatic re-import options

3. **Team Accounts**
   - Support Canva for Teams
   - Shared design libraries

4. **Template Creation**
   - Export enhanced designs back to Canva
   - Create Canva templates from enhancements