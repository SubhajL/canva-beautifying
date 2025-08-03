import { EmailService } from '../email-service'
import { createClient } from '@/lib/supabase/client'

const tierCredits: Record<string, number> = {
  free: 10,
  basic: 100,
  pro: 500,
  premium: 2000,
}

export async function sendWelcomeEmailToNewUser(userId: string): Promise<void> {
  try {
    // Fetch user details
    const supabase = createClient()
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error('Failed to fetch user:', userError)
      return
    }

    // Send welcome email
    await EmailService.sendWelcomeEmail(userId, {
      userName: user.name || 'there',
      userEmail: user.email,
      userTier: (user.subscription_tier || 'free') as 'free' | 'basic' | 'pro' | 'premium',
      monthlyCredits: tierCredits[user.subscription_tier || 'free'],
    })
  } catch (error) {
    console.error('Error sending welcome email:', error)
  }
}

export async function sendPasswordResetRequestEmail(
  email: string,
  resetToken: string,
  requestInfo?: {
    ipAddress?: string
    userAgent?: string
  }
): Promise<void> {
  try {
    // Fetch user by email
    const supabase = createClient()
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('name')
      .eq('email', email)
      .single()

    if (userError) {
      // Don't reveal if user exists or not
      console.error('User lookup error:', userError)
      return
    }

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`

    await EmailService.sendPasswordResetEmail({
      userName: user?.name || email.split('@')[0],
      userEmail: email,
      resetUrl,
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    })
  } catch (error) {
    console.error('Error sending password reset email:', error)
  }
}