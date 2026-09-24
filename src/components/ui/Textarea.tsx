'use client'

import { forwardRef, useId, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId

    return (
      <div className="form-group">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            'input-field resize-y min-h-[96px]',
            error && 'border-amber-300 focus:border-amber-400',
            className
          )}
          {...props}
        />
        {error && <p id={`${inputId}-error`} role="alert" className="field-message field-error">{error}</p>}
        {hint && !error && <p id={`${inputId}-hint`} className="field-message">{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
