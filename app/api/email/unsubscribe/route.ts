import { NextRequest, NextResponse } from 'next/server'
import { EmailPreferencesManager } from '@/lib/email/preferences'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    const emailType = searchParams.get('type')

    if (!token) {
      return NextResponse.json(
        { error: 'Missing unsubscribe token' },
        { status: 400 }
      )
    }

    const success = await EmailPreferencesManager.unsubscribeByToken(token)

    if (!success) {
      return NextResponse.json(
        { error: 'Invalid or expired unsubscribe token' },
        { status: 400 }
      )
    }

    // Redirect to a success page
    const successUrl = new URL('/unsubscribe/success', request.url)
    if (emailType) {
      successUrl.searchParams.set('type', emailType)
    }
    
    return NextResponse.redirect(successUrl)
  } catch (error) {
    console.error('Error processing unsubscribe:', error)
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' },
      { status: 500 }
    )
  }
}