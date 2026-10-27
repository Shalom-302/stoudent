import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-ink-100 text-ink-700',
        accent: 'bg-accent-100 text-accent-600',
        success: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
        danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
        outline: 'border border-ink-200 text-ink-600',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
