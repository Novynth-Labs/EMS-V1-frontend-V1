import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  size?: ButtonSize;
  isLoading?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-slate-800 to-slate-900 text-white border border-slate-700/60 shadow-xs hover:from-slate-700 hover:to-slate-800 hover:shadow-md hover:shadow-slate-900/15 active:from-slate-900 active:to-slate-950 focus-visible:ring-slate-800/40',
  secondary:
    'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white border border-indigo-400/40 shadow-xs hover:from-indigo-400 hover:to-indigo-500 hover:shadow-md hover:shadow-indigo-500/20 active:from-indigo-600 active:to-indigo-700 focus-visible:ring-indigo-500/40',
  accent:
    'bg-gradient-to-b from-sky-500 to-indigo-600 text-white border border-sky-400/40 shadow-xs hover:from-sky-400 hover:to-indigo-500 hover:shadow-md hover:shadow-sky-500/20 active:from-sky-600 active:to-indigo-700 focus-visible:ring-sky-500/40',
  ghost:
    'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200/70 focus-visible:ring-slate-400/40',
  outline:
    'bg-white text-slate-700 border border-slate-200/90 shadow-2xs hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 hover:shadow-xs active:bg-slate-100 focus-visible:ring-indigo-500/30',
  danger:
    'bg-gradient-to-b from-red-500 to-red-600 text-white border border-red-400/40 shadow-xs hover:from-red-400 hover:to-red-500 hover:shadow-md hover:shadow-red-500/20 active:from-red-600 active:to-red-700 focus-visible:ring-red-500/40',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs rounded-lg gap-1.5 font-medium',
  sm: 'px-3.5 py-1.5 text-xs rounded-lg gap-1.5 font-semibold',
  md: 'px-4 py-2 text-sm rounded-xl gap-2 font-semibold',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2.5 font-semibold',
};

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  fullWidth = false, 
  size = 'md',
  isLoading = false,
  loading = false,
  icon,
  iconPosition = 'left',
  className = '', 
  children, 
  disabled,
  ...props 
}) => {
  const baseClass = variantClasses[variant];
  const widthClass = fullWidth ? 'w-full justify-center' : '';
  const actualLoading = isLoading || loading;
  const isDisabled = disabled || actualLoading;
  
  return (
    <button 
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center tracking-tight transition-all duration-150 ease-out
        active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none
        ${sizeClasses[size]} 
        ${baseClass} 
        ${widthClass} 
        ${className}
      `.trim()} 
      {...props}
    >
      {actualLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : icon && iconPosition === 'left' ? (
        <span className="shrink-0 transition-transform duration-150">{icon}</span>
      ) : null}

      {children ? <span>{children}</span> : null}

      {!isLoading && icon && iconPosition === 'right' ? (
        <span className="shrink-0 transition-transform duration-150">{icon}</span>
      ) : null}
    </button>
  );
};


