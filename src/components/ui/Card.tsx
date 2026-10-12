import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
  glass?: boolean;
  variant?: 'default' | 'flat' | 'bordered';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hover = false, 
  glass = false, 
  variant = 'default',
  ...props 
}) => {
  const variantClass = variant === 'flat' 
    ? 'bg-slate-50 border border-slate-200/60' 
    : variant === 'bordered'
    ? 'bg-white border-2 border-slate-200'
    : 'bg-white border border-slate-200/80 shadow-2xs';

  return (
    <div 
      className={`
        ${glass ? 'novynth-glass' : variantClass} 
        rounded-2xl transition-all duration-200 ease-out
        ${hover ? 'hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5' : ''} 
        ${className}
      `.trim()} 
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement> & { action?: React.ReactNode }> = ({ 
  children, 
  action,
  className = '', 
  ...props 
}) => (
  <div className={`px-6 py-4.5 border-b border-slate-100 flex items-center justify-between gap-4 ${className}`.trim()} {...props}>
    <div className="min-w-0 flex-1">{children}</div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className = '', ...props }) => (
  <h3 className={`text-base font-bold text-slate-900 tracking-tight ${className}`.trim()} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className = '', ...props }) => (
  <p className={`text-xs text-slate-500 font-normal mt-0.5 ${className}`.trim()} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`px-6 py-5 ${className}`.trim()} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`px-6 py-3.5 border-t border-slate-100 bg-slate-50/40 rounded-b-2xl flex items-center justify-between gap-3 ${className}`.trim()} {...props}>
    {children}
  </div>
);

