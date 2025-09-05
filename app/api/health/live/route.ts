import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Liveness probe - very basic check to see if the app is running
export async function GET() {
  // Simple liveness check - if we can respond, we're alive
  return NextResponse.json(
    { 
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    }
  );
}