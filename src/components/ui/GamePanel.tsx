import type { ReactNode } from 'react';

interface GamePanelProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
  'data-testid'?: string;
}

export function GamePanel({
  children,
  variant = 'primary',
  className = '',
  'data-testid': testId,
}: GamePanelProps) {
  const surface =
    variant === 'secondary'
      ? 'bg-[#111820] border-[#263039]'
      : 'bg-[#0E1318] border-[#263039]';

  return (
    <div
      data-testid={testId}
      className={`border text-[#F5F2EA] ${surface} ${className}`}
    >
      {children}
    </div>
  );
}

interface GamePanelHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function GamePanelHeader({
  title,
  subtitle,
  action,
  className = '',
}: GamePanelHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#263039] bg-[#111820] px-3.5 py-2.5 ${className}`}
    >
      <div className="min-w-0">
        <div className="font-display text-base font-extrabold tracking-wider text-[#F5F2EA] uppercase">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 font-mono text-[10.5px] text-[#9DA8B3]">{subtitle}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
