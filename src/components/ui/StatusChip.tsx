import React from 'react';

type StatusVariant = 'active' | 'pending' | 'inactive' | 'leave' | 'error' | 'offline' | 'info';

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: StatusVariant;
  label: string;
  size?: 'sm' | 'md';
}

const variantStyles: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-emerald-50/90 border-emerald-200/80', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  pending: { bg: 'bg-amber-50/90 border-amber-200/80', text: 'text-amber-700', dot: 'bg-amber-500' },
  inactive: { bg: 'bg-rose-50/90 border-rose-200/80', text: 'text-rose-700', dot: 'bg-rose-500' },
  leave: { bg: 'bg-slate-100/90 border-slate-200/80', text: 'text-slate-600', dot: 'bg-slate-400' },
  error: { bg: 'bg-rose-50/90 border-rose-200/80', text: 'text-rose-700', dot: 'bg-rose-500' },
  offline: { bg: 'bg-slate-100/90 border-slate-200/80', text: 'text-slate-600', dot: 'bg-slate-400' },
  info: { bg: 'bg-sky-50/90 border-sky-200/80', text: 'text-sky-700', dot: 'bg-sky-500' },
};

export const StatusChip: React.FC<StatusChipProps> = ({ variant, label, size = 'md', className = '', ...props }) => {
  const styles = variantStyles[variant] || variantStyles.inactive;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span 
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border tracking-tight shadow-2xs ${styles.bg} ${styles.text} ${sizeClasses} ${className}`.trim()}
      {...props}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />
      <span>{label}</span>
    </span>
  );
};

