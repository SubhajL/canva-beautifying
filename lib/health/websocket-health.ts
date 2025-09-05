import type { HealthCheckResult } from './types';
import { logger } from '@/lib/observability';
import { sessionStore } from '@/lib/redis/session-store';

export async function checkWebSocketHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:5001';
    const timeout = 5000; // 5 seconds

    // Try to connect to WebSocket server's health endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${wsUrl}/health`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`WebSocket server returned ${response.status}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      // Check session store health
      let sessionStoreHealthy = false;
      let sessionCounts: Record<string, number> = {};
      try {
        sessionStoreHealthy = await sessionStore.healthCheck();
        sessionCounts = await sessionStore.getSessionCounts();
      } catch (error) {
        logger.error({ err: error }, 'Session store health check failed');
      }

      // Determine status based on WebSocket server metrics
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let error: string | undefined;

      if (!data.healthy) {
        status = 'unhealthy';
        error = 'WebSocket server is not healthy';
      } else if (!sessionStoreHealthy) {
        status = 'degraded';
        error = 'Session store is unavailable';
      } else if (data.connections > 1000) {
        status = 'degraded';
        error = `High connection count: ${data.connections}`;
      } else if (data.rooms > 500) {
        status = 'degraded';
        error = `High room count: ${data.rooms}`;
      }

      const totalSessions = Object.values(sessionCounts).reduce((a, b) => a + b, 0);

      return {
        service: 'websocket',
        status,
        responseTime,
        error,
        details: {
          url: wsUrl,
          connections: data.connections || 0,
          rooms: data.rooms || 0,
          uptime: data.uptime || 0,
          memoryUsage: data.memoryUsage,
          sessionStore: {
            healthy: sessionStoreHealthy,
            totalSessions,
            uniqueUsers: Object.keys(sessionCounts).length
          }
        }
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('WebSocket health check timeout');
      }
      
      throw fetchError;
    }
  } catch (error) {
    logger.error({ err: error }, 'WebSocket health check failed');
    
    // If we can't reach the WebSocket server, it might be down
    return {
      service: 'websocket',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'WebSocket server unavailable',
      details: {
        url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:5001'
      }
    };
  }
}

// This function can be used by the WebSocket server itself
export function createWebSocketHealthEndpoint() {
  return async (io: any) => {
    const sockets = await io.fetchSockets();
    const rooms = io.of('/').adapter.rooms;
    
    // Get session store health
    let sessionStoreHealthy = false;
    let sessionCounts: Record<string, number> = {};
    try {
      sessionStoreHealthy = await sessionStore.healthCheck();
      sessionCounts = await sessionStore.getSessionCounts();
    } catch (error) {
      logger.error({ err: error }, 'Session store health check failed');
    }
    
    const totalSessions = Object.values(sessionCounts).reduce((a, b) => a + b, 0);
    
    return {
      healthy: true && sessionStoreHealthy,
      connections: sockets.length,
      rooms: rooms.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      sessionStore: {
        healthy: sessionStoreHealthy,
        totalSessions,
        uniqueUsers: Object.keys(sessionCounts).length
      },
      timestamp: new Date().toISOString()
    };
  };
}