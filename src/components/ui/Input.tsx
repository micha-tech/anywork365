import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="form-group">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'input-field',
            error && 'border-amber-300 focus:border-amber-400 focus:ring-amber-400/10',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-2 text-xs font-medium text-amber-700">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
