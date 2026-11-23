import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type GameButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
export type GameButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<GameButtonVariant, string> = {
  primary:
    'border border-[#22D36B] bg-[#22D36B] text-[#06110A] hover:bg-[#3CE282] hover:border-[#3CE282] disabled:border-[#263039] disabled:bg-[#111820] disabled:text-[#667380]',
  secondary:
    'border border-[#263039] bg-[#111820] text-[#F5F2EA] hover:border-[#22D36B]/60 hover:bg-[#16202B] disabled:border-[#263039]/60 disabled:bg-[#0E1318] disabled:text-[#667380]',
  accent:
    'border border-[#F05A32] bg-[#F05A32] text-[#080B0D] hover:bg-[#FF7048] hover:border-[#FF7048] disabled:border-[#263039] disabled:bg-[#111820] disabled:text-[#667380]',
  danger:
    'border border-[#E44949]/60 bg-[#231012] text-[#FCA5A5] hover:border-[#E44949] hover:bg-[#E44949] hover:text-[#080B0D] disabled:opacity-50',
  ghost:
    'border border-transparent bg-transparent text-[#9DA8B3] hover:border-[#263039] hover:bg-[#111820] hover:text-[#F5F2EA] disabled:opacity-50',
};

const SIZE_CLASSES: Record<GameButtonSize, string> = {
  xs: 'min-h-[28px] px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider',
  sm: 'min-h-[34px] px-3 py-1.5 font-mono text-[11px] font-extrabold tracking-wider',
  md: 'min-h-[42px] px-4 py-2 font-mono text-xs font-extrabold tracking-wider',
  lg: 'min-h-[46px] px-5 py-2.5 font-display text-lg font-extrabold tracking-wider',
};

export function GameButton({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}: GameButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-[2px] uppercase whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#22D36B] disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
