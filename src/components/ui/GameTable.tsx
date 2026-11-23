import type { ReactNode } from 'react';

interface GameTableProps {
  children: ReactNode;
  className?: string;
  maxHeightClassName?: string;
  'data-testid'?: string;
}

export function GameTable({
  children,
  className = '',
  maxHeightClassName = '',
  'data-testid': testId,
}: GameTableProps) {
  return (
    <div
      data-testid={testId}
      className={`overflow-hidden border border-[#263039] bg-[#0E1318] text-[#F5F2EA] ${className}`}
    >
      <div className={`overflow-x-auto ${maxHeightClassName}`}>{children}</div>
    </div>
  );
}

interface GameTableHeaderProps {
  children: ReactNode;
  className?: string;
}

export function GameTableHeader({ children, className = '' }: GameTableHeaderProps) {
  return (
    <div
      className={`sticky top-0 z-10 border-b border-[#263039] bg-[#111820] px-3 py-2 font-mono text-[10px] font-bold tracking-wider text-[#9DA8B3] uppercase ${className}`}
    >
      {children}
    </div>
  );
}
