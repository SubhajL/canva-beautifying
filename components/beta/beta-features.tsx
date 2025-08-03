'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { 
  Sparkles,
  Lock,
  Unlock,
  Zap,
  Brain,
  Palette,
  FileStack,
  Wand2,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface BetaFeaturesProps {
  userId: string;
}

interface Feature {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'active' | 'coming-soon' | 'testing';
  isEnabled: boolean;
  href?: string;
}

export function BetaFeatures({ userId }: BetaFeaturesProps) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const supabase = createClient();
        
        // Fetch user's feature flags
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('feature_flags')
          .eq('id', userId)
          .single();

        const featureFlags = profile?.feature_flags || {};

        // Define beta features
        const betaFeatures: Feature[] = [
          {
            id: 'ai_ensemble',
            name: 'AI Ensemble Mode',
            description: 'Use multiple AI models simultaneously for enhanced results',
            icon: Brain,
            status: 'active',
            isEnabled: featureFlags.ai_ensemble !== false,
            href: '/enhance?mode=ensemble',
          },
          {
            id: 'batch_processing',
            name: 'Batch Processing',
            description: 'Enhance multiple documents at once with smart queuing',
            icon: FileStack,
            status: 'active',
            isEnabled: featureFlags.batch_processing !== false,
            href: '/batch',
          },
          {
            id: 'custom_styles',
            name: 'Custom Style Templates',
            description: 'Create and save your own enhancement style templates',
            icon: Palette,
            status: 'testing',
            isEnabled: featureFlags.custom_styles === true,
            href: '/styles',
          },
          {
            id: 'magic_enhance',
            name: 'Magic Enhance',
            description: 'One-click enhancement with AI-powered style detection',
            icon: Wand2,
            status: 'active',
            isEnabled: featureFlags.magic_enhance !== false,
          },
          {
            id: 'priority_queue',
            name: 'Priority Processing',
            description: 'Skip the queue with priority enhancement processing',
            icon: Zap,
            status: 'active',
            isEnabled: true,
          },
          {
            id: 'unlimited_enhancements',
            name: 'Unlimited Enhancements',
            description: 'No limits on document enhancements during beta',
            icon: Sparkles,
            status: 'active',
            isEnabled: true,
          },
        ];

        setFeatures(betaFeatures);
      } catch (error) {
        console.error('Error fetching features:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Beta Features</CardTitle>
          <CardDescription>Exclusive access to experimental features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: Feature['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="text-xs">Active</Badge>;
      case 'testing':
        return <Badge variant="secondary" className="text-xs">Testing</Badge>;
      case 'coming-soon':
        return <Badge variant="outline" className="text-xs">Coming Soon</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Beta Features</CardTitle>
        <CardDescription>Exclusive access to experimental features</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {features.map((feature) => (
          <div
            key={feature.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border transition-colors',
              feature.isEnabled ? 'hover:bg-accent' : 'opacity-60'
            )}
          >
            <div className={cn(
              'p-2 rounded-lg',
              feature.isEnabled ? 'bg-primary/10' : 'bg-muted'
            )}>
              <feature.icon className={cn(
                'h-5 w-5',
                feature.isEnabled ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm">{feature.name}</h4>
                {getStatusBadge(feature.status)}
                {feature.isEnabled ? (
                  <Unlock className="h-3 w-3 text-green-600" />
                ) : (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
            </div>

            {feature.isEnabled && feature.href && feature.status === 'active' && (
              <Link href={feature.href}>
                <Button size="sm" variant="ghost">
                  Try it
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        ))}

        {/* Beta Benefits Notice */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mt-4">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Beta Perks Active</p>
              <p className="text-xs text-muted-foreground">
                All beta features are automatically enabled for your account
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}