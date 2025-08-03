# 🧪 Complete Local End-to-End Testing Guide

## Prerequisites Check

Before testing, ensure you have:
- [ ] Node.js 20+ installed
- [ ] PostgreSQL running (via Supabase)
- [ ] Redis running locally or cloud URL
- [ ] All API keys in `.env.local`
- [ ] R2 bucket created

## 🚀 Step 1: Start All Services

### 1.1 Start the Development Server
```bash
# Terminal 1
npm run dev
```
Should see: `✓ Ready on http://localhost:5000`

### 1.2 Start the Worker Process
```bash
# Terminal 2
npm run workers:dev
```
Should see: `✓ Worker started, waiting for jobs...`

### 1.3 Start WebSocket Server
```bash
# Terminal 3
npm run websocket:dev
```
Should see: `✓ WebSocket server running on port 3001`

### 1.4 Check All Services
Open http://localhost:5000 - you should see the landing page

## 🔍 Step 2: Test Core Functionality

### 2.1 Test Authentication

1. **Sign Up Flow**:
   - Go to http://localhost:5000/auth/signup
   - Try each method:
     - ✅ Email signup
     - ✅ Google OAuth
     - ✅ Microsoft OAuth
   - Verify email (check inbox)
   - Should redirect to dashboard

2. **Login Flow**:
   - Logout first
   - Go to http://localhost:5000/auth/login
   - Test login with created account
   - Check "Remember me" functionality

### 2.2 Test Document Upload

1. **Navigate to Dashboard**:
   - http://localhost:5000/dashboard
   - Should see empty state

2. **Test Upload Methods**:
   
   **a) File Upload**:
   - Click "Upload Document"
   - Test each format:
     - [ ] PNG image
     - [ ] JPG image
     - [ ] PDF document
   - Should see upload progress
   - File should appear in dashboard

   **b) Drag & Drop**:
   - Drag a file onto upload area
   - Should show drop zone
   - Should upload on drop

   **c) Canva Import**:
   - Click "Import from Canva"
   - Paste a Canva URL
   - Should download and process

3. **Verify Storage**:
   - Check Supabase dashboard → Storage
   - Should see files in bucket
   - Check database → documents table

### 2.3 Test Enhancement Pipeline

1. **Start Enhancement**:
   - Click on uploaded document
   - Click "Enhance Document"
   - Select enhancement options:
     - [ ] Typography improvements
     - [ ] Color optimization
     - [ ] Layout adjustments
     - [ ] Decorative elements

2. **Monitor Progress**:
   - Should see real-time progress
   - Check WebSocket connection in console
   - Progress bar should update
   - Check worker terminal for processing logs

3. **Verify Each Stage**:
   ```
   Stage 1: Analysis (0-25%)
   - Document analysis with AI
   - Should extract layout, colors, text
   
   Stage 2: Enhancement (25-50%)
   - AI generates improvements
   - Should create enhancement plan
   
   Stage 3: Processing (50-75%)
   - Apply enhancements
   - Generate new assets
   
   Stage 4: Finalization (75-100%)
   - Compile final document
   - Upload to storage
   ```

### 2.4 Test AI Services

1. **Test Each AI Model**:
   ```bash
   # Run AI service tests
   npm run test:ai
   ```
   
   Should test:
   - [ ] Gemini 2.0 Flash (document analysis)
   - [ ] GPT-4 Vision (enhancement suggestions)
   - [ ] Claude 3.5 (if configured)

2. **Test Image Generation**:
   ```bash
   # Run image generation tests
   npm run test:images
   ```
   
   Should test:
   - [ ] DALL-E 3 (decorative elements)
   - [ ] Stable Diffusion (backgrounds)

### 2.5 Test Export Functionality

1. **Test Each Export Format**:
   - Go to enhanced document
   - Click "Export"
   
   **PNG Export**:
   - Select PNG format
   - Choose scale (1x, 2x)
   - Download should start
   - Verify image quality
   
   **JPG Export**:
   - Select JPG format
   - Adjust quality slider
   - Check file size changes
   
   **PDF Export**:
   - Select PDF format
   - Check metadata preservation
   - Verify vector elements
   
   **Canva Export**:
   - Select Canva format
   - Should download JSON
   - Check import compatibility

2. **Test Batch Export**:
   - Select multiple documents
   - Export as ZIP
   - Verify all files included

### 2.6 Test User Features

