interface TeamLogoProps {
  code: string;
  primaryColor?: string;
  secondaryColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'h-5 min-w-[30px] px-1 text-[9px]',
  sm: 'h-6 min-w-[36px] px-1.5 text-[10px]',
  md: 'h-8 min-w-[44px] px-2 text-xs',
  lg: 'h-12 min-w-[58px] px-2.5 text-base',
};

export function TeamLogo({
  code,
  primaryColor = '#111820',
  secondaryColor = '#263039',
  size = 'sm',
  className = '',
}: TeamLogoProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[2px] border font-mono font-extrabold tracking-wider text-[#F5F2EA] uppercase tabular-nums ${SIZE_CLASSES[size]} ${className}`}
      style={{
        backgroundColor: primaryColor,
        borderColor: secondaryColor,
      }}
    >
      {code}
    </span>
  );
}
