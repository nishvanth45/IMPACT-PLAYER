import type { ReactNode } from 'react';

export type StatusBadgeTone = 'green' | 'orange' | 'gold' | 'red' | 'neutral' | 'muted';

interface StatusBadgeProps {
  tone?: StatusBadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
  'data-testid'?: string;
}

const TONE_CLASSES: Record<StatusBadgeTone, string> = {
  green: 'border-[#22D36B]/45 bg-[#0A2014] text-[#22D36B]',
  orange: 'border-[#F05A32]/50 bg-[#23120D] text-[#F05A32]',
  gold: 'border-[#F5B942]/45 bg-[#201A0A] text-[#F5B942]',
  red: 'border-[#E44949]/50 bg-[#231012] text-[#F87171]',
  neutral: 'border-[#263039] bg-[#111820] text-[#F5F2EA]',
  muted: 'border-[#263039] bg-[#0E1318] text-[#9DA8B3]',
};

export function StatusBadge({
  tone = 'neutral',
  children,
  className = '',
  title,
  'data-testid': testId,
}: StatusBadgeProps) {
  return (
    <span
      data-testid={testId}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function getDarkFormBadgeClass(form: string): string {
  switch (form) {
    case 'EXCELLENT':
      return 'border-[#F5B942]/50 bg-[#201A0A] text-[#F5B942]';
    case 'GOOD':
      return 'border-[#22D36B]/50 bg-[#0A2014] text-[#22D36B]';
    case 'POOR':
      return 'border-[#F05A32]/50 bg-[#23120D] text-[#F05A32]';
    case 'VERY_POOR':
      return 'border-[#E44949]/50 bg-[#231012] text-[#F87171]';
    default:
      return 'border-[#263039] bg-[#111820] text-[#9DA8B3]';
  }
}

export function getDarkRatingBandClass(band: string): string {
  switch (band) {
    case 'LEGENDARY':
    case 'ELITE':
      return 'border-[#22D36B]/50 bg-[#0A2014] text-[#22D36B]';
    case 'VERY_STRONG':
    case 'STRONG':
      return 'border-[#F5B942]/45 bg-[#201A0A] text-[#F5B942]';
    case 'SOLID':
      return 'border-[#38BDF8]/40 bg-[#0C1D2E] text-[#7DD3FC]';
    case 'AVERAGE':
      return 'border-[#263039] bg-[#111820] text-[#9DA8B3]';
    default:
      return 'border-[#263039] bg-[#0E1318] text-[#9DA8B3]';
  }
}

