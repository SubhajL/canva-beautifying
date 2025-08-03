import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface AccessibleFormFieldProps {
  id: string;
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  multiline?: boolean;
  rows?: number;
  className?: string;
  inputClassName?: string;
}

export const AccessibleFormField = React.forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  AccessibleFormFieldProps
>(({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  success,
  hint,
  required,
  disabled,
  readOnly,
  placeholder,
  autoComplete,
  inputMode,
  multiline = false,
  rows = 3,
  className,
  inputClassName,
}, ref) => {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const successId = `${id}-success`;
  
  const ariaDescribedBy = [
    error && errorId,
    hint && hintId,
    success && successId,
  ].filter(Boolean).join(' ') || undefined;

  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className={cn('space-y-2', className)}>
      <Label 
        htmlFor={id}
        className={cn(
          'flex items-center gap-1',
          error && 'text-destructive',
          disabled && 'opacity-50'
        )}
      >
        {label}
        {required && (
          <span className="text-destructive" aria-label="required">
            *
          </span>
        )}
      </Label>

      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}

      <div className="relative">
        <InputComponent
          ref={ref as any}
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          rows={multiline ? rows : undefined}
          required={required}
          aria-invalid={!!error}
          aria-describedby={ariaDescribedBy}
          aria-required={required}
          className={cn(
            error && 'border-destructive focus-visible:ring-destructive',
            success && 'border-green-500 focus-visible:ring-green-500',
            (error || success) && 'pr-10',
            inputClassName
          )}
        />
        
        {/* Status icons */}
        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
          </div>
        )}
        
        {success && !error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Error message with live region */}
      {error && (
        <p 
          id={errorId} 
          className="text-sm text-destructive flex items-center gap-1"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* Success message */}
      {success && !error && (
        <p 
          id={successId} 
          className="text-sm text-green-600 flex items-center gap-1"
          role="status"
          aria-live="polite"
        >
          <CheckCircle className="h-3 w-3" aria-hidden="true" />
          {success}
        </p>
      )}
    </div>
  );
});

AccessibleFormField.displayName = 'AccessibleFormField';

// Fieldset wrapper for grouped form fields
interface AccessibleFieldsetProps {
  legend: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
}

export function AccessibleFieldset({
  legend,
  description,
  children,
  className,
  error,
}: AccessibleFieldsetProps) {
  const fieldsetId = React.useId();
  const errorId = `${fieldsetId}-error`;
  const descId = `${fieldsetId}-desc`;

  return (
    <fieldset 
      className={cn('space-y-4', className)}
      aria-describedby={[
        description && descId,
        error && errorId,
      ].filter(Boolean).join(' ') || undefined}
    >
      <legend className="text-lg font-semibold">
        {legend}
      </legend>
      
      {description && (
        <p id={descId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      
      {error && (
        <p 
          id={errorId} 
          className="text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
      
      {children}
    </fieldset>
  );
}

// Radio group with proper labeling
interface AccessibleRadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface AccessibleRadioGroupProps {
  name: string;
  legend: string;
  options: AccessibleRadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  required?: boolean;
  className?: string;
}

export function AccessibleRadioGroup({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  required,
  className,
}: AccessibleRadioGroupProps) {
  const groupId = React.useId();
  const errorId = `${groupId}-error`;

  return (
    <fieldset 
      className={cn('space-y-3', className)}
      aria-describedby={error ? errorId : undefined}
      aria-required={required}
    >
      <legend className="text-base font-medium">
        {legend}
        {required && (
          <span className="text-destructive ml-1" aria-label="required">
            *
          </span>
        )}
      </legend>
      
      {error && (
        <p 
          id={errorId} 
          className="text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
      
      <div className="space-y-2" role="radiogroup">
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`;
          const descId = `${optionId}-desc`;
          
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                'hover:bg-accent/50',
                value === option.value && 'border-primary bg-primary/5',
                option.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={option.disabled}
                className="mt-1"
                aria-describedby={option.description ? descId : undefined}
              />
              <div className="flex-1">
                <div className="font-medium">{option.label}</div>
                {option.description && (
                  <p id={descId} className="text-sm text-muted-foreground mt-1">
                    {option.description}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}