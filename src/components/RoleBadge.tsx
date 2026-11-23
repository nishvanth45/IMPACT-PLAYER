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
  BAT: 'bg-[#10233F] text-[#60A5FA] border-[#2563EB]/45',
  WK: 'bg-[#261D0B] text-[#F5B942] border-[#F5B942]/45',
  AR: 'bg-[#1F1536] text-[#C084FC] border-[#A855F7]/45',
  PACE: 'bg-[#29150F] text-[#F05A32] border-[#F05A32]/45',
  SPIN: 'bg-[#281217] text-[#F87171] border-[#E44949]/45',
  UNK: 'bg-[#151D26] text-[#9DA8B3] border-[#263039]',
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
