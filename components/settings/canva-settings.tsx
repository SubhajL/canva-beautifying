'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  LinkIcon, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Zap,
  ExternalLink,
  Info
} from 'lucide-react';
import { useCanvaAuth } from '@/hooks/use-canva-auth';
import { isCanvaAPIConfigured } from '@/lib/canva/api-config';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function CanvaSettings() {
  const { isConnected, isLoading, connect, disconnect } = useCanvaAuth();
  const apiConfigured = isCanvaAPIConfigured();
  const [autoImport, setAutoImport] = useState(true);
  const { toast } = useToast();

  const handleAutoImportChange = (checked: boolean) => {
    setAutoImport(checked);
    toast({
      title: checked ? 'Auto Import Enabled' : 'Auto Import Disabled',
      description: checked 
        ? 'Canva API will be used automatically when available'
        : 'You will need to select API mode manually',
    });
  };

  if (!apiConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Canva Integration</CardTitle>
          <CardDescription>
            Connect your Canva account for seamless design imports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Canva API integration is not configured for this instance. 
              Contact your administrator to enable this feature.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Canva Integration</CardTitle>
            <CardDescription>
              Connect your Canva account for seamless design imports
            </CardDescription>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? 'Connected' : 'Not Connected'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="space-y-4">
          {isConnected ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Canva account connected</p>
                  <p className="text-sm text-muted-foreground">
                    You can import designs directly from Canva
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                disabled={isLoading}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">No Canva account connected</p>
                  <p className="text-sm text-muted-foreground">
                    Connect your account to enable API imports
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={connect}
                disabled={isLoading}
              >
                <LinkIcon className="mr-2 h-4 w-4" />
                Connect
              </Button>
            </div>
          )}
        </div>

        {/* Settings */}
        {isConnected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-import">Automatic API Import</Label>
                <p className="text-sm text-muted-foreground">
                  Use Canva API automatically when importing designs
                </p>
              </div>
              <Switch
                id="auto-import"
                checked={autoImport}
                onCheckedChange={handleAutoImportChange}
              />
            </div>
          </div>
        )}

        {/* Features */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">API Features</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span>Direct design export without manual download</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span>High-quality exports with print resolution</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span>Automatic format selection (PNG/PDF)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span>Batch import support (coming soon)</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your Canva connection is secure and can be revoked at any time. 
            We only access designs you explicitly choose to import.
          </AlertDescription>
        </Alert>

        {/* Help Link */}
        <div className="pt-4 border-t">
          <a
            href="https://www.canva.com/developers/docs/connect-api/getting-started/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            Learn more about Canva Connect
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}