import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';

export interface Enhancement {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  file_type: string;
  file_size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  enhancement_type?: string;
  original_url?: string;
  enhanced_url?: string;
  thumbnail_url?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

interface UseEnhancementsOptions {
  limit?: number;
  page?: number;
  search?: string;
  status?: string;
  sortBy?: 'created_at' | 'title' | 'status';
  sortOrder?: 'asc' | 'desc';
}

interface UseEnhancementsReturn {
  enhancements: Enhancement[] | null;
  loading: boolean;
  error: Error | null;
  totalCount: number | null;
  refetch: () => void;
}

export function useEnhancements(options: UseEnhancementsOptions = {}): UseEnhancementsReturn {
  const { 
    limit = 10, 
    page = 1, 
    search, 
    status, 
    sortBy = 'created_at', 
    sortOrder = 'desc' 
  } = options;
  
  const { user } = useAuth();
  const [enhancements, setEnhancements] = useState<Enhancement[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const fetchEnhancements = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      
      // Build query
      let query = supabase
        .from('documents')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      // Apply filters
      if (search) {
        query = query.ilike('title', `%${search}%`);
      }
      
      if (status) {
        query = query.eq('status', status);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setEnhancements(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching enhancements:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnhancements();
  }, [user, limit, page, search, status, sortBy, sortOrder]);

  return {
    enhancements,
    loading,
    error,
    totalCount,
    refetch: fetchEnhancements,
  };
}

// Hook for fetching a single enhancement
export function useEnhancement(id: string) {
  const { user } = useAuth();
  const [enhancement, setEnhancement] = useState<Enhancement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user || !id) {
      setLoading(false);
      return;
    }

    const fetchEnhancement = async () => {
      try {
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('documents')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        setEnhancement(data);
      } catch (err) {
        console.error('Error fetching enhancement:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchEnhancement();
  }, [user, id]);

  return { enhancement, loading, error };
}