'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  LinkIcon, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Info,
  Zap,
  FileDown,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validateCanvaUrl, parseCanvaUrl } from '@/lib/canva/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCanvaHistory } from '@/hooks/use-canva-history';
import { ImportProgress, useImportProgress } from './import-progress';
import { CanvaHistory } from './canva-history';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCanvaAuth } from '@/hooks/use-canva-auth';
import { isCanvaAPIConfigured } from '@/lib/canva/api-config';

interface CanvaImportProps {
  onImport: (file: File) => Promise<void>;
  disabled?: boolean;
}

export function CanvaImport({ onImport, disabled }: CanvaImportProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [importMode, setImportMode] = useState<'auto' | 'api' | 'manual'>('auto');
  const { toast } = useToast();
  const { addToHistory, hasImportedDesign } = useCanvaHistory();
  const { steps, currentStep, updateStep, nextStep, setError, reset } = useImportProgress();
  const { isConnected, isLoading: isAuthLoading, connect, disconnect } = useCanvaAuth();
  const apiEnabled = isCanvaAPIConfigured();

  const handleUrlChange = (value: string) => {
    setUrl(value);
    
    // Clear validation error when user types
    if (validationError) {
      setValidationError(null);
    }

    // Validate URL as user types
    if (value && !validateCanvaUrl(value)) {
      setValidationError('Please enter a valid Canva URL');
    }
  };

  const handleImport = async (mode: 'api' | 'manual' | 'auto' = importMode) => {
    if (!url) {
      setValidationError('Please enter a Canva URL');
      return;
    }

    if (!validateCanvaUrl(url)) {
      setValidationError('Invalid Canva URL format');
      return;
    }

    // If API mode is selected but not connected, prompt connection
    if (mode === 'api' && apiEnabled && !isConnected) {
      toast({
        title: 'Connect Canva Account',
        description: 'Please connect your Canva account to use API import',
        action: (
          <Button size="sm" onClick={connect}>
            Connect
          </Button>
        ),
      });
      return;
    }

    setLoading(true);
    setValidationError(null);
    setShowProgress(true);
    reset();

    try {
      // Step 1: Validate URL
      updateStep('validate', { status: 'active' });
      
      const canvaInfo = parseCanvaUrl(url);
      if (!canvaInfo) {
        throw new Error('Could not parse Canva URL');
      }

      // Check if already imported
      if (hasImportedDesign(canvaInfo.designId)) {
        toast({
          title: 'Already Imported',
          description: 'This design has already been imported recently',
        });
      }

      updateStep('validate', { status: 'completed' });
      nextStep();

      // Step 2: Call API to process the Canva URL
      updateStep('download', { status: 'active', progress: 0 });
      
      const response = await fetch('/api/canva/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode, ...canvaInfo }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import from Canva');
      }

      const data = await response.json();
      
      // Check if authentication is required
      if (data.requiresAuth) {
        updateStep('download', { 
          status: 'error', 
          error: 'Authentication required' 
        });
        
        toast({
          title: 'Authentication Required',
          description: 'Please connect your Canva account to use API import',
          action: (
            <Button
              size="sm"
              onClick={() => window.open(data.authUrl, '_blank')}
            >
              Connect Canva
            </Button>
          ),
        });

        setShowProgress(false);
        return;
      }
      
      // Check if manual upload is required
      if (data.alternativeAction === 'manual_upload_required' || data.method === 'manual') {
        updateStep('download', { 
          status: 'error', 
          error: 'Manual download required from Canva' 
        });
        
        // Add to history as manual required
        addToHistory({
          url,
          designId: canvaInfo.designId,
          status: 'manual_required',
        });

        // Show instructions dialog
        toast({
          title: 'Manual Download Required',
          description: 'Please download the file from Canva and upload it manually',
          action: (
            <Button
              size="sm"
              onClick={() => window.open(url, '_blank')}
            >
              Open in Canva
            </Button>
          ),
        });

        setShowProgress(false);
        return;
      }

      updateStep('download', { status: 'completed' });
      nextStep();

      // Step 3: Upload to system (simulated for now)
      updateStep('upload', { status: 'active', progress: 0 });
      
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 20) {
        updateStep('upload', { progress: i });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      updateStep('upload', { status: 'completed' });
      nextStep();

      // Step 4: Process document
      updateStep('process', { status: 'active' });
      
      // In a real implementation, this would convert the imported data
      // For now, create a dummy file
      const blob = new Blob(['Canva import placeholder'], { type: 'image/png' });
      const fileName = `canva-${canvaInfo.designId}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      await onImport(file);
      
      updateStep('process', { status: 'completed' });

      // Add to history
      addToHistory({
        url,
        designId: canvaInfo.designId,
        status: 'success',
        fileName,
      });

      toast({
        title: 'Success!',
        description: 'Document imported from Canva successfully',
      });

      // Clear and reset
      setUrl('');
      setTimeout(() => {
        setShowProgress(false);
        reset();
      }, 2000);
    } catch (error) {
      console.error('Canva import error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to import from Canva';
      
      // Set error on current step
      if (currentStep < steps.length) {
        setError(steps[currentStep].id, errorMessage);
      }

      // Add to history as failed
      const canvaInfo = parseCanvaUrl(url);
      if (canvaInfo) {
        addToHistory({
          url,
          designId: canvaInfo.designId,
          status: 'failed',
        });
      }

      toast({
        title: 'Import Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              <CardTitle>Import from Canva</CardTitle>
            </div>
            <CanvaInstructions />
          </div>
          <CardDescription>
            Import your Canva designs using our API or manual workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="https://www.canva.com/design/..."
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                disabled={loading || disabled}
                className={validationError ? 'border-red-500' : ''}
              />
            </div>
            {validationError && (
              <p className="text-sm text-red-500">{validationError}</p>
            )}
          </div>

          {/* Import Methods */}
          <Tabs value={importMode} onValueChange={(v) => setImportMode(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="auto" className="relative">
                <Sparkles className="mr-2 h-4 w-4" />
                Auto
              </TabsTrigger>
              <TabsTrigger value="api" className="relative">
                <Zap className="mr-2 h-4 w-4" />
                API
                {apiEnabled && (
                  <Badge 
                    variant={isConnected ? "default" : "secondary"} 
                    className="ml-2 h-5 px-1 text-[10px]"
                  >
                    {isConnected ? 'Connected' : 'Not Connected'}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="manual">
                <FileDown className="mr-2 h-4 w-4" />
                Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="mt-4 space-y-4">
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  Automatically choose the best method. Will use API if connected, otherwise manual.
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => handleImport('auto')}
                disabled={loading || disabled || !url || !!validationError}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Automatically
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="api" className="mt-4 space-y-4">
              {apiEnabled ? (
                <>
                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertDescription>
                      Direct API integration for seamless imports. Requires Canva account connection.
                    </AlertDescription>
                  </Alert>
                  {isConnected ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">Canva account connected</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={disconnect}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Disconnect
                        </Button>
                      </div>
                      <Button
                        onClick={() => handleImport('api')}
                        disabled={loading || disabled || !url || !!validationError}
                        className="w-full"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importing via API...
                          </>
                        ) : (
                          <>
                            <Zap className="mr-2 h-4 w-4" />
                            Import via API
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          Connect your Canva account to enable API imports
                        </p>
                        <Button
                          onClick={connect}
                          disabled={isAuthLoading}
                          variant="outline"
                          className="w-full"
                        >
                          <LinkIcon className="mr-2 h-4 w-4" />
                          Connect Canva Account
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    API integration is not configured. Please use manual import or contact support.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="manual" className="mt-4 space-y-4">
              <Alert>
                <FileDown className="h-4 w-4" />
                <AlertDescription>
                  Download from Canva manually and upload the file. Works with all designs.
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => handleImport('manual')}
                disabled={loading || disabled || !url || !!validationError}
                className="w-full"
                variant="outline"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Instructions...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Get Manual Instructions
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Make sure your Canva design is set to &quot;Anyone with the link can view&quot; 
              for successful import.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      {showProgress && (
        <ImportProgress 
          steps={steps} 
          currentStep={currentStep}
          onCancel={() => {
            setShowProgress(false);
            setLoading(false);
            reset();
          }}
        />
      )}

      {/* Import History */}
      <CanvaHistory 
        onSelectUrl={(selectedUrl) => {
          setUrl(selectedUrl);
          handleUrlChange(selectedUrl);
        }}
      />
    </div>
  );
}

function CanvaInstructions() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Info className="h-4 w-4 mr-1" />
          How to export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>How to Export from Canva</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                1
              </span>
              Open your design in Canva
            </h3>
            <p className="text-sm text-muted-foreground ml-8">
              Navigate to your design in Canva that you want to enhance.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                2
              </span>
              Click Share button
            </h3>
            <p className="text-sm text-muted-foreground ml-8">
              Click the &quot;Share&quot; button in the top right corner of your design.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                3
              </span>
              Set to &quot;Anyone with the link can view&quot;
            </h3>
            <p className="text-sm text-muted-foreground ml-8">
              In the share dialog, make sure the visibility is set to 
              &quot;Anyone with the link can view&quot;.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                4
              </span>
              Copy the link
            </h3>
            <p className="text-sm text-muted-foreground ml-8">
              Click &quot;Copy link&quot; and paste it in the import field above.
            </p>
          </div>

          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> We&apos;ll download the highest quality version 
              available from your Canva design. For best results, ensure your design 
              is complete and saved before importing.
            </AlertDescription>
          </Alert>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Need help? Check out{' '}
              <a 
                href="https://www.canva.com/help/share-designs/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Canva&apos;s sharing guide
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}