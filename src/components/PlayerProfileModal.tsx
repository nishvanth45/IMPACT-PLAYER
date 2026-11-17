import { useEffect } from 'react';
import { X } from 'lucide-react';
import { FRANCHISES } from '../data/franchises';
import { formatCr } from '../game/draftEngine';
import {
  getPlayerFormMeta,
  getRatingBand,
  getRatingBandColorClass,
} from '../game/ratingEngine';
import type { PlayerForm, PlayerSeasonRecord } from '../types/game';
import { RoleBadge } from './RoleBadge';

interface PlayerProfileModalProps {
  player: PlayerSeasonRecord | null;
  activeForm?: PlayerForm;
  onClose: () => void;
}

function AttributeRow({ label, value }: { label: string; value: number }) {
  const barColor =
    value >= 90
      ? 'bg-[#B45309]'
      : value >= 80
        ? 'bg-[#157F3D]'
        : value >= 67
          ? 'bg-[#1D4ED8]'
          : value >= 50
            ? 'bg-[#6A6E75]'
            : 'bg-[#A1A5AD]';

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="truncate text-xs font-medium text-[#2D3138]">{label}</span>
      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden h-1.5 w-14 overflow-hidden rounded-[1px] bg-[#EAE3D5] sm:block">
          <div
            className={`h-full ${barColor}`}
            style={{ width: `${Math.max(8, Math.min(100, value))}%` }}
          />
        </div>
        <span className="w-6 text-right font-mono text-xs font-extrabold text-[#141619] tabular-nums">
          {value}
        </span>
      </div>
    </div>
  );
}

