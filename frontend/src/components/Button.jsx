import { forwardRef } from 'preact/compat';

const variantStyles = {
  primary: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-hover)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2',
  secondary: 'bg-white text-[var(--color-foreground)] border border-[var(--color-border)] hover:bg-[var(--color-muted)] hover:border-[var(--color-border-hover)] active:bg-[var(--color-muted)]',
  ghost: 'bg-transparent text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] active:bg-[var(--color-muted)]',
  danger: 'bg-[var(--color-destructive)] text-white hover:bg-[var(--color-destructive-hover)] active:bg-[var(--color-destructive-hover)] focus:ring-2 focus:ring-[var(--color-destructive)] focus:ring-offset-2',
};

const sizeStyles = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10 p-0 justify-center',
  'icon-sm': 'h-8 w-8 p-0 justify-center',
  'icon-lg': 'h-12 w-12 p-0 justify-center',
};

export const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';

// Icon button convenience wrapper
export function IconButton({
  children,
  variant = 'ghost',
  size = 'icon',
  className = '',
  ...props
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className={`${className}`}
      {...props}
    >
      {children}
    </Button>
  );
}
