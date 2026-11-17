import { classifyBowlingStyle } from '../game/playingXiEngine';
import type { PlayerRole } from '../types/game';

export type DisplayRoleBadge = 'BAT' | 'WK' | 'AR' | 'PACE' | 'SPIN' | 'UNK';

export function getDisplayRoleBadge(role: PlayerRole, bowlingStyle: string = ''): DisplayRoleBadge {
  if (role === 'BAT') return 'BAT';
  if (role === 'WK') return 'WK';
  if (role === 'AR') return 'AR';
  if (role === 'BOWL') {
    return classifyBowlingStyle(bowlingStyle) === 'SPIN' ? 'SPIN' : 'PACE';
  }
  return 'UNK';
}

const ROLE_BADGE_STYLES: Record<DisplayRoleBadge, string> = {
  BAT: 'bg-[#1D4ED8] text-white border-[#1E3A8A]',
  WK: 'bg-[#B45309] text-white border-[#78350F]',
  AR: 'bg-[#6D28D9] text-white border-[#4C1D95]',
  PACE: 'bg-[#C2410C] text-white border-[#7C2D12]',
  SPIN: 'bg-[#BE185D] text-white border-[#831843]',
  UNK: 'bg-[#475569] text-white border-[#334155]',
};

export function RoleBadge({
  role,
  bowlingStyle = '',
  className = '',
}: {
  role: PlayerRole;
  bowlingStyle?: string;
  className?: string;
}) {
  const badge = getDisplayRoleBadge(role, bowlingStyle);
  return (
    <span
      className={`inline-flex h-5 w-[46px] shrink-0 items-center justify-center rounded-[2px] border font-mono text-[10px] font-bold tracking-wider uppercase ${ROLE_BADGE_STYLES[badge]} ${className}`}
    >
      {badge}
    </span>
  );
}
