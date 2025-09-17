import { test as setup } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import { TestUserManager } from '../utils/test-user-manager';

const authDir = path.join(__dirname, '../.auth');

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

const TEST_USERS = {
  free: {
    email: process.env.TEST_FREE_USER_EMAIL || 'subhaj.limanond+free@gmail.com',
    password: process.env.TEST_FREE_USER_PASSWORD || 'testpass123',
    storageFile: 'free-user.json'
  },
  pro: {
    email: process.env.TEST_PRO_USER_EMAIL || 'subhaj.limanond+pro@gmail.com',
    password: process.env.TEST_PRO_USER_PASSWORD || 'testpass123',
    storageFile: 'pro-user.json'
  },
  premium: {
    email: process.env.TEST_PREMIUM_USER_EMAIL || 'subhaj.limanond+premium@gmail.com',
    password: process.env.TEST_PREMIUM_USER_PASSWORD || 'testpass123',
    storageFile: 'premium-user.json'
  }
};

setup.describe('Direct Authentication setup', () => {
  // Create test user manager instance
  const userManager = new TestUserManager();

  for (const [tier, user] of Object.entries(TEST_USERS)) {
    setup(`authenticate as ${tier} user`, async ({ page, context }) => {
      console.log(`🔐 Authenticating ${tier} user via API: ${user.email}`);

      // Ensure user exists before attempting authentication
      try {
        await userManager.ensureTestUserExists(tier as 'free' | 'pro' | 'premium');
      } catch (error) {
        console.error(`Failed to ensure ${tier} user exists:`, error);
        // Continue with authentication anyway
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      // Create Supabase client
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Try to sign in directly via Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });

      if (error) {
        console.error(`Failed to authenticate ${tier} user:`, error.message);
        throw new Error(`Authentication failed for ${tier} user: ${error.message}`);
      }
      
      if (!data.session) {
        throw new Error(`No session returned for ${tier} user`);
      }
      
      console.log(`✅ Successfully authenticated ${tier} user`);
      
      // Supabase SSR uses specific cookie names with the project ref
      const projectRef = 'wiqivltglqmhwomeiaey'; // From SUPABASE_URL
      
      // Set the session cookies in the browser context
      // Supabase uses chunked cookies for the session
      const sessionData = JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: 'bearer',
        user: data.session.user
      });
      
      // Split session into chunks if needed (Supabase does this for large sessions)
      const chunkSize = 3600;
      const chunks = [];
      for (let i = 0; i < sessionData.length; i += chunkSize) {
        chunks.push(sessionData.slice(i, i + chunkSize));
      }
      
      const cookies = [];
      
      if (chunks.length === 1) {
        // Single cookie for small sessions
        cookies.push({
          name: `sb-${projectRef}-auth-token`,
          value: sessionData,
          domain: 'localhost',
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
          expires: data.session.expires_at ? new Date(data.session.expires_at * 1000).getTime() / 1000 : undefined
        });
      } else {
        // Multiple cookies for large sessions
        chunks.forEach((chunk, index) => {
          cookies.push({
            name: `sb-${projectRef}-auth-token.${index}`,
            value: chunk,
            domain: 'localhost',
            path: '/',
            httpOnly: false,
            secure: false,
            sameSite: 'Lax' as const,
            expires: data.session.expires_at ? new Date(data.session.expires_at * 1000).getTime() / 1000 : undefined
          });
        });
      }
      
      await context.addCookies(cookies);

      // Also set localStorage token for the app origin so createBrowserClient hydrates immediately
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7071'
      await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
      await page.evaluate(({ key, value }) => {
        localStorage.setItem(key, value)
      }, { key: `sb-${projectRef}-auth-token`, value: sessionData })

      // Save storage state after setting both cookies and localStorage
      const storagePath = path.join(authDir, user.storageFile);
      await context.storageState({ path: storagePath });
      
      console.log(`✓ Saved auth state to ${user.storageFile}`);
    });
  }
  
  // Also create a general user.json for default tests
  setup('authenticate default user', async ({ page, context }) => {
    const defaultUser = TEST_USERS.free;
    console.log('🔐 Authenticating default user via API');

    // Ensure default (free) user exists
    try {
      await userManager.ensureTestUserExists('free');
    } catch (error) {
      console.error('Failed to ensure default user exists:', error);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: defaultUser.email,
      password: defaultUser.password,
    });
    
    if (error) {
      throw new Error(`Default user authentication failed: ${error.message}`);
    }
    
    if (!data.session) {
      throw new Error('No session returned for default user');
    }
    
    const projectRef = 'wiqivltglqmhwomeiaey';
    const sessionData = JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: 'bearer',
      user: data.session.user
    });
    
    const cookies = [{
      name: `sb-${projectRef}-auth-token`,
      value: sessionData,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
      expires: data.session.expires_at ? new Date(data.session.expires_at * 1000).getTime() / 1000 : undefined
    }];
    
    await context.addCookies(cookies);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7071'
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.evaluate(({ key, value }) => {
      localStorage.setItem(key, value)
    }, { key: `sb-${projectRef}-auth-token`, value: sessionData })

    const storagePath = path.join(authDir, 'user.json');
    await context.storageState({ path: storagePath });
    
    console.log('✓ Saved default auth state to user.json');
  });
});
