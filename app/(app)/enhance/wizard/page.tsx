import { EnhancementWizard } from '@/components/wizard/enhancement-wizard';
import { FeatureErrorBoundary } from '@/components/error-boundaries/FeatureErrorBoundary';
import { AsyncErrorBoundary } from '@/components/error-boundaries/AsyncErrorBoundary';

export const metadata = {
  title: 'Enhancement Wizard - BeautifyAI',
  description: 'Step-by-step document enhancement wizard',
};

export default function WizardPage() {
  return (
    <FeatureErrorBoundary featureName="Enhancement Wizard">
      <AsyncErrorBoundary>
        <EnhancementWizard />
      </AsyncErrorBoundary>
    </FeatureErrorBoundary>
  );
}