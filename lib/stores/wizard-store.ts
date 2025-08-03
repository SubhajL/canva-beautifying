import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type WizardStep = 
  | 'upload' 
  | 'audience' 
  | 'style' 
  | 'review' 
  | 'processing' 
  | 'results';

export interface WizardData {
  // Upload step
  file: File | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  
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
  enhancementId: string | null;
  documentId: string | null;
  jobId: string | null;
  
  // Results
  enhancedUrl: string | null;
  thumbnailUrl: string | null;
  improvements: string[] | null;
  processingTime: number | null;
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
}

const stepOrder: WizardStep[] = [
  'upload',
  'audience',
  'style',
  'review',
  'processing',
  'results',
];

const initialData: WizardData = {
  file: null,
  fileUrl: null,
  fileName: null,
  fileType: null,
  fileSize: null,
  targetAudience: null,
  gradeLevel: null,
  subject: null,
  purpose: null,
  enhancementStyle: null,
  colorScheme: null,
  visualComplexity: null,
  includeGraphics: true,
  includeCharts: true,
  enhancementId: null,
  documentId: null,
  jobId: null,
  enhancedUrl: null,
  thumbnailUrl: null,
  improvements: null,
  processingTime: null,
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
                completedSteps: [...new Set([...prev.completedSteps, prev.currentStep])],
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
              if (!data.file) {
                state.setError('upload', 'Please select a file to upload');
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
      }),
      {
        name: 'enhancement-wizard',
        partialize: (state) => ({
          // Only persist non-file data
          data: {
            ...state.data,
            file: null,
            fileUrl: null,
          },
          currentStep: state.currentStep,
          completedSteps: state.completedSteps,
        }),
      }
    )
  )
);