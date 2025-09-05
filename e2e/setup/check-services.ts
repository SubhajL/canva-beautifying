import { request } from '@playwright/test';

/**
 * Check if required services are available before running tests
 */
export default async function globalSetup() {
  // Skip service checks in UI mode for better developer experience
  const isUIMode = process.env.PWTEST_UI_MODE === 'true' || process.env.PW_TEST_UI_MODE === 'true';
  
  if (isUIMode) {
    console.log('🎭 Running in Playwright UI mode - skipping service checks\n');
    return;
  }
  
  console.log('🔍 Checking required services...\n');
  
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
      const response = await requestContext.get(`${service.url}${service.path}`, {
        timeout: 15000,
      });
      
      if (response.ok() || response.status() < 500) {
        results.push({
          service: service.name,
          status: '✅ Available',
        });
      } else {
        results.push({
          service: service.name,
          status: '⚠️  Error',
          error: `Status: ${response.status()}`,
        });
      }
    } catch (error: any) {
      results.push({
        service: service.name,
        status: service.optional ? '⚠️  Unavailable (optional)' : '❌ Unavailable',
        error: error.message,
      });
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