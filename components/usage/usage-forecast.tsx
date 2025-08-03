'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { createUsageAnalytics } from '@/lib/usage/analytics';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ForecastData {
  projectedMonthlyUsage: number;
  projectedEndDate: Date | null;
  recommendedTier: string;
  confidence: number;
  basedOnDays: number;
}

interface AnomalyData {
  hasAnomaly: boolean;
  type?: 'spike' | 'unusual_time' | 'rapid_depletion';
  description?: string;
}

export function UsageForecast() {
  const { user } = useAuth();
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [anomaly, setAnomaly] = useState<AnomalyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user]);

  const loadAnalytics = async () => {
    if (!user) return;

    try {
      const analytics = await createUsageAnalytics();
      
      // Load forecast
      const forecastData = await analytics.forecastUsage(user.id);
      setForecast(forecastData);

      // Check for anomalies
      const anomalyData = await analytics.detectAnomalies(user.id);
      setAnomaly(anomalyData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !forecast) {
    return null;
  }

  const confidenceLevel = forecast.confidence >= 0.8 ? 'High' : 
                         forecast.confidence >= 0.5 ? 'Medium' : 'Low';

  const confidenceColor = forecast.confidence >= 0.8 ? 'green' : 
                         forecast.confidence >= 0.5 ? 'yellow' : 'red';

  return (
    <div className="space-y-4">
      {/* Anomaly Alert */}
      {anomaly?.hasAnomaly && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Unusual Activity Detected:</strong> {anomaly.description}
          </AlertDescription>
        </Alert>
      )}

      {/* Forecast Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <CardTitle>Usage Forecast</CardTitle>
            </div>
            <Badge variant="outline" className={`text-${confidenceColor}-600`}>
              {confidenceLevel} Confidence
            </Badge>
          </div>
          <CardDescription>
            Based on your last {forecast.basedOnDays} days of activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Projected Monthly Usage</p>
              <p className="text-2xl font-bold">{forecast.projectedMonthlyUsage}</p>
              <p className="text-xs text-muted-foreground">credits</p>
            </div>

            {forecast.projectedEndDate && (
              <div>
                <p className="text-sm text-muted-foreground">Credits Will Run Out</p>
                <p className="text-2xl font-bold">
                  {new Date(forecast.projectedEndDate).toLocaleDateString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  in {Math.ceil((forecast.projectedEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))} days
                </p>
              </div>
            )}
          </div>

          {forecast.recommendedTier !== 'free' && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-medium">Recommendation</p>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Based on your usage pattern, the <strong>{forecast.recommendedTier}</strong> plan 
                would better suit your needs.
              </p>
              <Link href="/app/settings/billing">
                <Button size="sm" variant="outline">
                  View {forecast.recommendedTier} Plan
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}