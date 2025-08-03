'use client';

import { useEffect, useState } from 'react';
import { useWizardStore } from '@/lib/stores/wizard-store';
import { useAuth } from '@/contexts/auth';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  FileSearch, 
  Wand2, 
  Palette, 
  Package,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { io, Socket } from 'socket.io-client';

const processingStages = [
  { id: 'uploading', label: 'Uploading Document', icon: Package },
  { id: 'analyzing', label: 'Analyzing Content', icon: FileSearch },
  { id: 'enhancing', label: 'Applying Enhancements', icon: Wand2 },
  { id: 'styling', label: 'Styling & Formatting', icon: Palette },
  { id: 'finalizing', label: 'Finalizing', icon: CheckCircle2 },
];

export function ProcessingStep() {
  const { data, setStep, updateData } = useWizardStore();
  const { user: _user, session } = useAuth();
  const [currentStage, setCurrentStage] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [_socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!data.enhancementId || !session?.access_token) return;

    // Connect to WebSocket for real-time updates
    const socketInstance = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001', {
      auth: {
        token: session.access_token,
      },
    });

    setSocket(socketInstance);

    // Join the enhancement room
    socketInstance.emit('join-enhancement', data.enhancementId);

    // Listen for progress updates
    socketInstance.on('enhancement-progress', (progress) => {
      if (progress.enhancementId === data.enhancementId) {
        handleProgressUpdate(progress);
      }
    });

    // Listen for completion
    socketInstance.on('enhancement-complete', (result) => {
      if (result.enhancementId === data.enhancementId) {
        handleEnhancementComplete(result);
      }
    });

    // Listen for errors
    socketInstance.on('enhancement-error', (error) => {
      if (error.enhancementId === data.enhancementId) {
        handleEnhancementError(error);
      }
    });

    return () => {
      socketInstance.emit('leave-enhancement', data.enhancementId);
      socketInstance.disconnect();
    };
  }, [data.enhancementId, session]);

  const handleProgressUpdate = (progress: {
    stage?: string;
    stageProgress?: number;
    overallProgress?: number;
    estimatedTimeRemaining?: number | null;
  }) => {
    // Update stage based on progress
    const stage = progress.stage || 'analyzing';
    const stageIndex = processingStages.findIndex(s => s.id === stage);
    if (stageIndex !== -1) {
      setCurrentStage(stageIndex);
    }

    // Update progress values
    setStageProgress(progress.stageProgress || 0);
    setOverallProgress(progress.overallProgress || 0);
    setEstimatedTime(progress.estimatedTimeRemaining || null);
  };

  const handleEnhancementComplete = (result: {
    enhancedUrl: string;
    thumbnailUrl: string;
    improvements: any;
    processingTime?: number;
  }) => {
    // Update wizard data with results
    updateData({
      enhancedUrl: result.enhancedUrl,
      thumbnailUrl: result.thumbnailUrl,
      improvements: result.improvements,
      processingTime: result.processingTime,
    });

    // Move to results step
    setTimeout(() => {
      setStep('results');
    }, 1000);
  };

  const handleEnhancementError = (error: {
    message?: string;
    code?: string;
  }) => {
    console.error('Enhancement error:', error);
    // Handle error - could show error state or retry option
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Processing Your Document</h2>
        <p className="text-muted-foreground">
          Our AI is working on enhancing your document
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
            {estimatedTime && (
              <p className="text-xs text-muted-foreground text-center">
                Estimated time remaining: {formatTime(estimatedTime)}
              </p>
            )}
          </div>

          {/* Processing Stages */}
          <div className="space-y-4">
            {processingStages.map((stage, index) => {
              const Icon = stage.icon;
              const isActive = index === currentStage;
              const isComplete = index < currentStage;
              const isPending = index > currentStage;

              return (
                <div
                  key={stage.id}
                  className={cn(
                    "flex items-center space-x-3 p-3 rounded-lg transition-colors",
                    isActive && "bg-primary/5",
                    isComplete && "opacity-60"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                    isActive && "bg-primary text-primary-foreground",
                    isComplete && "bg-green-500 text-white",
                    isPending && "bg-muted"
                  )}>
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isActive ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "font-medium",
                        isPending && "text-muted-foreground"
                      )}>
                        {stage.label}
                      </span>
                      {isActive && (
                        <Badge variant="secondary" className="ml-2">
                          <Clock className="h-3 w-3 mr-1" />
                          In Progress
                        </Badge>
                      )}
                      {isComplete && (
                        <Badge variant="outline" className="ml-2 text-green-600">
                          Complete
                        </Badge>
                      )}
                    </div>
                    {isActive && stageProgress > 0 && (
                      <Progress value={stageProgress} className="h-1 mt-2" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Processing Animation */}
          <div className="flex justify-center py-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Wand2 className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="text-center text-sm text-muted-foreground">
            <p>This usually takes 2-5 minutes depending on document complexity.</p>
            <p className="mt-1">Feel free to leave this page - we&apos;ll email you when it&apos;s ready!</p>
          </div>
        </div>
      </Card>
    </div>
  );
}