export function PlayerProfileModal({
  player,
  activeForm,
  onClose,
}: PlayerProfileModalProps) {
  useEffect(() => {
    if (!player) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [player, onClose]);

  if (!player) return null;

  const franchiseMeta = FRANCHISES[player.franchise];
  const resolvedForm = activeForm ?? player.form ?? 'NORMAL';
  const formMeta = getPlayerFormMeta(resolvedForm);
  const ovrBand = player.ratingBand ?? getRatingBand(player.overallRating);
  const batBand = getRatingBand(player.battingRating);
  const bowlBand = getRatingBand(player.bowlingRating);
  const impBand = getRatingBand(player.impactRating);

  const b = player.attributes.batting;
  const bw = player.attributes.bowling;
  const o = player.attributes.other;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-profile-title"
      data-testid="player-profile-modal"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[4px] border-2 border-[#141619] bg-[#FAF8F3] p-4 text-[#141619] shadow-[6px_6px_0px_#141619] sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#141619] pb-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <RoleBadge role={player.role} bowlingStyle={player.bowlingStyle} />
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#141619]">
                <span
                  className="h-2.5 w-2.5 rounded-[2px]"
                  style={{ backgroundColor: franchiseMeta.primaryColor }}
                  aria-hidden="true"
                />
                <span>
                  {player.franchise} • {player.season}
                </span>
              </span>
              <span
                className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                  player.isOverseas === true
                    ? 'border-[#F59E0B]/50 bg-[#FEF3C7] text-[#B45309]'
                    : player.isOverseas === false
                      ? 'border-[#157F3D]/40 bg-[#DCFCE7] text-[#157F3D]'
                      : 'border-stone-300 bg-stone-200 text-stone-700'
                }`}
              >
                {player.isOverseas === true
                  ? 'OVERSEAS'
                  : player.isOverseas === false
                    ? 'INDIAN'
                    : 'UNKNOWN'}
              </span>
              {player.isRetained && (
                <span className="rounded-[2px] bg-[#6D28D9] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-white">
                  RET
                </span>
              )}
              <span
                className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                  player.ratingStatus === 'FINAL'
                    ? 'border-[#157F3D]/40 bg-[#DCFCE7] text-[#157F3D]'
                    : 'border-[#B45309]/40 bg-[#FEF3C7] text-[#B45309]'
                }`}
              >
                {player.ratingStatus}
              </span>
            </div>

            <h2
              id="player-profile-title"
              className="mt-1.5 font-display text-2xl font-extrabold tracking-wide text-[#141619] uppercase sm:text-3xl"
            >
              {player.playerName}
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span
                data-testid="profile-form-badge"
                className={`inline-flex items-center gap-1 rounded-[2px] border px-2 py-0.5 font-mono text-[11px] font-bold ${formMeta.badgeClass}`}
              >
                <span>FORM:</span>
                <span>{formMeta.shortLabel}</span>
                {formMeta.modifier !== 0 && (
                  <span>({formMeta.modifier > 0 ? `+${formMeta.modifier}` : formMeta.modifier})</span>
                )}
              </span>
              <span className="rounded-[2px] border border-[#141619]/30 bg-white px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-[#B45309] tabular-nums">
                SALARY {formatCr(player.priceCr)} ({player.ratingStatus})
              </span>
              <span className="text-[11px] text-[#4A4E54]">
                Salary is independent of historical player ratings.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close player profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] border border-[#141619] bg-white text-[#141619] transition-colors hover:bg-[#141619] hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Headline Ratings (20-99) */}
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="border border-[#141619] bg-white p-2.5">
            <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">BAT</div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span
                data-testid="profile-bat-rating"
                className="font-mono text-2xl font-extrabold text-[#1D4ED8] tabular-nums"
              >
                {player.battingRating}
              </span>
              <span
                className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${getRatingBandColorClass(batBand)}`}
              >
                {batBand}
              </span>
            </div>
          </div>

          <div className="border border-[#141619] bg-white p-2.5">
            <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">BOWL</div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span
                data-testid="profile-bowl-rating"
                className="font-mono text-2xl font-extrabold text-[#157F3D] tabular-nums"
              >
                {player.bowlingRating}
              </span>
              <span
                className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${getRatingBandColorClass(bowlBand)}`}
              >
                {bowlBand}
              </span>
            </div>
          </div>

          <div className="border border-[#141619] bg-white p-2.5">
            <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">IMP</div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span
                data-testid="profile-imp-rating"
                className="font-mono text-2xl font-extrabold text-[#6D28D9] tabular-nums"
              >
                {player.impactRating}
              </span>
              <span
                className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${getRatingBandColorClass(impBand)}`}
              >
                {impBand}
              </span>
            </div>
          </div>

          <div className="border-2 border-[#141619] bg-[#0D1B2A] p-2.5 text-white">
            <div className="font-mono text-[10px] font-bold text-slate-300 uppercase">
              OVR ({player.role})
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span
                data-testid="profile-ovr-rating"
                className="font-mono text-2xl font-extrabold text-[#F59E0B] tabular-nums"
              >
                {player.overallRating}
              </span>
              <span
                className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${getRatingBandColorClass(ovrBand)}`}
              >
                {ovrBand}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed 25 Attributes */}
        <div className="mt-3.5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="border border-[#141619] bg-white p-3">
            <h3 className="border-b border-[#141619]/20 pb-1.5 font-display text-sm font-extrabold tracking-wider text-[#1D4ED8] uppercase">
              Batting (12)
            </h3>
            <div className="mt-1 divide-y divide-[#EAE3D5]">
              <AttributeRow label="Power" value={b.power} />
              <AttributeRow label="Timing" value={b.timing} />
              <AttributeRow label="Technique" value={b.technique} />
              <AttributeRow label="Strike Rotation" value={b.strikeRotation} />
              <AttributeRow label="Pace Hitting" value={b.paceHitting} />
              <AttributeRow label="Spin Hitting" value={b.spinHitting} />
              <AttributeRow label="Powerplay" value={b.powerplay} />
              <AttributeRow label="Middle Overs" value={b.middleOvers} />
              <AttributeRow label="Death Overs" value={b.deathOvers} />
              <AttributeRow label="Chase" value={b.chase} />
              <AttributeRow label="Pressure" value={b.pressure} />
              <AttributeRow label="Finishing" value={b.finishing} />
            </div>
          </div>

          <div className="border border-[#141619] bg-white p-3">
            <h3 className="border-b border-[#141619]/20 pb-1.5 font-display text-sm font-extrabold tracking-wider text-[#C2410C] uppercase">
              Bowling (8)
            </h3>
            <div className="mt-1 divide-y divide-[#EAE3D5]">
              <AttributeRow label="Wicket Taking" value={bw.wicketTaking} />
              <AttributeRow label="Economy" value={bw.economy} />
              <AttributeRow label="Powerplay Bowling" value={bw.powerplayBowling} />
              <AttributeRow label="Middle Overs Bowling" value={bw.middleOversBowling} />
              <AttributeRow label="Death Bowling" value={bw.deathBowling} />
              <AttributeRow label="Control" value={bw.control} />
              <AttributeRow label="Variation" value={bw.variation} />
              <AttributeRow label="Pressure" value={bw.pressure} />
            </div>
          </div>

          <div className="border border-[#141619] bg-white p-3">
            <h3 className="border-b border-[#141619]/20 pb-1.5 font-display text-sm font-extrabold tracking-wider text-[#6D28D9] uppercase">
              Other (5)
            </h3>
            <div className="mt-1 divide-y divide-[#EAE3D5]">
              <AttributeRow label="Fielding" value={o.fielding} />
              <AttributeRow label="Captaincy" value={o.captaincy} />
              <AttributeRow label="Consistency" value={o.consistency} />
              <AttributeRow label="Fitness" value={o.fitness} />
              <AttributeRow label="Impact Ability" value={o.impactAbility} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
