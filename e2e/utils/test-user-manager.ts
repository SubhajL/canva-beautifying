import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface TestUser {
  email: string;
  password: string;
  tier: 'free' | 'pro' | 'premium';
}

export class TestUserManager {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // Use service role key for admin operations
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Ensures a test user exists with the given credentials
   */
  async ensureTestUserExists(
    tier: 'free' | 'pro' | 'premium',
    retryCount = 3
  ): Promise<TestUser> {
    const email = process.env[`TEST_${tier.toUpperCase()}_USER_EMAIL`];
    const password = process.env[`TEST_${tier.toUpperCase()}_USER_PASSWORD`];

    if (!email || !password) {
      throw new Error(`Test user credentials not configured for tier: ${tier}`);
    }

    const user: TestUser = { email, password, tier };

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        // First, check if user exists by trying to sign in
        const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInData?.user) {
          console.log(`✅ Test user ${tier} already exists: ${email}`);
          return user;
        }

        // If sign in failed, check if user exists using admin API
        // Need to paginate through all users since default is only 50
        let page = 1;
        let existingUser = null;

        while (!existingUser) {
          const { data: userData, error: userError } = await this.supabase.auth.admin.listUsers({
            page,
            perPage: 50,
          });

          if (userError) {
            console.error('Error listing users:', userError);
            break;
          }

          if (!userData?.users || userData.users.length === 0) {
            break; // No more users
          }

          console.log(`Checking page ${page} with ${userData.users.length} users for ${email}`);
          existingUser = userData.users.find((u: any) => u.email === email);

          if (!existingUser && userData.users.length === 50) {
            page++; // Continue to next page if we haven't found the user and got a full page
          } else {
            break; // Found the user or reached the end
          }
        }

        if (existingUser) {
          // User exists, update password
          const { error: updateError } = await this.supabase.auth.admin.updateUserById(
            existingUser.id,
            { password }
          );

          if (!updateError) {
            console.log(`✅ Updated password for test user ${tier}: ${email}`);

            // Ensure user record exists in public schema
            await this.ensureUserRecord(existingUser.id, email, tier);

            return user;
          } else {
            console.error(`Failed to update password for ${email}:`, updateError);
            throw updateError;
          }
        }

        // User doesn't exist, create it
        const { data: createData, error: createError } = await this.supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            subscription_tier: tier,
            is_test_user: true,
          },
        });

        if (createData?.user) {
          console.log(`✅ Created test user ${tier}: ${email}`);

          // Ensure user record exists in public schema
          await this.ensureUserRecord(createData.user.id, email, tier);

          return user;
        }

        if (createError) {
          // If user already exists error, try updating password
          if (createError.message?.includes('already been registered') ||
              createError.code === 'email_exists' ||
              createError.message?.includes('email address has already been registered')) {
            const { data: userData } = await this.supabase.auth.admin.listUsers();
            const existingUser = userData?.users?.find((u: any) => u.email === email);

            if (existingUser) {
              const { error: updateError } = await this.supabase.auth.admin.updateUserById(existingUser.id, { password });
              if (updateError) {
                console.error(`Failed to update password for ${email}:`, updateError);
                throw updateError;
              }
              console.log(`✅ Updated existing test user ${tier}: ${email}`);

              // Ensure user record exists in public schema
              await this.ensureUserRecord(existingUser.id, email, tier);

              return user;
            }
          }

          throw createError;
        }

      } catch (error) {
        console.error(`Attempt ${attempt}/${retryCount} failed:`, error);
        if (attempt === retryCount) {
          throw new Error(`Failed to ensure test user exists after ${retryCount} attempts: ${error}`);
        }
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('Failed to ensure test user exists');
  }

  /**
   * Validates test credentials before attempting authentication
   */
  async validateTestCredentials(email: string, password: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error(`❌ Invalid credentials for ${email}: ${error.message}`);
        return false;
      }

      if (data?.session) {
        // Sign out immediately to not leave sessions open
        await this.supabase.auth.signOut();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error validating credentials:', error);
      return false;
    }
  }

  /**
   * Resets test user password if authentication fails
   */
  async resetTestUserPassword(email: string): Promise<string> {
    const newPassword = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Get user by email
      const { data: userData, error: listError } = await this.supabase.auth.admin.listUsers();

      if (listError) {
        throw new Error(`Failed to list users: ${listError.message}`);
      }

      const user = userData?.users?.find((u: any) => u.email === email);

      if (!user) {
        throw new Error(`User not found: ${email}`);
      }

      // Update password
      const { error: updateError } = await this.supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) {
        throw new Error(`Failed to update password: ${updateError.message}`);
      }

      console.log(`✅ Reset password for ${email}`);
      return newPassword;

    } catch (error) {
      throw new Error(`Failed to reset password for ${email}: ${error}`);
    }
  }

  /**
   * Ensures user record exists in public schema
   */
  private async ensureUserRecord(userId: string, email: string, tier: string): Promise<void> {
    try {
      // Check if user record exists
      const { data: existingUser, error: selectError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error checking user record:', selectError);
        return;
      }

      if (!existingUser) {
        // Create user record
        const { error: insertError } = await this.supabase
          .from('users')
          .insert({
            id: userId,
            email,
            subscription_tier: tier,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error creating user record:', insertError);
        } else {
          console.log(`✅ Created user record for ${email}`);
        }
      }
    } catch (error) {
      console.error('Error ensuring user record:', error);
    }
  }

  /**
   * Cleanup test users (optional - for test cleanup)
   */
  async cleanupTestUsers(): Promise<void> {
    const tiers: Array<'free' | 'pro' | 'premium'> = ['free', 'pro', 'premium'];

    for (const tier of tiers) {
      const email = process.env[`TEST_${tier.toUpperCase()}_USER_EMAIL`];
      if (email) {
        try {
          const { data: userData } = await this.supabase.auth.admin.listUsers();
          const user = userData?.users?.find((u: any) => u.email === email);

          if (user) {
            await this.supabase.auth.admin.deleteUser(user.id);
            console.log(`🧹 Cleaned up test user ${tier}: ${email}`);
          }
        } catch (error) {
          console.error(`Failed to cleanup ${tier} user:`, error);
        }
      }
    }
  }
}