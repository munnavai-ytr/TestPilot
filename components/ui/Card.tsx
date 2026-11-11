import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
}

export function Card({
  className,
  as: Component = 'div',
  children,
  ...props
}: CardProps) {
  return (
    <Component
      className={cn(
        'rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.03)]',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
