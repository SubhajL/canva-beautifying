import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface BatchFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  enhancementId?: string;
  uploadedUrl?: string;
  enhancedUrl?: string;
  selected: boolean;
}

export interface BatchUploadState {
  files: BatchFile[];
  batchId: string | null;
  isProcessing: boolean;
  totalProgress: number;
  
  // Actions
  addFiles: (files: File[]) => void;
  removeFile: (fileId: string) => void;
  toggleFileSelection: (fileId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  updateFileStatus: (fileId: string, status: BatchFile['status'], error?: string) => void;
  updateFileProgress: (fileId: string, progress: number) => void;
  updateFileData: (fileId: string, data: Partial<BatchFile>) => void;
  getSelectedFiles: () => BatchFile[];
  clearBatch: () => void;
  setBatchId: (batchId: string) => void;
  setProcessing: (isProcessing: boolean) => void;
  updateTotalProgress: () => void;
}

export const useBatchUploadStore = create<BatchUploadState>()(
  devtools(
    persist(
      (set, get) => ({
        files: [],
        batchId: null,
        isProcessing: false,
        totalProgress: 0,

        addFiles: (newFiles) => {
          const batchFiles: BatchFile[] = newFiles.map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            preview: URL.createObjectURL(file),
            status: 'pending',
            progress: 0,
            selected: true,
          }));

          set((state) => ({
            files: [...state.files, ...batchFiles],
          }));
        },

        removeFile: (fileId) => {
          const file = get().files.find((f) => f.id === fileId);
          if (file?.preview) {
            URL.revokeObjectURL(file.preview);
          }

          set((state) => ({
            files: state.files.filter((f) => f.id !== fileId),
          }));
          
          get().updateTotalProgress();
        },

        toggleFileSelection: (fileId) => {
          set((state) => ({
            files: state.files.map((f) =>
              f.id === fileId ? { ...f, selected: !f.selected } : f
            ),
          }));
        },

        selectAll: () => {
          set((state) => ({
            files: state.files.map((f) => ({ ...f, selected: true })),
          }));
        },

        deselectAll: () => {
          set((state) => ({
            files: state.files.map((f) => ({ ...f, selected: false })),
          }));
        },

        updateFileStatus: (fileId, status, error) => {
          set((state) => ({
            files: state.files.map((f) =>
              f.id === fileId ? { ...f, status, error } : f
            ),
          }));
          
          get().updateTotalProgress();
        },

        updateFileProgress: (fileId, progress) => {
          set((state) => ({
            files: state.files.map((f) =>
              f.id === fileId ? { ...f, progress } : f
            ),
          }));
          
          get().updateTotalProgress();
        },

        updateFileData: (fileId, data) => {
          set((state) => ({
            files: state.files.map((f) =>
              f.id === fileId ? { ...f, ...data } : f
            ),
          }));
        },

        getSelectedFiles: () => {
          return get().files.filter((f) => f.selected);
        },

        clearBatch: () => {
          // Clean up object URLs
          get().files.forEach((file) => {
            if (file.preview) {
              URL.revokeObjectURL(file.preview);
            }
          });

          set({
            files: [],
            batchId: null,
            isProcessing: false,
            totalProgress: 0,
          });
        },

        setBatchId: (batchId) => {
          set({ batchId });
        },

        setProcessing: (isProcessing) => {
          set({ isProcessing });
        },

        updateTotalProgress: () => {
          const files = get().files;
          if (files.length === 0) {
            set({ totalProgress: 0 });
            return;
          }

          const totalProgress = files.reduce((acc, file) => {
            // Calculate weighted progress based on status
            let fileProgress = 0;
            switch (file.status) {
              case 'pending':
                fileProgress = 0;
                break;
              case 'uploading':
                fileProgress = file.progress * 0.3; // Upload is 30% of total
                break;
              case 'uploaded':
                fileProgress = 30;
                break;
              case 'processing':
                fileProgress = 30 + (file.progress * 0.6); // Processing is 60% of total
                break;
              case 'completed':
                fileProgress = 100;
                break;
              case 'error':
                fileProgress = file.progress; // Keep whatever progress was made
                break;
            }
            return acc + fileProgress;
          }, 0);

          set({ totalProgress: Math.round(totalProgress / files.length) });
        },
      }),
      {
        name: 'batch-upload-storage',
        partialize: (state) => ({
          files: state.files.map((f) => ({
            ...f,
            file: undefined, // Don't persist File objects
            preview: '', // Don't persist object URLs
          })),
          batchId: state.batchId,
        }),
      }
    )
  )
);