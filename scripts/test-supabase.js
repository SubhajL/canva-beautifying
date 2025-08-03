// Test Supabase connection
// Run with: node scripts/test-supabase.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testSupabase() {
  console.log("Testing Supabase connection...\n")

  // Check if credentials are set
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("❌ Missing Supabase credentials in .env.local")
    console.log("\nPlease add these to your .env.local file:")
    console.log("NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co")
    console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here")
    return
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    // Test 1: Check connection
    console.log("1. Testing connection...")
    const { data, error } = await supabase.from('users').select('count').limit(1)
    
    if (error && error.code === '42P01') {
      console.log("❌ Tables not found. Please run the schema.sql in your Supabase SQL editor.")
      return
    }
    
    if (error) throw error
    
    console.log("✅ Connected to Supabase!")

    // Test 2: Check auth configuration
    console.log("\n2. Testing auth configuration...")
    const { data: authData, error: authError } = await supabase.auth.getSession()
    
    if (authError) throw authError
    
    console.log("✅ Auth is configured!")
    console.log("   Session:", authData.session ? "Active" : "None")

    // Test 3: Check if tables exist
    console.log("\n3. Checking database tables...")
    const tables = ['users', 'enhancements', 'enhancement_assets', 'usage_tracking', 'subscription_limits']
    
    for (const table of tables) {
      const { error: tableError } = await supabase.from(table).select('count').limit(1)
      
      if (tableError && tableError.code === '42P01') {
        console.log(`❌ Table '${table}' not found`)
      } else if (tableError) {
        console.log(`❌ Error checking '${table}': ${tableError.message}`)
      } else {
        console.log(`✅ Table '${table}' exists`)
      }
    }

    console.log("\n🎉 Supabase setup is working correctly!")
    console.log("\nNext steps:")
    console.log("1. Run schema.sql in Supabase SQL editor if tables are missing")
    console.log("2. Configure OAuth providers in Supabase dashboard")
    console.log("3. Update auth redirect URLs for your domain")
    
  } catch (error) {
    console.error("❌ Supabase connection failed:", error.message)
    console.log("\nTroubleshooting:")
    console.log("1. Check your credentials in .env.local")
    console.log("2. Ensure your Supabase project is active")
    console.log("3. Check if you're on the correct network (no firewall blocking)")
  }
}

testSupabase()