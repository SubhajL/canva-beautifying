import { createClient } from '@/lib/supabase/client'
import { EmailPreferences } from './types'

export class EmailPreferencesManager {
  static async getPreferences(userId: string): Promise<EmailPreferences | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      // If no preferences exist, create default ones
      if (error.code === 'PGRST116') {
        return this.createDefaultPreferences(userId)
      }
      console.error('Error fetching email preferences:', error)
      return null
    }

    return {
      userId: data.user_id,
      enhancementCompleted: data.enhancement_completed,
      marketingEmails: data.marketing_emails,
      weeklyDigest: data.weekly_digest,
      systemNotifications: data.system_notifications,
      updatedAt: new Date(data.updated_at),
    }
  }

  static async updatePreferences(
    userId: string,
    preferences: Partial<Omit<EmailPreferences, 'userId' | 'updatedAt'>>
  ): Promise<EmailPreferences | null> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (preferences.enhancementCompleted !== undefined) {
      updateData.enhancement_completed = preferences.enhancementCompleted
    }
    if (preferences.marketingEmails !== undefined) {
      updateData.marketing_emails = preferences.marketingEmails
    }
    if (preferences.weeklyDigest !== undefined) {
      updateData.weekly_digest = preferences.weeklyDigest
    }
    if (preferences.systemNotifications !== undefined) {
      updateData.system_notifications = preferences.systemNotifications
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('email_preferences')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      // If preferences don't exist, create them
      if (error.code === 'PGRST116') {
        return this.createDefaultPreferences(userId, preferences)
      }
      console.error('Error updating email preferences:', error)
      return null
    }

    return {
      userId: data.user_id,
      enhancementCompleted: data.enhancement_completed,
      marketingEmails: data.marketing_emails,
      weeklyDigest: data.weekly_digest,
      systemNotifications: data.system_notifications,
      updatedAt: new Date(data.updated_at),
    }
  }

  static async unsubscribeAll(userId: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase
      .from('email_preferences')
      .update({
        enhancement_completed: false,
        marketing_emails: false,
        weekly_digest: false,
        system_notifications: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (error) {
      console.error('Error unsubscribing from all emails:', error)
      return false
    }

    return true
  }

  static async unsubscribeByToken(token: string): Promise<boolean> {
    // Decode the unsubscribe token to get user ID and email type
    try {
      const decoded = this.decodeUnsubscribeToken(token)
      if (!decoded) return false

      const { userId, emailType } = decoded

      if (emailType === 'all') {
        return this.unsubscribeAll(userId)
      }

      const preferenceField = this.getPreferenceField(emailType)
      if (!preferenceField) return false

      const supabase = createClient()
      const { error } = await supabase
        .from('email_preferences')
        .update({
          [preferenceField]: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      return !error
    } catch (error) {
      console.error('Error processing unsubscribe token:', error)
      return false
    }
  }

  private static async createDefaultPreferences(
    userId: string,
    overrides?: Partial<Omit<EmailPreferences, 'userId' | 'updatedAt'>>
  ): Promise<EmailPreferences> {
    const defaultPreferences = {
      user_id: userId,
      enhancement_completed: overrides?.enhancementCompleted ?? true,
      marketing_emails: overrides?.marketingEmails ?? false,
      weekly_digest: overrides?.weeklyDigest ?? true,
      system_notifications: overrides?.systemNotifications ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('email_preferences')
      .insert(defaultPreferences)
      .select()
      .single()

    if (error) {
      console.error('Error creating default email preferences:', error)
      // Return in-memory defaults if creation fails
      return {
        userId,
        enhancementCompleted: defaultPreferences.enhancement_completed,
        marketingEmails: defaultPreferences.marketing_emails,
        weeklyDigest: defaultPreferences.weekly_digest,
        systemNotifications: defaultPreferences.system_notifications,
        updatedAt: new Date(),
      }
    }

    return {
      userId: data.user_id,
      enhancementCompleted: data.enhancement_completed,
      marketingEmails: data.marketing_emails,
      weeklyDigest: data.weekly_digest,
      systemNotifications: data.system_notifications,
      updatedAt: new Date(data.updated_at),
    }
  }

  static generateUnsubscribeToken(userId: string, emailType: string): string {
    // In production, use a proper JWT or encrypted token
    const data = `${userId}:${emailType}:${Date.now()}`
    return Buffer.from(data).toString('base64url')
  }

  private static decodeUnsubscribeToken(token: string): { userId: string; emailType: string } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString()
      const [userId, emailType] = decoded.split(':')
      return { userId, emailType }
    } catch {
      return null
    }
  }

  private static getPreferenceField(emailType: string): string | null {
    const fieldMap: Record<string, string> = {
      'enhancement-completed': 'enhancement_completed',
      'marketing': 'marketing_emails',
      'weekly-digest': 'weekly_digest',
      'system': 'system_notifications',
    }
    return fieldMap[emailType] || null
  }

  static async getUnsubscribeStats(days = 30): Promise<{
    totalUnsubscribes: number
    byType: Record<string, number>
    trend: 'increasing' | 'decreasing' | 'stable'
  }> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('email_preferences')
      .select('*')
      .gte('updated_at', startDate.toISOString())

    if (error || !data) {
      return {
        totalUnsubscribes: 0,
        byType: {},
        trend: 'stable',
      }
    }

    let totalUnsubscribes = 0
    const byType: Record<string, number> = {
      enhancement_completed: 0,
      marketing_emails: 0,
      weekly_digest: 0,
      system_notifications: 0,
    }

    data.forEach(pref => {
      if (!pref.enhancement_completed) byType.enhancement_completed++
      if (!pref.marketing_emails) byType.marketing_emails++
      if (!pref.weekly_digest) byType.weekly_digest++
      if (!pref.system_notifications) byType.system_notifications++
    })

    totalUnsubscribes = Object.values(byType).reduce((sum, count) => sum + count, 0)

    // Simple trend analysis (in production, this would be more sophisticated)
    const trend = totalUnsubscribes > data.length * 2 ? 'increasing' : 
                  totalUnsubscribes < data.length * 0.5 ? 'decreasing' : 'stable'

    return {
      totalUnsubscribes,
      byType,
      trend,
    }
  }
}