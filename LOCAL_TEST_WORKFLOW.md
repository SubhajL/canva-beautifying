# 🧪 Local End-to-End Test Workflow

## Quick Start Testing (15 minutes)

### 1️⃣ Pre-flight Check (2 min)
```bash
# Run setup checker
node scripts/test-local-setup.js

# Should see mostly green checkmarks ✅
```

### 2️⃣ Start All Services (3 min)

Open 3 terminal windows:

**Terminal 1 - Next.js Dev Server:**
```bash
npm run dev
# Wait for: ✓ Ready on http://localhost:5000
```

**Terminal 2 - Worker Process:**
```bash
npm run workers:dev
# Wait for: ✓ Worker started, waiting for jobs...
```

**Terminal 3 - WebSocket Server:**
```bash
npm run websocket:dev
# Wait for: ✓ WebSocket server running on port 3001
```

### 3️⃣ Test Critical Path (10 min)

#### A. Test Homepage
1. Open http://localhost:5000
2. ✅ Should see landing page
3. ✅ No console errors (F12)

#### B. Test Authentication
1. Click "Get Started" or "Sign Up"
2. Create account with email
3. ✅ Should redirect to dashboard

#### C. Test Document Upload
1. On dashboard, click "Upload Document"
2. Upload a test image (PNG or JPG)
3. ✅ Should see upload progress
4. ✅ Document appears in dashboard

#### D. Test Enhancement
1. Click on uploaded document
2. Click "Enhance Document"
3. Select all enhancement options
4. Click "Start Enhancement"
5. ✅ Should see real-time progress
6. ✅ Should complete in 1-2 minutes

#### E. Test Export
1. On enhanced document, click "Export"
2. Select "PNG" format
3. Click "Download"
4. ✅ File should download
5. ✅ Image should open correctly

## 🎯 What Success Looks Like

### ✅ All Systems Green:
```
[Terminal 1] Next.js:    ✓ Compiled successfully
[Terminal 2] Worker:     ✓ Job completed successfully
[Terminal 3] WebSocket:  ✓ Client connected
[Browser]    Console:    No errors
```

### ✅ User Can:
- Sign up/Login
- Upload a document
- Enhance it with AI
- Download the result
- See real-time progress

## 🔍 Detailed Test Scenarios

### Scenario 1: First-Time User
```
1. Land on homepage → Sign up
2. Upload worksheet/flyer → Enhance
3. Download result → Success!
Time: ~5 minutes
```

### Scenario 2: Test Each File Type
```
✅ PNG image (screenshot, design)
✅ JPG photo (flyer, poster)  
✅ PDF document (worksheet)
✅ Canva URL import
```

### Scenario 3: Test Enhancement Options
```
✅ Typography only
✅ Colors only
✅ Layout only
✅ All options combined
```

### Scenario 4: Test Export Formats
```
✅ PNG (1x, 2x scale)
✅ JPG (50%, 80%, 100% quality)
✅ PDF (with metadata)
✅ Canva JSON
```

## 🚨 Common Issues & Quick Fixes

### Issue: "Cannot connect to Supabase"
```bash
# Check your .env.local has:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Restart dev server after changes
```

### Issue: "Redis connection failed"
```bash
# Option 1: Use cloud Redis (Upstash)
REDIS_URL=redis://default:password@host:port

# Option 2: Run Redis locally
brew install redis
redis-server
```

### Issue: "Worker not processing jobs"
```bash
# Check worker terminal for errors
# Restart worker: Ctrl+C then npm run workers:dev
# Check Redis is running
```

### Issue: "WebSocket not connecting"
```bash
# Check port 3001 is free
lsof -i :3001
# Restart WebSocket server
```

## 📊 Performance Benchmarks

During local testing, expect:

| Action | Expected Time |
|--------|--------------|
| Page Load | < 2 seconds |
| Image Upload (5MB) | < 5 seconds |
| Enhancement Process | 30-90 seconds |
| Export Generation | < 10 seconds |

## ✅ Ready for Production Checklist

Before deploying to beautifyai.io:

- [ ] All test scenarios pass
- [ ] No console errors
- [ ] Enhancement completes successfully
- [ ] Exports work for all formats
- [ ] Real-time updates working
- [ ] Error messages are user-friendly
- [ ] Performance is acceptable
- [ ] Build succeeds: `npm run build`

## 🚀 Quick Test Commands

```bash
# Test specific features
npm run test:r2          # Test R2 storage
npm run test:supabase    # Test database
npm run test:ai          # Test AI services
npm run test:images      # Test image generation
npm run test:export      # Test export functionality

# Run all tests
npm test

# Build for production
npm run build
npm start  # Test production build
```

## 📝 Test Log Template

```
Date: [Today's Date]
Tester: [Your Name]

Environment:
- Node: v20.x
- OS: macOS
- Browser: Chrome

Test Results:
✅ Homepage loads
✅ Authentication works
✅ Upload successful
✅ Enhancement completes
✅ Export downloads
✅ WebSocket connected
✅ No console errors

Issues Found:
- None / List any issues

Ready to Deploy: YES ✅
```

---

**Once all tests pass locally, you're ready to deploy to beautifyai.io!** 🎉