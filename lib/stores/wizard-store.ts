import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type WizardStep = 
  | 'upload' 
  | 'model'
  | 'audience' 
  | 'style' 
  | 'review' 
  | 'processing' 
  | 'results';

export interface UploadedFile {
  id: string;
  file: File;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  documentId?: string;
  progress?: number;
}

export interface WizardData {
  // Upload step
  files: UploadedFile[];
  
  // Model step
  selectedModel: string | null;
  
  // Audience step
  targetAudience: string | null;
  gradeLevel: string | null;
  subject: string | null;
  purpose: string | null;
  
  // Style step
  enhancementStyle: string | null;
  colorScheme: string | null;
  visualComplexity: 'simple' | 'moderate' | 'detailed' | null;
  includeGraphics: boolean;
  includeCharts: boolean;
  
  // Processing
  batchId: string | null;
  enhancementResults: Array<{
    documentId: string;
    enhancementId: string;
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    enhancedUrl?: string;
    thumbnailUrl?: string;
    improvements?: string[];
    processingTime?: number;
    error?: string;
  }>;
}

interface WizardState {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  data: WizardData;
  errors: Partial<Record<WizardStep, string>>;
  isProcessing: boolean;
  
  // Actions
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  updateData: (data: Partial<WizardData>) => void;
  setError: (step: WizardStep, error: string | null) => void;
  clearError: (step: WizardStep) => void;
  setProcessing: (processing: boolean) => void;
  reset: () => void;
  canNavigateToStep: (step: WizardStep) => boolean;
  isStepCompleted: (step: WizardStep) => boolean;
  validateCurrentStep: () => boolean;
  
  // File management actions
  addFiles: (files: UploadedFile[]) => void;
  removeFile: (fileId: string) => void;
  updateFileStatus: (fileId: string, status: UploadedFile['status'], updates?: Partial<UploadedFile>) => void;
  clearFiles: () => void;
}

const stepOrder: WizardStep[] = [
  'upload',
  'model',
  'audience',
  'style',
  'review',
  'processing',
  'results',
];

const initialData: WizardData = {
  files: [],
  selectedModel: null,
  targetAudience: null,
  gradeLevel: null,
  subject: null,
  purpose: null,
  enhancementStyle: null,
  colorScheme: null,
  visualComplexity: null,
  includeGraphics: true,
  includeCharts: true,
  batchId: null,
  enhancementResults: [],
};

export const useWizardStore = create<WizardState>()(
  devtools(
    persist(
      (set, get) => ({
        currentStep: 'upload',
        completedSteps: [],
        data: initialData,
        errors: {},
        isProcessing: false,

        setStep: (step) => {
          const state = get();
          if (state.canNavigateToStep(step)) {
            set({ currentStep: step });
          }
        },

        nextStep: () => {
          const state = get();
          const currentIndex = stepOrder.indexOf(state.currentStep);
          
          if (currentIndex < stepOrder.length - 1) {
            const nextStep = stepOrder[currentIndex + 1];
            
            // Mark current step as completed if valid
            if (state.validateCurrentStep()) {
              set((prev) => ({
                completedSteps: Array.from(new Set([...prev.completedSteps, prev.currentStep])),
                currentStep: nextStep,
              }));
            }
          }
        },

        previousStep: () => {
          const state = get();
          const currentIndex = stepOrder.indexOf(state.currentStep);
          
          if (currentIndex > 0) {
            set({ currentStep: stepOrder[currentIndex - 1] });
          }
        },

        updateData: (newData) => {
          set((state) => ({
            data: { ...state.data, ...newData },
          }));
        },

        setError: (step, error) => {
          set((state) => ({
            errors: { ...state.errors, [step]: error || undefined },
          }));
        },

        clearError: (step) => {
          set((state) => {
            const newErrors = { ...state.errors };
            delete newErrors[step];
            return { errors: newErrors };
          });
        },

        setProcessing: (processing) => {
          set({ isProcessing: processing });
        },

        reset: () => {
          set({
            currentStep: 'upload',
            completedSteps: [],
            data: initialData,
            errors: {},
            isProcessing: false,
          });
        },

        canNavigateToStep: (step) => {
          const state = get();
          const targetIndex = stepOrder.indexOf(step);
          const currentIndex = stepOrder.indexOf(state.currentStep);
          
          // Can always go back
          if (targetIndex <= currentIndex) return true;
          
          // Can only go forward if all previous steps are completed
          for (let i = 0; i < targetIndex; i++) {
            if (!state.completedSteps.includes(stepOrder[i])) {
              return false;
            }
          }
          
          return true;
        },

        isStepCompleted: (step) => {
          return get().completedSteps.includes(step);
        },

        validateCurrentStep: () => {
          const state = get();
          const { currentStep, data } = state;
          
          state.clearError(currentStep);
          
          switch (currentStep) {
            case 'upload':
              if (data.files.length === 0) {
                state.setError('upload', 'Please select at least one file to upload');
                return false;
              }
              // Check if all files have been uploaded successfully
              const allUploaded = data.files.every(f => f.status === 'uploaded');
              if (!allUploaded) {
                state.setError('upload', 'Please wait for all files to finish uploading');
                return false;
              }
              return true;
              
            case 'model':
              if (!data.selectedModel) {
                state.setError('model', 'Please select an AI model');
                return false;
              }
              return true;
              
            case 'audience':
              if (!data.targetAudience || !data.gradeLevel) {
                state.setError('audience', 'Please select target audience and grade level');
                return false;
              }
              return true;
              
            case 'style':
              if (!data.enhancementStyle || !data.colorScheme) {
                state.setError('style', 'Please select enhancement style and color scheme');
                return false;
              }
              return true;
              
            case 'review':
              // Review step is always valid
              return true;
              
            default:
              return true;
          }
        },
        
        // File management actions
        addFiles: (newFiles) => {
          set((state) => ({
            data: {
              ...state.data,
              files: [...state.data.files, ...newFiles],
            },
          }));
        },
        
        removeFile: (fileId) => {
          set((state) => ({
            data: {
              ...state.data,
              files: state.data.files.filter(f => f.id !== fileId),
            },
          }));
          
          // Revoke object URL to free memory
          const file = get().data.files.find(f => f.id === fileId);
          if (file?.fileUrl) {
            URL.revokeObjectURL(file.fileUrl);
          }
        },
        
        updateFileStatus: (fileId, status, updates = {}) => {
          set((state) => ({
            data: {
              ...state.data,
              files: state.data.files.map(f => 
                f.id === fileId 
                  ? { ...f, status, ...updates }
                  : f
              ),
            },
          }));
        },
        
        clearFiles: () => {
          // Revoke all object URLs
          get().data.files.forEach(file => {
            if (file.fileUrl) {
              URL.revokeObjectURL(file.fileUrl);
            }
          });
          
          set((state) => ({
            data: {
              ...state.data,
              files: [],
            },
          }));
        },
      }),
      {
        name: 'enhancement-wizard',
        partialize: (state) => ({
          // Only persist non-file data
          data: {
            ...state.data,
            files: [], // Don't persist file objects
          },
          currentStep: state.currentStep,
          completedSteps: state.completedSteps,
        }),
      }
    )
  )
);