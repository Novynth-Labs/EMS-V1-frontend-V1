import React, { forwardRef } from 'react';
import { AlertCircle, X } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | boolean;
  helperText?: string;
  icon?: React.ReactNode;
  onClear?: () => void;
  sizeVariant?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      label,
      error,
      helperText,
      icon,
      onClear,
      value,
      id,
      sizeVariant = 'md',
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;

    const sizeStyles = {
      sm: 'py-1.5 text-xs rounded-lg',
      md: 'py-2.5 text-sm rounded-xl',
      lg: 'py-3 text-base rounded-xl',
    };

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1 font-bold">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 text-slate-400 pointer-events-none shrink-0 flex items-center justify-center">
              {icon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            value={value}
            disabled={disabled}
            aria-invalid={hasError}
            className={`
              w-full border font-medium transition-all duration-150 ease-out outline-none
              ${icon ? 'pl-10' : 'pl-3.5'}
              ${onClear && value ? 'pr-9' : 'pr-3.5'}
              ${sizeStyles[sizeVariant]}
              bg-slate-50/70 text-slate-900 placeholder:text-slate-400
              ${
                hasError
                  ? 'border-red-400 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 focus:bg-white'
                  : 'border-slate-200/90 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10'
              }
              disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed
              ${className}
            `.trim()}
            {...props}
          />

          {onClear && value && !disabled && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200/50"
              aria-label="Clear field"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {errorMessage && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1 animate-fade-in">
            <AlertCircle size={13} className="shrink-0" />
            <span>{errorMessage}</span>
          </p>
        )}

        {!errorMessage && helperText && (
          <p className="text-xs text-slate-500 font-normal mt-1">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';


