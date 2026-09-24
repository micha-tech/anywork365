import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }
export const IconButton = forwardRef<HTMLButtonElement, Props>(({ className, type = 'button', ...props }, ref) => <button ref={ref} type={type} className={cn('icon-button', className)} {...props} />)
IconButton.displayName = 'IconButton'
