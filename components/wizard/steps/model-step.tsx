'use client';

import { useWizardStore } from '@/lib/stores/wizard-store';
import { useSubscription } from '@/hooks/use-subscription';
import { getAvailableModelsByTier, ModelConfig } from '@/lib/subscription/tier-config';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sparkles, Lock } from 'lucide-react';

export function ModelStep() {
  const { data, updateData } = useWizardStore();
  const { subscriptionTier } = useSubscription();
  
  const availableModels = getAvailableModelsByTier(subscriptionTier || 'free');
  const allModels: ModelConfig[] = [
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      description: 'Fast and efficient for basic enhancements',
      icon: '⚡',
      tier: 'free',
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      description: 'Balanced performance with advanced capabilities',
      icon: '🤖',
      tier: 'pro',
    },
    {
      id: 'claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Premium quality with nuanced understanding',
      icon: '🎭',
      tier: 'premium',
    },
    {
      id: 'ensemble',
      name: 'Ensemble Mode',
      description: 'Combines multiple models for best results',
      icon: '🎨',
      tier: 'premium',
    },
  ];

  const isModelAvailable = (modelId: string) => {
    return availableModels.some(m => m.id === modelId);
  };

  const getTierBadge = (tier: string) => {
    if (tier === 'premium') return <Badge variant="default">Premium</Badge>;
    if (tier === 'pro') return <Badge variant="secondary">Pro</Badge>;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Choose AI Model</h2>
        <p className="text-muted-foreground">
          Select the AI model for document enhancement
        </p>
      </div>

      <RadioGroup
        value={data.selectedModel || ''}
        onValueChange={(value) => updateData({ selectedModel: value })}
      >
        <div className="grid gap-3">
          {allModels.map((model) => {
            const isAvailable = isModelAvailable(model.id);
            const isSelected = data.selectedModel === model.id;
            
            return (
              <Card
                key={model.id}
                className={cn(
                  "relative cursor-pointer transition-colors",
                  isAvailable ? "hover:border-primary" : "opacity-60",
                  isSelected && "border-primary"
                )}
              >
                <label
                  htmlFor={model.id}
                  className={cn(
                    "block p-4",
                    isAvailable ? "cursor-pointer" : "cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem 
                      value={model.id} 
                      id={model.id}
                      disabled={!isAvailable}
                      className="mt-1"
                      data-testid={`model-option-${model.id}`}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">{model.icon}</span>
                          <span className="font-medium">{model.name}</span>
                        </div>
                        {!isAvailable && (
                          <div className="flex items-center space-x-2">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            {getTierBadge(model.tier)}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {model.description}
                      </p>
                    </div>
                  </div>
                </label>
              </Card>
            );
          })}
        </div>
      </RadioGroup>

      {subscriptionTier === 'free' && (
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-start space-x-2">
            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Upgrade for more models</p>
              <p className="text-sm text-muted-foreground">
                Pro and Premium tiers unlock advanced AI models with superior enhancement capabilities
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}