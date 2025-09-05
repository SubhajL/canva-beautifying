"use client"

import BatchUploadPage from './batch-upload-page'
import { FeatureErrorBoundary } from '@/components/error-boundaries/FeatureErrorBoundary'
import { AsyncErrorBoundary } from '@/components/error-boundaries/AsyncErrorBoundary'

export default function UploadPage() {
  return (
    <FeatureErrorBoundary featureName="Document Upload">
      <AsyncErrorBoundary>
        <BatchUploadPage />
      </AsyncErrorBoundary>
    </FeatureErrorBoundary>
  )
}