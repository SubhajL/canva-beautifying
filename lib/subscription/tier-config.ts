export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'free' | 'pro' | 'premium';
}

export const AI_MODELS: ModelConfig[] = [
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

export const TIER_LIMITS = {
  free: {
    monthlyCredits: 5,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    batchLimit: 1,
  },
  pro: {
    monthlyCredits: 50,
    maxFileSize: 25 * 1024 * 1024, // 25MB
    batchLimit: 5,
  },
  premium: {
    monthlyCredits: -1, // unlimited
    maxFileSize: 100 * 1024 * 1024, // 100MB
    batchLimit: 20,
  },
};

export function getAvailableModelsByTier(tier: string): ModelConfig[] {
  const tierLevel = tier === 'premium' ? 3 : tier === 'pro' ? 2 : 1;
  
  return AI_MODELS.filter(model => {
    const modelTierLevel = model.tier === 'premium' ? 3 : model.tier === 'pro' ? 2 : 1;
    return modelTierLevel <= tierLevel;
  });
}

export function isModelAvailableForTier(modelId: string, tier: string): boolean {
  const availableModels = getAvailableModelsByTier(tier);
  return availableModels.some(model => model.id === modelId);
}

export function getDefaultModelForTier(tier: string): string {
  const availableModels = getAvailableModelsByTier(tier);
  return availableModels[0]?.id || 'gemini-2.0-flash';
}