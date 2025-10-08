import { request } from '@playwright/test';

/**
 * Check if required services are available before running tests
 */
export default async function globalSetup() {
  // Skip service checks in UI mode or when services are not explicitly enabled
  const isUIMode = process.env.PWTEST_UI_MODE === 'true' || process.env.PW_TEST_UI_MODE === 'true';
  const servicesEnabled = process.env.E2E_ENABLE_SERVICES === 'true';
  
  if (isUIMode || !servicesEnabled) {
    console.log('🎭 UI run or services disabled — skipping service checks\n');
    return;
  }
  
  console.log('🔍 Checking required services and env...\n');

  // Env readiness checklist for service-backed tests
  const requiredEnv = {
    app: ['NEXT_PUBLIC_APP_URL'],
    supabase: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    redis: ['REDIS_URL'],
    r2: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_ACCESS_KEY_ID', 'CLOUDFLARE_SECRET_ACCESS_KEY', 'CLOUDFLARE_R2_BUCKET_NAME'],
  }

  const envReport: Array<{ group: string; missing: string[] }> = []
  for (const [group, vars] of Object.entries(requiredEnv)) {
    const missing = vars.filter((v) => !process.env[v] || String(process.env[v]).trim() === '')
    envReport.push({ group, missing })
  }

  console.log('Env Readiness:')
  for (const item of envReport) {
    if (item.missing.length === 0) {
      console.log(`  ✅ ${item.group}: ok`)
    } else {
      console.log(`  ⚠️  ${item.group}: missing -> ${item.missing.join(', ')}`)
    }
  }
  
  const services = [
    {
      name: 'Next.js App',
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7071',
      path: '/',
    },
    {
      name: 'Supabase',
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      path: '/rest/v1/',
      optional: !process.env.NEXT_PUBLIC_SUPABASE_URL, // Make it optional if URL not set
    },
    {
      name: 'WebSocket Server',
      url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:5001',
      path: '/socket.io/',
      optional: true,
    },
  ];
  
  const results: { service: string; status: string; error?: string }[] = [];
  
  // Create a request context
  const requestContext = await request.newContext();
  
  for (const service of services) {
    if (!service.url && !service.optional) {
      results.push({
        service: service.name,
        status: '❌ Missing URL',
        error: `Environment variable not set`,
      });
      continue;
    }
    
    if (!service.url) continue;
    
    try {
      // Backoff readiness: try up to 6 times over ~20s
      let ok = false
      let lastErr: any
      for (let attempt = 1; attempt <= 6; attempt++) {
        try {
          const response = await requestContext.get(`${service.url}${service.path}`, { timeout: 5000 })
          if (response.ok() || response.status() < 500) {
            ok = true
            break
          } else {
            lastErr = `Status: ${response.status()}`
          }
        } catch (e: any) {
          lastErr = e?.message || String(e)
        }
        console.log(`  … waiting for ${service.name} (attempt ${attempt}/6)`) 
        await new Promise(r => setTimeout(r, 1500 * attempt))
      }
      if (ok) {
        results.push({ service: service.name, status: '✅ Available' })
      } else {
        results.push({ service: service.name, status: service.optional ? '⚠️  Unavailable (optional)' : '❌ Unavailable', error: String(lastErr || 'unknown') })
      }
    } catch (error: any) {
      results.push({ service: service.name, status: service.optional ? '⚠️  Unavailable (optional)' : '❌ Unavailable', error: error.message })
    }
  }
  
  // Dispose the context
  await requestContext.dispose();
  
  // Print results
  console.log('Service Status:');
  console.log('─'.repeat(50));
  
  for (const result of results) {
    console.log(`${result.service}: ${result.status}`);
    if (result.error) {
      console.log(`  └─ ${result.error}`);
    }
  }
  
  console.log('─'.repeat(50));
  
  // Check if any required services are down
  const hasFailures = results.some(r => r.status.includes('❌'));
  
  if (hasFailures) {
    console.error('\n❌ Some required services are not available.');
    console.error('Please ensure all services are running before running tests.\n');
    // Don't use process.exit() as it breaks Playwright UI
    throw new Error('Required services are not available. Please check the console output above.');
  } else {
    console.log('\n✅ All required services are available!\n');
  }
}
