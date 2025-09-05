import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import type { DashboardData } from '@/types/monitoring';

interface RealtimeMetrics {
  connected: boolean;
  lastUpdate: Date | null;
  metrics: Partial<DashboardData> | null;
}

export function useRealtimeMetrics() {
  const [state, setState] = useState<RealtimeMetrics>({
    connected: false,
    lastUpdate: null,
    metrics: null,
  });
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Connect to WebSocket server
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5001', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to monitoring WebSocket');
      setState(prev => ({ ...prev, connected: true }));
      
      // Subscribe to monitoring updates
      socket.emit('subscribe', { channel: 'monitoring' });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from monitoring WebSocket');
      setState(prev => ({ ...prev, connected: false }));
    });

    socket.on('metrics:update', (data: Partial<DashboardData>) => {
      setState(prev => ({
        ...prev,
        lastUpdate: new Date(),
        metrics: data,
      }));

      // Update React Query cache with partial data
      queryClient.setQueryData(['monitoring', 'dashboard'], (old: DashboardData | undefined) => {
        if (!old) return old;
        return {
          ...old,
          ...data,
        };
      });
    });

    socket.on('alert:new', (alert: any) => {
      // Add new alert to the dashboard data
      queryClient.setQueryData(['monitoring', 'dashboard'], (old: DashboardData | undefined) => {
        if (!old) return old;
        return {
          ...old,
          alerts: [alert, ...old.alerts].slice(0, 50), // Keep last 50 alerts
        };
      });
    });

    socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [queryClient]);

  // Fallback to polling if WebSocket fails
  useEffect(() => {
    if (!state.connected) {
      const pollInterval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['monitoring', 'dashboard'] });
      }, 10000); // Poll every 10 seconds when disconnected

      return () => clearInterval(pollInterval);
    }
  }, [state.connected, queryClient]);

  return state;
}