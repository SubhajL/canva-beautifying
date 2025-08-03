import { EmailService } from '../email-service'
import { createClient } from '@/lib/supabase/client'

export async function sendEnhancementCompletedNotification(
  enhancementId: string
): Promise<void> {
  try {
    // Fetch enhancement details
    const supabase = createClient()
    const { data: enhancement, error: enhancementError } = await supabase
      .from('enhancements')
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .eq('id', enhancementId)
      .single()

    if (enhancementError || !enhancement) {
      console.error('Failed to fetch enhancement:', enhancementError)
      return
    }

    if (!enhancement.users || enhancement.status !== 'completed') {
      return
    }

    // Calculate improvement score from analysis data
    const analysisData = enhancement.analysis_data as any
    const improvementScore = analysisData?.overallScore || 0

    // Generate preview URLs if available
    const originalPreviewUrl = enhancement.original_url
    const enhancedPreviewUrl = enhancement.enhanced_url

    // Send email
    await EmailService.sendEnhancementCompletedEmail(
      enhancement.users.id,
      {
        userName: enhancement.users.name || 'User',
        userEmail: enhancement.users.email,
        documentName: analysisData?.documentName || 'Your document',
        enhancementUrl: `/app/enhancements/${enhancementId}`,
        originalPreviewUrl,
        enhancedPreviewUrl,
        processingTime: enhancement.processing_time || 0,
        improvementScore: Math.round(improvementScore),
      }
    )
  } catch (error) {
    console.error('Error sending enhancement completed email:', error)
  }
}

export async function sendEnhancementFailedNotification(
  enhancementId: string,
  errorMessage: string
): Promise<void> {
  try {
    // Fetch enhancement details
    const supabase = createClient()
    const { data: enhancement, error: enhancementError } = await supabase
      .from('enhancements')
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .eq('id', enhancementId)
      .single()

    if (enhancementError || !enhancement || !enhancement.users) {
      console.error('Failed to fetch enhancement:', enhancementError)
      return
    }

    // For now, we'll just log the failure
    // In a full implementation, we'd have a failure email template
    console.log(`Enhancement ${enhancementId} failed for user ${enhancement.users.email}: ${errorMessage}`)
    
    // TODO: Implement failure email template
  } catch (error) {
    console.error('Error sending enhancement failed email:', error)
  }
}