export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          subscription_tier: 'free' | 'basic' | 'pro' | 'premium'
          subscription_status: 'active' | 'cancelled' | 'past_due' | 'trialing'
          usage_count: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          subscription_tier?: 'free' | 'basic' | 'pro' | 'premium'
          subscription_status?: 'active' | 'cancelled' | 'past_due' | 'trialing'
          usage_count?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          subscription_tier?: 'free' | 'basic' | 'pro' | 'premium'
          subscription_status?: 'active' | 'cancelled' | 'past_due' | 'trialing'
          usage_count?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      enhancements: {
        Row: {
          id: string
          user_id: string
          original_url: string
          original_key: string
          enhanced_url: string | null
          enhanced_key: string | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          analysis_data: Json | null
          enhancement_data: Json | null
          model_used: string | null
          processing_time: number | null
          error_message: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          original_url: string
          original_key: string
          enhanced_url?: string | null
          enhanced_key?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          analysis_data?: Json | null
          enhancement_data?: Json | null
          model_used?: string | null
          processing_time?: number | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          original_url?: string
          original_key?: string
          enhanced_url?: string | null
          enhanced_key?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          analysis_data?: Json | null
          enhancement_data?: Json | null
          model_used?: string | null
          processing_time?: number | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      enhancement_assets: {
        Row: {
          id: string
          enhancement_id: string
          asset_type: string
          asset_url: string
          asset_key: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          enhancement_id: string
          asset_type: string
          asset_url: string
          asset_key: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          enhancement_id?: string
          asset_type?: string
          asset_url?: string
          asset_key?: string
          metadata?: Json | null
          created_at?: string
        }
      }
      usage_tracking: {
        Row: {
          id: string
          user_id: string
          enhancement_id: string | null
          action: string
          credits_used: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          enhancement_id?: string | null
          action: string
          credits_used?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          enhancement_id?: string | null
          action?: string
          credits_used?: number
          created_at?: string
        }
      }
      subscription_limits: {
        Row: {
          tier: 'free' | 'basic' | 'pro' | 'premium'
          monthly_credits: number
          max_file_size_mb: number
          batch_size: number
          features: Json
        }
        Insert: {
          tier: 'free' | 'basic' | 'pro' | 'premium'
          monthly_credits: number
          max_file_size_mb: number
          batch_size: number
          features: Json
        }
        Update: {
          tier?: 'free' | 'basic' | 'pro' | 'premium'
          monthly_credits?: number
          max_file_size_mb?: number
          batch_size?: number
          features?: Json
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_usage_limit: {
        Args: {
          p_user_id: string
        }
        Returns: boolean
      }
      increment_usage: {
        Args: {
          p_user_id: string
          p_enhancement_id?: string
          p_action?: string
          p_credits?: number
        }
        Returns: void
      }
    }
    Enums: {
      subscription_tier: 'free' | 'basic' | 'pro' | 'premium'
      subscription_status: 'active' | 'cancelled' | 'past_due' | 'trialing'
      enhancement_status: 'pending' | 'processing' | 'completed' | 'failed'
    }
  }
}