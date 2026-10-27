import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900',
        'placeholder:text-ink-400 disabled:cursor-not-allowed disabled:bg-ink-50',
        'focus-visible:border-ink-900 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-20 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900',
        'placeholder:text-ink-400 focus-visible:border-ink-900 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900',
        'focus-visible:border-ink-900 focus-visible:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export { Input, Select, Textarea };
