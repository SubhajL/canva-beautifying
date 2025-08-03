'use client';

import { useWizardStore } from '@/lib/stores/wizard-store';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  Sparkles, 
  Zap, 
  Paintbrush, 
  Grid3x3,
  BarChart3,
  Image
} from 'lucide-react';

const enhancementStyles = [
  {
    value: 'modern',
    label: 'Modern & Clean',
    description: 'Minimalist design with plenty of whitespace',
    icon: Sparkles,
  },
  {
    value: 'vibrant',
    label: 'Vibrant & Engaging',
    description: 'Bold colors and dynamic layouts',
    icon: Zap,
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Formal and business-appropriate styling',
    icon: Grid3x3,
  },
  {
    value: 'playful',
    label: 'Playful & Fun',
    description: 'Kid-friendly with illustrations and colors',
    icon: Paintbrush,
  },
];

const colorSchemes = [
  { value: 'blue', label: 'Blue', colors: ['#3B82F6', '#60A5FA', '#93BBFC'] },
  { value: 'green', label: 'Green', colors: ['#10B981', '#34D399', '#6EE7B7'] },
  { value: 'purple', label: 'Purple', colors: ['#8B5CF6', '#A78BFA', '#C4B5FD'] },
  { value: 'orange', label: 'Orange', colors: ['#F97316', '#FB923C', '#FDBA74'] },
  { value: 'pink', label: 'Pink', colors: ['#EC4899', '#F472B6', '#F9A8D4'] },
  { value: 'neutral', label: 'Neutral', colors: ['#6B7280', '#9CA3AF', '#D1D5DB'] },
];

export function StyleStep() {
  const { data, updateData } = useWizardStore();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Choose Your Style</h2>
        <p className="text-muted-foreground">
          Select the visual style and customization options
        </p>
      </div>

      <div className="space-y-6">
        {/* Enhancement Style */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Enhancement Style</Label>
          <RadioGroup
            value={data.enhancementStyle || ''}
            onValueChange={(value) => updateData({ enhancementStyle: value })}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {enhancementStyles.map((style) => {
                const Icon = style.icon;
                const isSelected = data.enhancementStyle === style.value;
                
                return (
                  <Card
                    key={style.value}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected && "border-primary"
                    )}
                  >
                    <label
                      htmlFor={style.value}
                      className="block p-4 cursor-pointer"
                    >
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem 
                          value={style.value} 
                          id={style.value}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center space-x-2">
                            <Icon className="h-4 w-4 text-primary" />
                            <span className="font-medium">{style.label}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {style.description}
                          </p>
                        </div>
                      </div>
                    </label>
                  </Card>
                );
              })}
            </div>
          </RadioGroup>
        </div>

        {/* Color Scheme */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Color Scheme</Label>
          <RadioGroup
            value={data.colorScheme || ''}
            onValueChange={(value) => updateData({ colorScheme: value })}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {colorSchemes.map((scheme) => {
                const isSelected = data.colorScheme === scheme.value;
                
                return (
                  <Card
                    key={scheme.value}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected && "border-primary"
                    )}
                  >
                    <label
                      htmlFor={`color-${scheme.value}`}
                      className="block p-3 cursor-pointer"
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <RadioGroupItem 
                          value={scheme.value} 
                          id={`color-${scheme.value}`}
                          className="sr-only"
                        />
                        <div className="flex space-x-1">
                          {scheme.colors.map((color, i) => (
                            <div
                              key={i}
                              className="h-6 w-6 rounded"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium">{scheme.label}</span>
                      </div>
                    </label>
                  </Card>
                );
              })}
            </div>
          </RadioGroup>
        </div>

        {/* Visual Complexity */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Visual Complexity</Label>
          <RadioGroup
            value={data.visualComplexity || 'moderate'}
            onValueChange={(value: any) => updateData({ visualComplexity: value })}
          >
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="simple" id="simple" />
                <Label htmlFor="simple" className="font-normal cursor-pointer">
                  Simple - Minimal graphics and clean layouts
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="moderate" id="moderate" />
                <Label htmlFor="moderate" className="font-normal cursor-pointer">
                  Moderate - Balanced mix of text and visuals
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="detailed" id="detailed" />
                <Label htmlFor="detailed" className="font-normal cursor-pointer">
                  Detailed - Rich visuals and comprehensive layouts
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Additional Options */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Additional Options</Label>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="graphics" className="font-medium cursor-pointer">
                      Include Graphics & Icons
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Add relevant illustrations and icons
                    </p>
                  </div>
                </div>
                <Switch
                  id="graphics"
                  checked={data.includeGraphics}
                  onCheckedChange={(checked) => 
                    updateData({ includeGraphics: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="charts" className="font-medium cursor-pointer">
                      Generate Charts & Graphs
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Create visualizations for data
                    </p>
                  </div>
                </div>
                <Switch
                  id="charts"
                  checked={data.includeCharts}
                  onCheckedChange={(checked) => 
                    updateData({ includeCharts: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}