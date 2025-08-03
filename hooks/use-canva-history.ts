import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

export interface CanvaImportHistory {
  id: string;
  url: string;
  designId: string;
  timestamp: string;
  status: 'success' | 'failed' | 'manual_required';
  fileName?: string;
}

const STORAGE_KEY = 'canva-import-history';
const MAX_HISTORY_ITEMS = 10;

export function useCanvaHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<CanvaImportHistory[]>([]);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = () => {
    if (!user) return;
    
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${user.id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as CanvaImportHistory[];
        // Sort by timestamp, newest first
        const sorted = parsed.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setHistory(sorted);
      }
    } catch (error) {
      console.error('Failed to load Canva import history:', error);
    }
  };

  const addToHistory = (item: Omit<CanvaImportHistory, 'id' | 'timestamp'>) => {
    if (!user) return;

    const newItem: CanvaImportHistory = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
    
    try {
      localStorage.setItem(
        `${STORAGE_KEY}-${user.id}`,
        JSON.stringify(updatedHistory)
      );
      setHistory(updatedHistory);
    } catch (error) {
      console.error('Failed to save Canva import history:', error);
    }
  };

  const clearHistory = () => {
    if (!user) return;
    
    try {
      localStorage.removeItem(`${STORAGE_KEY}-${user.id}`);
      setHistory([]);
    } catch (error) {
      console.error('Failed to clear Canva import history:', error);
    }
  };

  const removeFromHistory = (id: string) => {
    if (!user) return;

    const updatedHistory = history.filter(item => item.id !== id);
    
    try {
      localStorage.setItem(
        `${STORAGE_KEY}-${user.id}`,
        JSON.stringify(updatedHistory)
      );
      setHistory(updatedHistory);
    } catch (error) {
      console.error('Failed to remove from Canva import history:', error);
    }
  };

  const getRecentUrls = (limit = 5): string[] => {
    return history
      .filter(item => item.status === 'success')
      .slice(0, limit)
      .map(item => item.url);
  };

  const hasImportedDesign = (designId: string): boolean => {
    return history.some(item => 
      item.designId === designId && item.status === 'success'
    );
  };

  return {
    history,
    addToHistory,
    clearHistory,
    removeFromHistory,
    getRecentUrls,
    hasImportedDesign,
  };
}