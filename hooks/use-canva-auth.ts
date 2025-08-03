import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { isCanvaAPIConfigured } from '@/lib/canva/api-config';
import { useToast } from '@/hooks/use-toast';

interface CanvaAuthState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useCanvaAuth() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<CanvaAuthState>({
    isConnected: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (user) {
      checkCanvaConnection();
    }
  }, [user]);

  const checkCanvaConnection = async () => {
    if (!user || !isCanvaAPIConfigured()) {
      setState({
        isConnected: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const response = await fetch('/api/canva/auth/status');
      const data = await response.json();

      setState({
        isConnected: data.connected,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState({
        isConnected: false,
        isLoading: false,
        error: 'Failed to check Canva connection',
      });
    }
  };

  const connect = async () => {
    if (!user || !isCanvaAPIConfigured()) {
      toast({
        title: 'Canva API not configured',
        description: 'Please contact support to enable Canva integration',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Generate state parameter for security
      const state = Buffer.from(JSON.stringify({
        userId: user.id,
        timestamp: Date.now(),
      })).toString('base64');

      // Get authorization URL
      const response = await fetch('/api/canva/auth/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });

      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const { authUrl } = await response.json();
      
      // Redirect to Canva OAuth
      window.location.href = authUrl;
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: 'Failed to connect to Canva. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const disconnect = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/canva/auth/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setState({
        isConnected: false,
        isLoading: false,
        error: null,
      });

      toast({
        title: 'Disconnected',
        description: 'Your Canva account has been disconnected',
      });
    } catch (error) {
      toast({
        title: 'Disconnection failed',
        description: 'Failed to disconnect Canva account',
        variant: 'destructive',
      });
    }
  };

  return {
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    error: state.error,
    connect,
    disconnect,
    checkConnection: checkCanvaConnection,
  };
}