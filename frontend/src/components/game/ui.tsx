import type { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

// Minimal pixel-arcade controls (issue #9): the baseline look of the shadcn
// Button/Input the 2025 screens used, with NO shadcn/radix dependency.
// Callers pass sizing/spacing via className, exactly like the baseline
// screen markup did.
type PixelButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const PixelButton = ({ className = '', type = 'button', ...props }: PixelButtonProps) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-2 whitespace-nowrap h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-50 bg-primary text-white hover:bg-primary/90 ${className}`}
    {...props}
  />
);

type PixelInputProps = InputHTMLAttributes<HTMLInputElement>;

export const PixelInput = ({ className = '', ...props }: PixelInputProps) => (
  <input
    className={`flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-muted-foreground ${className}`}
    {...props}
  />
);
