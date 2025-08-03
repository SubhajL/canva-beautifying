import { NextRequest, NextResponse } from 'next/server';
import { checkAllUsersForReset } from '@/lib/usage/billing-cycle';

// This endpoint should be called by a cron job daily
// For example, using Vercel Cron or an external service

export async function GET(request: NextRequest) {
  // Verify the request is from an authorized source
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting daily usage reset check...');
    
    await checkAllUsersForReset();
    
    console.log('Daily usage reset check completed');
    
    return NextResponse.json({
      success: true,
      message: 'Usage reset check completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Usage reset cron job failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check usage resets',
      },
      { status: 500 }
    );
  }
}