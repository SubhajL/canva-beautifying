#!/usr/bin/env node

/**
 * Script to make a user a beta tester
 * Usage: node scripts/make-user-beta.js <user-email>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function makeUserBeta(email) {
  try {
    // Find user by email
    const { data: users, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !users) {
      console.error('User not found:', email);
      return;
    }

    const userId = users.id;

    // Update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        is_beta_user: true,
        beta_joined_at: new Date().toISOString(),
        beta_referral_source: 'admin',
        feature_flags: {
          beta_access: true,
          beta_feedback_widget: true,
          beta_analytics: true,
          beta_priority_support: true,
          batch_processing: true,
          advanced_ai_models: true,
          custom_templates: true,
          enhanced_upload_limit: true,
          priority_queue: true,
        },
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return;
    }

    // Track beta joining
    await supabase.from('beta_analytics').insert({
      user_id: userId,
      event_type: 'beta_joined',
      event_category: 'onboarding',
      event_action: 'admin_added',
      metadata: {
        source: 'admin_script',
      },
    });

    console.log(`✅ Successfully made ${email} a beta user!`);
    console.log(`User ID: ${userId}`);
    console.log('Beta features enabled:');
    console.log('- Beta Access');
    console.log('- Beta Feedback Widget');
    console.log('- Beta Analytics');
    console.log('- Beta Priority Support');
    console.log('- Batch Processing');
    console.log('- Advanced AI Models');
    console.log('- Custom Templates');
    console.log('- Enhanced Upload Limits');
    console.log('- Priority Queue');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/make-user-beta.js <user-email>');
  process.exit(1);
}

makeUserBeta(email);