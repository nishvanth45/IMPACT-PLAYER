import { useEffect } from 'react';
import { X } from 'lucide-react';
import { FRANCHISES } from '../data/franchises';
import { isProvisionalStatus } from '../data/playerRepository';
import { getPlayerDisplayPriceInfo } from '../game/draftEngine';
import {
  getPlayerFormMeta,
  getRatingBand,
} from '../game/ratingEngine';
import type { PlayerForm, PlayerSeasonRecord } from '../types/game';
import { PlayerDataPendingBadge } from './PlayerDataPendingBadge';
import { RoleBadge } from './RoleBadge';
import { getDarkFormBadgeClass, getDarkRatingBandClass } from './ui/StatusBadge';

interface PlayerProfileModalProps {
  player: PlayerSeasonRecord | null;
  activeForm?: PlayerForm;
  onClose: () => void;
}

function AttributeRow({ label, value }: { label: string; value: number }) {
  const barColor =
    value >= 90
      ? 'bg-[#F5B942]'
      : value >= 80
        ? 'bg-[#22D36B]'
        : value >= 67
          ? 'bg-[#60A5FA]'
          : value >= 50
            ? 'bg-[#9DA8B3]'
            : 'bg-[#475569]';

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="truncate text-xs font-medium text-[#9DA8B3]">{label}</span>
      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden h-1.5 w-14 overflow-hidden rounded-[1px] bg-[#080B0D] sm:block">
          <div
            className={`h-full ${barColor}`}
            style={{ width: `${Math.max(8, Math.min(100, value))}%` }}
          />
        </div>
        <span className="w-6 text-right font-mono text-xs font-extrabold text-[#F5F2EA] tabular-nums">
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
  const hasRatings = player.hasRatings !== false && player.overallRating > 0;
  const ovrBand = player.ratingBand ?? getRatingBand(player.overallRating);
  const batBand = getRatingBand(player.battingRating);
  const bowlBand = getRatingBand(player.bowlingRating);
  const impBand = getRatingBand(player.impactRating);
  const qualityStatus = player.ratingQuality?.status ?? player.ratingStatus;
  const showProvisional = !hasRatings || isProvisionalStatus(qualityStatus);
  const priceInfo = getPlayerDisplayPriceInfo(player);

  const b = player.attributes.batting;
  const bw = player.attributes.bowling;
  const o = player.attributes.other;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080B0D]/85 p-3 sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-profile-title"
      data-testid="player-profile-modal"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2px] border border-[#263039] bg-[#0E1318] p-4 text-[#F5F2EA] shadow-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#263039] pb-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <RoleBadge role={player.role} bowlingStyle={player.bowlingStyle} />
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#F5F2EA]">
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
                    ? 'border-[#F5B942]/40 bg-[#201A0A] text-[#F5B942]'
                    : player.isOverseas === false
                      ? 'border-[#22D36B]/35 bg-[#0A2014] text-[#22D36B]'
                      : 'border-[#263039] bg-[#111820] text-[#9DA8B3]'
                }`}
              >
                {player.isOverseas === true
                  ? 'OVERSEAS'
                  : player.isOverseas === false
                    ? 'INDIAN'
                    : 'UNKNOWN'}
              </span>
              {player.isRetained && (
                <span className="rounded-[2px] border border-[#22D36B] bg-[#0A2014] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-[#22D36B]">
                  RET
                </span>
              )}
              {!hasRatings ? (
                <PlayerDataPendingBadge player={player} />
              ) : showProvisional ? (
                <PlayerDataPendingBadge player={player} />
              ) : (
                <>
                  <span className="rounded-[2px] border border-[#22D36B]/35 bg-[#0A2014] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#22D36B]">
                    {qualityStatus === 'PARTIAL_STATS_DERIVED' ? 'PARTIAL STATS' : 'VERIFIED STATS'}
                  </span>
                  <PlayerDataPendingBadge player={player} />
                </>
              )}
            </div>

            <h2
              id="player-profile-title"
              className="mt-1.5 font-display text-2xl font-extrabold tracking-wide text-[#F5F2EA] uppercase sm:text-3xl"
            >
              {player.playerName}
            </h2>
            {player.aliases && player.aliases.length > 0 && (
              <div className="mt-0.5 font-mono text-[10.5px] text-[#9DA8B3]">
                Aliases: {player.aliases.join(', ')}
              </div>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span
                data-testid="profile-form-badge"
                className={`inline-flex items-center gap-1 rounded-[2px] border px-2 py-0.5 font-mono text-[11px] font-bold ${getDarkFormBadgeClass(resolvedForm)}`}
              >
                <span>FORM:</span>
                <span>{formMeta.shortLabel}</span>
                {formMeta.modifier !== 0 && (
                  <span>({formMeta.modifier > 0 ? `+${formMeta.modifier}` : formMeta.modifier})</span>
                )}
              </span>
              <span
                className={`rounded-[2px] border border-[#263039] bg-[#111820] px-2.5 py-0.5 font-mono text-[11px] font-extrabold tabular-nums ${
                  priceInfo.source === 'GAME_VALUE'
                    ? 'text-[#9DA8B3]'
                    : priceInfo.amountCr === null
                      ? 'text-[#667380]'
                      : 'text-[#F5B942]'
                }`}
              >
                {priceInfo.source === 'RETENTION'
                  ? `RETENTION · ${priceInfo.label}`
                  : priceInfo.label}
              </span>
              <span className="text-[11px] text-[#9DA8B3]">
                Salary is independent of historical player ratings.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close player profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] border border-[#263039] bg-[#111820] text-[#9DA8B3] transition-colors hover:border-[#22D36B] hover:text-[#F5F2EA]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Headline Ratings (20-99) */}
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="border border-[#263039] bg-[#111820] p-2.5">
            <div className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">BAT</div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span
                data-testid="profile-bat-rating"
                className="font-mono text-2xl font-extrabold text-[#60A5FA] tabular-nums"
              >
                {hasRatings ? player.battingRating : '—'}
              </span>
              {hasRatings && (
                <span
                  className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${getDarkRatingBandClass(batBand)}`}
                >
                  {batBand}
                </span>
              )}
            </div>
          </div>

          <div className="border border-[#263039] bg-[#111820] p-2.5">
            <div className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">BOWL</div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span
                data-testid="profile-bowl-rating"
                className="font-mono text-2xl font-extrabold text-[#22D36B] tabular-nums"
              >
                {hasRatings ? player.bowlingRating : '—'}
              </span>
              {hasRatings && (
                <span
                  className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${getDarkRatingBandClass(bowlBand)}`}
                >
                  {bowlBand}
                </span>
              )}
            </div>
          </div>

          <div className="border border-[#263039] bg-[#111820] p-2.5">
            <div className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">IMP</div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span
                data-testid="profile-imp-rating"
                className="font-mono text-2xl font-extrabold text-[#F05A32] tabular-nums"
              >
                {hasRatings ? player.impactRating : '—'}
              </span>
              {hasRatings && (
                <span
                  className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${getDarkRatingBandClass(impBand)}`}
                >
                  {impBand}
                </span>
              )}
            </div>
          </div>

          <div className="border border-[#22D36B]/45 bg-[#0A2014] p-2.5 text-[#F5F2EA]">
            <div className="font-mono text-[10px] font-bold text-[#22D36B] uppercase">
              OVR ({player.role})
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
              <span
                data-testid="profile-ovr-rating"
                className="font-mono text-2xl font-extrabold text-[#F5B942] tabular-nums"
              >
                {hasRatings ? player.overallRating : '—'}
              </span>
              {hasRatings ? (
                <span
                  className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${getDarkRatingBandClass(ovrBand)}`}
                >
                  {ovrBand}
                </span>
              ) : (
                <span className="rounded-[2px] border border-[#F5B942]/35 bg-[#201A0A] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#F5B942]">
                  RATING PENDING
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Detailed 25 Attributes */}
        <div className="mt-3.5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="border border-[#263039] bg-[#111820] p-3">
            <h3 className="border-b border-[#263039] pb-1.5 font-display text-sm font-extrabold tracking-wider text-[#60A5FA] uppercase">
              Batting (12)
            </h3>
            <div className="mt-1 divide-y divide-[#263039]/60">
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

          <div className="border border-[#263039] bg-[#111820] p-3">
            <h3 className="border-b border-[#263039] pb-1.5 font-display text-sm font-extrabold tracking-wider text-[#F05A32] uppercase">
              Bowling (8)
            </h3>
            <div className="mt-1 divide-y divide-[#263039]/60">
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

          <div className="border border-[#263039] bg-[#111820] p-3">
            <h3 className="border-b border-[#263039] pb-1.5 font-display text-sm font-extrabold tracking-wider text-[#22D36B] uppercase">
              Other (5)
            </h3>
            <div className="mt-1 divide-y divide-[#263039]/60">
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