1. **Subscription Tiers**:
   - Check tier limits:
     - Free: 5 enhancements/month
     - Basic: 20 enhancements/month
     - Pro: 100 enhancements/month
     - Premium: Unlimited
   
2. **Usage Tracking**:
   - Process a document
   - Check usage counter updates
   - Verify database tracking

3. **Enhancement History**:
   - Should see all past enhancements
   - Can view before/after
   - Can re-download

## 📊 Step 3: Performance Testing

### 3.1 Check Page Load Times
```bash
# In browser DevTools
- Landing page: < 2 seconds
- Dashboard: < 1.5 seconds
- Enhancement page: < 2 seconds
```

### 3.2 Test Concurrent Users
```bash
# Open multiple browser windows
- Test 3-5 simultaneous enhancements
- Monitor Redis queue
- Check worker performance
```

### 3.3 Memory Usage
```bash
# Monitor during enhancement
- Node process: < 500MB
- Worker process: < 1GB
- Redis: < 100MB
```

## 🔒 Step 4: Security Testing

### 4.1 Authentication Tests
- [ ] Try accessing dashboard without login
- [ ] Test expired tokens
- [ ] Verify RLS policies work

### 4.2 File Upload Security
- [ ] Try uploading non-image files
- [ ] Test file size limits (10MB)
- [ ] Verify file type validation

### 4.3 API Security
- [ ] Test API without auth token
- [ ] Verify rate limiting works
- [ ] Check CORS configuration

## 🐛 Step 5: Error Handling

### 5.1 Test Error Scenarios

1. **No Internet**:
   - Disconnect internet
   - Try enhancement
   - Should show error message

2. **API Key Issues**:
   - Remove an API key
   - Test that feature
   - Should fallback gracefully

3. **Storage Errors**:
   - Fill up storage quota
   - Try upload
   - Should show appropriate error

4. **Worker Crash**:
   - Stop worker process
   - Try enhancement
   - Should queue and show status

## ✅ Step 6: Complete Test Checklist

### Core Functionality
- [ ] User can sign up/login
- [ ] User can upload documents
- [ ] Enhancement process completes
- [ ] Results are displayed
- [ ] Exports work correctly

### Real-time Features
- [ ] Progress updates work
- [ ] WebSocket reconnects
- [ ] Queue status updates

### Error Handling
- [ ] Graceful error messages
- [ ] No console errors
- [ ] Fallback behaviors work

### Performance
- [ ] Pages load quickly
- [ ] No memory leaks
- [ ] Smooth animations

## 🚦 Step 7: Final Validation

### 7.1 Run Automated Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests (if configured)
npm run test:e2e
```

### 7.2 Build Production Version
```bash
# Build for production
npm run build

# Test production build
npm start
```

### 7.3 Lighthouse Audit
1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Run audit on:
   - Performance: > 90
   - Accessibility: > 95
   - Best Practices: > 90
   - SEO: > 90

## 📝 Test Results Template

```markdown
## Local Test Results - [Date]

### Environment
- Node Version: 
- OS: 
- Browser: 

### Test Summary
- [ ] Authentication: PASS/FAIL
- [ ] Upload: PASS/FAIL
- [ ] Enhancement: PASS/FAIL
- [ ] Export: PASS/FAIL
- [ ] WebSocket: PASS/FAIL
- [ ] Workers: PASS/FAIL

### Issues Found
1. 
2. 

### Performance Metrics
- Landing Page Load: ___ ms
- Enhancement Time: ___ seconds
- Export Time: ___ seconds

### Ready for Deployment: YES/NO
```

## 🎯 When You're Ready

After all tests pass:
1. Commit any fixes
2. Push to GitHub
3. Deploy to Vercel
4. Configure production domain

## 🆘 Common Issues & Fixes

### WebSocket Not Connecting
```bash
# Check if running on port 3001
lsof -i :3001

# Restart WebSocket server
npm run websocket:dev
```

### Worker Not Processing
```bash
# Check Redis connection
redis-cli ping

# Check worker logs
# Look for "Worker started" message
```

### Enhancement Failing
```bash
# Check API keys
# Verify all are set in .env.local
# Check quotas/limits
```

### Build Errors
```bash
# Clear cache
rm -rf .next
npm run build
```

## ✨ Success Criteria

Your local testing is complete when:
1. ✅ All features work end-to-end
2. ✅ No console errors
3. ✅ Performance is acceptable
4. ✅ Error handling works
5. ✅ Production build succeeds

Once everything passes locally, you're ready to deploy to beautifyai.io!