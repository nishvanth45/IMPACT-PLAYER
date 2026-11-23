import { useEffect, useMemo, useState } from 'react';
import { Info, Lock, Search, Trash2, X } from 'lucide-react';
import { FRANCHISES } from '../data/franchises';
import type { PlayerRepository } from '../data/playerRepository';
import { formatCr } from '../game/draftEngine';
import {
  RETENTION_SLOT_COSTS,
  canRetainPlayerInSlot,
  getPlayerImpactScore,
  getRetentionSummary,
} from '../game/retentionEngine';
import type { DraftState, PlayerRole, PlayerSeasonRecord } from '../types/game';
import { AnimatedNumber, useAnimationPreferences } from './MotionPrimitives';
import { RoleBadge } from './RoleBadge';

interface RetentionScreenProps {
  state: DraftState;
  repository: PlayerRepository;
  onSetRetentionCount: (count: 0 | 1 | 2 | 3 | 4) => void;
  onAssignRetention: (player: PlayerSeasonRecord, slotIndex: number) => void;
  onClearRetentionSlot: (slotIndex: number) => void;
  onLockRetentions: () => void;
  onInspectPlayer?: (player: PlayerSeasonRecord) => void;
}

type RoleFilter = 'ALL' | Exclude<PlayerRole, 'UNKNOWN'>;
type OriginFilter = 'ALL' | 'INDIAN' | 'OVERSEAS';

interface CanonicalPlayerGroup {
  playerId: string;
  playerName: string;
  role: PlayerRole;
  bowlingStyle: string;
  isOverseas: boolean | null;
  bestOvr: number;
  bestImp: number;
  bestSeasonKey: string;
  seasons: PlayerSeasonRecord[];
}

function makeSeasonKey(rec: PlayerSeasonRecord): string {
  return `${rec.franchise}-${rec.season}`;
}

export function RetentionScreen({
  state,
  repository,
  onSetRetentionCount,
  onAssignRetention,
  onClearRetentionSlot,
  onLockRetentions,
  onInspectPlayer,
}: RetentionScreenProps) {
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('ALL');
  // Per-canonical-player selected season key (defaults to peak OVR season)
  const [seasonChoiceByPlayer, setSeasonChoiceByPlayer] = useState<Record<string, string>>({});
  const [recentlyRetainedId, setRecentlyRetainedId] = useState<string | null>(null);

  const animPrefs = useAnimationPreferences(state.settings);
  const summary = getRetentionSummary(state);
  const targetCount = state.retention.targetCount;
  const slots = state.retention.slots;

  useEffect(() => {
    if (slots.length === 0) {
      setActiveSlotIndex(0);
      return;
    }
    if (activeSlotIndex >= slots.length) {
      const firstEmpty = slots.findIndex((s) => s.player === null);
      setActiveSlotIndex(firstEmpty >= 0 ? firstEmpty : 0);
    }
  }, [slots, activeSlotIndex]);

  const indexedCanonicals = useMemo(() => repository.getUniqueCanonicalPlayers(), [repository]);

  // Each canonical player appears ONLY ONCE in search (using pre-indexed repository map + aliases)
  const canonicalPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minSeason = Math.min(state.settings.seasonStart, state.settings.seasonEnd);
    const maxSeason = Math.max(state.settings.seasonStart, state.settings.seasonEnd);
    const list: CanonicalPlayerGroup[] = [];

    for (const summary of indexedCanonicals) {
      const seasonsInRange = summary.seasons.filter((rec) => {
        if (rec.season < minSeason || rec.season > maxSeason) return false;
        if (roleFilter !== 'ALL' && rec.role !== roleFilter) return false;
        if (originFilter === 'INDIAN' && rec.isOverseas !== false) return false;
        if (originFilter === 'OVERSEAS' && rec.isOverseas !== true) return false;
        return true;
      });

      if (seasonsInRange.length === 0) continue;

      if (q) {
        const matchesName = summary.playerName.toLowerCase().includes(q);
        const matchesAlias = summary.aliases.some((alias) => alias.toLowerCase().includes(q));
        const matchesSeasonOrTeam = seasonsInRange.some((rec) => {
          const franchiseMeta = FRANCHISES[rec.franchise];
          return (
            rec.franchise.toLowerCase().includes(q) ||
            franchiseMeta.name.toLowerCase().includes(q) ||
            String(rec.season).includes(q)
          );
        });
        if (!matchesName && !matchesAlias && !matchesSeasonOrTeam) continue;
      }

      const best = seasonsInRange[0];
      list.push({
        playerId: summary.playerId,
        playerName: summary.playerName,
        role: best.role,
        bowlingStyle: best.bowlingStyle,
        isOverseas: best.isOverseas,
        bestOvr: best.overallRating,
        bestImp: getPlayerImpactScore(best),
        bestSeasonKey: makeSeasonKey(best),
        seasons: seasonsInRange,
      });
    }

    return list;
  }, [
    indexedCanonicals,
    state.settings.seasonStart,
    state.settings.seasonEnd,
    roleFilter,
    originFilter,
    searchQuery,
  ]);

  const activeSlot = slots[activeSlotIndex] ?? null;

  const handleAssign = (player: PlayerSeasonRecord) => {
    if (!activeSlot) return;
    onAssignRetention(player, activeSlotIndex);
    setRecentlyRetainedId(player.playerId);
    window.setTimeout(() => {
      setRecentlyRetainedId((prev) => (prev === player.playerId ? null : prev));
    }, 520);
    const nextEmptyIndex = slots.findIndex(
      (s, idx) => idx !== activeSlotIndex && s.player === null
    );
    if (nextEmptyIndex >= 0) {
      setActiveSlotIndex(nextEmptyIndex);
    }
  };

  return (
    <div data-testid="retention-screen" className="mt-3 space-y-3">
      {/* RETENTION ROOM HEADER & COUNT SELECTOR */}
      <div className="border border-[#263039] bg-[#0E1318]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#263039] bg-[#111820] px-4 py-3 text-[#F5F2EA]">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase sm:text-3xl">
              RETENTION ROOM
            </h1>
            <p className="font-mono text-[10.5px] text-[#9DA8B3]">
              Select 0–4 franchise retentions before entering the Spin Draft.
            </p>
          </div>

          <dl className="flex flex-wrap items-center gap-4 font-mono text-xs tabular-nums">
            <div>
              <dt className="text-[9.5px] text-[#9DA8B3] uppercase">Starting Purse</dt>
              <dd className="font-extrabold text-[#F5F2EA]">
                {formatCr(state.settings.startingPurseCr)}
              </dd>
            </div>
            <div>
              <dt className="text-[9.5px] text-[#9DA8B3] uppercase">Retentions</dt>
              <dd data-testid="summary-retained-count" className="font-extrabold text-[#F5B942]">
                <AnimatedNumber
                  value={summary.retainedCount}
                  enabled={animPrefs.isFull}
                  format={(v) => String(Math.round(v))}
                />
                /{targetCount ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-[9.5px] text-[#9DA8B3] uppercase">Projected Purse</dt>
              <dd data-testid="summary-remaining-purse" className="font-extrabold text-[#22D36B]">
                <AnimatedNumber
                  value={summary.remainingPurseCr}
                  enabled={animPrefs.isFull}
                  format={(v) => formatCr(Math.max(0, v))}
                />
              </dd>
            </div>
          </dl>
        </div>

        {/* Retention Count Options 0 | 1 | 2 | 3 | 4 */}
        <div className="p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10.5px] font-bold tracking-wider text-[#9DA8B3] uppercase">
              Retention Count
            </span>
            <span className="font-mono text-[10.5px] font-bold text-[#F5B942] tabular-nums">
              Slot Slabs: R1 ₹18 Cr · R2 ₹15 Cr · R3 ₹12 Cr · R4 ₹10 Cr
            </span>
          </div>

          <div
            className="mt-2 grid grid-cols-5 gap-2"
            role="group"
            aria-label="Number of players to retain"
          >
            {([0, 1, 2, 3, 4] as const).map((count) => {
              const active = targetCount === count;
              const totalCost = RETENTION_SLOT_COSTS.slice(0, count).reduce((a, b) => a + b, 0);
              const remainingCr = state.settings.startingPurseCr - totalCost;

              return (
                <button
                  key={count}
                  type="button"
                  data-testid={`retention-count-${count}`}
                  aria-pressed={active}
                  onClick={() => onSetRetentionCount(count)}
                  className={`flex min-h-[54px] flex-col items-center justify-center rounded-[2px] border px-2 py-1.5 text-center transition-colors ${
                    active
                      ? 'border-[#22D36B] bg-[#0A2014] text-[#22D36B]'
                      : 'border-[#263039] bg-[#111820] text-[#F5F2EA] hover:border-[#22D36B]/50'
                  }`}
                >
                  <span className="font-display text-2xl font-extrabold leading-none tabular-nums">
                    {count}
                  </span>
                  <span
                    className={`mt-0.5 font-mono text-[10px] font-bold tabular-nums ${
                      active ? 'text-[#22D36B]' : 'text-[#F5B942]'
                    }`}
                  >
                    {count === 0 ? '₹0 Cr' : `₹${totalCost} Cr`}
                  </span>
                  <span
                    className={`hidden font-mono text-[9px] tabular-nums sm:block ${
                      active ? 'text-[#22D36B]/85' : 'text-[#9DA8B3]'
                    }`}
                  >
                    Left ₹{remainingCr}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Zero-Retention Quick Lock Bar */}
      {targetCount === 0 && (
        <div
          data-testid="retention-summary"
          className="flex flex-wrap items-center justify-between gap-3 border border-[#263039] bg-[#0E1318] px-4 py-3 text-[#F5F2EA]"
        >
          <div>
            <div className="font-display text-lg font-extrabold tracking-wide uppercase">
              0 RETENTIONS SELECTED
            </div>
            <div className="font-mono text-xs text-[#9DA8B3] tabular-nums">
              Full {formatCr(state.settings.startingPurseCr)} purse available for 15 Spin Draft picks.
            </div>
          </div>
          <button
            type="button"
            onClick={onLockRetentions}
            data-testid="lock-retentions-btn"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-5 py-2 font-display text-lg font-extrabold tracking-wider text-[#06110A] uppercase hover:bg-[#3CE282] whitespace-nowrap"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span>LOCK RETENTIONS</span>
          </button>
        </div>
      )}

      {/* MAIN RETENTION WORKSPACE: Left = Single-Row Canonical Search, Right = YOUR RETENTIONS */}
      {targetCount !== null && targetCount > 0 && activeSlot && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.45fr_0.75fr] lg:items-start">
          {/* LEFT: Canonical Player Search Table */}
          <div className="border border-[#263039] bg-[#0E1318]">
            {/* Search & Filters */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#263039] bg-[#111820] p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative min-w-[180px] flex-1 sm:max-w-[230px]">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9DA8B3]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search player..."
                    aria-label="Search retention players"
                    className="h-8 w-full rounded-[2px] border border-[#263039] bg-[#080B0D] pl-8 pr-7 text-xs font-medium text-[#F5F2EA] placeholder:text-[#667380] focus:border-[#22D36B] focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear retention search"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[#9DA8B3] hover:text-[#F5F2EA]"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div
                  className="flex items-center gap-0.5 rounded-[2px] border border-[#263039] bg-[#080B0D] p-0.5"
                  role="group"
                  aria-label="Filter retention by role"
                >
                  {(['ALL', 'BAT', 'WK', 'AR', 'BOWL'] as RoleFilter[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleFilter(role)}
                      aria-pressed={roleFilter === role}
                      className={`h-6 rounded-[2px] px-2 font-mono text-[10px] font-bold transition-colors ${
                        roleFilter === role
                          ? 'bg-[#22D36B] text-[#06110A]'
                          : 'text-[#9DA8B3] hover:bg-[#111820] hover:text-[#F5F2EA]'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                <div
                  className="flex items-center gap-0.5 rounded-[2px] border border-[#263039] bg-[#080B0D] p-0.5"
                  role="group"
                  aria-label="Filter retention by nationality"
                >
                  {(
                    [
                      { id: 'ALL', label: 'ALL' },
                      { id: 'INDIAN', label: 'IND' },
                      { id: 'OVERSEAS', label: 'OS' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setOriginFilter(opt.id)}
                      aria-pressed={originFilter === opt.id}
                      className={`h-6 rounded-[2px] px-2 font-mono text-[10px] font-bold transition-colors ${
                        originFilter === opt.id
                          ? 'bg-[#22D36B] text-[#06110A]'
                          : 'text-[#9DA8B3] hover:bg-[#111820] hover:text-[#F5F2EA]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <span className="font-mono text-[10.5px] font-semibold text-[#9DA8B3] tabular-nums">
                {canonicalPlayers.length} players · Target: Slot {activeSlot.slotNumber} (₹
                {activeSlot.costCr} Cr)
              </span>
            </div>

            {/* Compact Single-Canonical-Player Rows */}
            <div
              data-testid="retention-player-list"
              className="max-h-[460px] overflow-y-auto"
            >
              {/* Desktop Header */}
              <div className="sticky top-0 z-10 hidden grid-cols-[54px_minmax(150px,2fr)_44px_38px_38px_38px_40px_84px] items-center gap-2 border-b border-[#263039] bg-[#111820] px-3 py-1.5 font-mono text-[10px] font-bold tracking-wider text-[#9DA8B3] uppercase md:grid">
                <div>ROLE</div>
                <div>PLAYER</div>
                <div>TYPE</div>
                <div className="text-center">BAT</div>
                <div className="text-center">BOWL</div>
                <div className="text-center">IMP</div>
                <div className="text-center">OVR</div>
                <div className="text-right">RETAIN</div>
              </div>

              {canonicalPlayers.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-[#9DA8B3]">
                  No players match your search or filters.
                </div>
              ) : (
                <div className="divide-y divide-[#263039]">
                  {canonicalPlayers.slice(0, 120).map((group) => {
                    const chosenKey = seasonChoiceByPlayer[group.playerId] ?? group.bestSeasonKey;
                    const activeRecord =
                      group.seasons.find((s) => makeSeasonKey(s) === chosenKey) ??
                      group.seasons[0];
                    const check = canRetainPlayerInSlot(state, activeRecord, activeSlotIndex);
                    const isAlreadyRetained = slots.some(
                      (s) => s.player !== null && s.player.playerId === group.playerId
                    );
                    const impScore = getPlayerImpactScore(activeRecord);
                    const disabled = !check.allowed || isAlreadyRetained;
                    const btnLabel = isAlreadyRetained
                      ? 'RETAINED'
                      : check.allowed
                        ? 'RETAIN'
                        : check.label ?? 'LOCKED';

                    const justRetained = recentlyRetainedId === group.playerId;

                    return (
                      <div
                        key={group.playerId}
                        data-testid={`retention-row-${group.playerId}`}
                        className={`transition-colors duration-150 ${
                          justRetained ? 'ip-green-flash' : ''
                        } ${
                          isAlreadyRetained
                            ? 'bg-[#22D36B]/[0.10]'
                            : disabled
                              ? 'bg-[#0A0E12] opacity-55'
                              : 'bg-[#0E1318] hover:bg-[#22D36B]/[0.06]'
                        }`}
                      >
                        {/* Desktop Row */}
                        <div className="hidden min-h-[42px] grid-cols-[54px_minmax(150px,2fr)_44px_38px_38px_38px_40px_84px] items-center gap-2 px-3 py-1 md:grid">
                          <div>
                            <RoleBadge
                              role={activeRecord.role}
                              bowlingStyle={activeRecord.bowlingStyle}
                            />
                          </div>

                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[13px] font-semibold text-[#F5F2EA]">
                              {group.playerName}
                            </span>
                            {isAlreadyRetained && (
                              <span
                                data-testid={`ret-badge-${group.playerId}`}
                                className="ip-chip-pop shrink-0 rounded-[2px] border border-[#22D36B] bg-[#0A2014] px-1.5 py-[1px] font-mono text-[9px] font-extrabold tracking-wider text-[#22D36B] uppercase"
                              >
                                RET
                              </span>
                            )}
                            {group.seasons.length > 1 ? (
                              <select
                                aria-label={`Season for ${group.playerName}`}
                                value={makeSeasonKey(activeRecord)}
                                onChange={(e) =>
                                  setSeasonChoiceByPlayer((prev) => ({
                                    ...prev,
                                    [group.playerId]: e.target.value,
                                  }))
                                }
                                className="h-5 shrink-0 rounded-[2px] border border-[#263039] bg-[#111820] px-1 font-mono text-[9.5px] font-bold text-[#9DA8B3] focus:border-[#22D36B] focus:outline-none"
                              >
                                {group.seasons.map((s) => (
                                  <option key={makeSeasonKey(s)} value={makeSeasonKey(s)}>
                                    {s.franchise} {s.season}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="shrink-0 font-mono text-[10px] font-semibold text-[#9DA8B3]">
                                {activeRecord.franchise} {activeRecord.season}
                              </span>
                            )}
                            {onInspectPlayer && (
                              <button
                                type="button"
                                onClick={() => onInspectPlayer(activeRecord)}
                                aria-label={`Inspect ${group.playerName}`}
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] text-[#9DA8B3] hover:text-[#22D36B]"
                              >
                                <Info className="h-3 w-3" aria-hidden="true" />
                              </button>
                            )}
                          </div>

                          <div>
                            <span
                              className={`inline-block rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${
                                activeRecord.isOverseas === true
                                  ? 'border-[#F5B942]/35 bg-[#201A0A] text-[#F5B942]'
                                  : 'border-[#22D36B]/30 bg-[#0A2014] text-[#22D36B]'
                              }`}
                            >
                              {activeRecord.isOverseas === true ? 'OS' : 'IND'}
                            </span>
                          </div>

                          <div className="text-center font-mono text-xs font-semibold text-[#9DA8B3] tabular-nums">
                            {activeRecord.hasRatings !== false && activeRecord.overallRating > 0
                              ? activeRecord.battingRating
                              : '—'}
                          </div>
                          <div className="text-center font-mono text-xs font-semibold text-[#9DA8B3] tabular-nums">
                            {activeRecord.hasRatings !== false && activeRecord.overallRating > 0
                              ? activeRecord.bowlingRating
                              : '—'}
                          </div>
                          <div className="text-center font-mono text-xs font-bold text-[#F05A32] tabular-nums">
                            {activeRecord.hasRatings !== false && activeRecord.overallRating > 0
                              ? impScore
                              : '—'}
                          </div>
                          <div className="text-center font-mono text-xs font-extrabold text-[#F5F2EA] tabular-nums">
                            {activeRecord.hasRatings !== false && activeRecord.overallRating > 0
                              ? activeRecord.overallRating
                              : '—'}
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => handleAssign(activeRecord)}
                              aria-label={`Retain ${group.playerName} (${activeRecord.franchise} ${activeRecord.season})`}
                              className={`inline-flex h-7 min-w-[76px] items-center justify-center rounded-[2px] px-2 font-mono text-[10px] font-extrabold tracking-wider uppercase transition-colors ${
                                isAlreadyRetained
                                  ? 'cursor-default border border-[#22D36B]/45 bg-[#0A2014] text-[#22D36B]'
                                  : disabled
                                    ? 'cursor-not-allowed border border-[#263039] bg-[#111820] text-[#667380]'
                                    : 'border border-[#22D36B] bg-[#22D36B] text-[#06110A] hover:bg-[#3CE282]'
                              }`}
                            >
                              {btnLabel}
                            </button>
                          </div>
                        </div>

                        {/* Mobile 2-Line Compact Row */}
                        <div className="px-3 py-2 md:hidden">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                              <RoleBadge
                                role={activeRecord.role}
                                bowlingStyle={activeRecord.bowlingStyle}
                              />
                              <span className="truncate text-[13px] font-semibold text-[#F5F2EA]">
                                {group.playerName}
                              </span>
                              {isAlreadyRetained && (
                                <span className="ip-chip-pop shrink-0 rounded-[2px] border border-[#22D36B] bg-[#0A2014] px-1 py-[1px] font-mono text-[8.5px] font-extrabold tracking-wider text-[#22D36B] uppercase">
                                  RET
                                </span>
                              )}
                              <span
                                className={`shrink-0 rounded-[2px] border px-1 font-mono text-[9px] font-bold ${
                                  activeRecord.isOverseas === true
                                    ? 'border-[#F5B942]/35 bg-[#201A0A] text-[#F5B942]'
                                    : 'border-[#22D36B]/30 bg-[#0A2014] text-[#22D36B]'
                                }`}
                              >
                                {activeRecord.isOverseas === true ? 'OS' : 'IND'}
                              </span>
                            </div>

                            {group.seasons.length > 1 ? (
                              <select
                                aria-label={`Season for ${group.playerName}`}
                                value={makeSeasonKey(activeRecord)}
                                onChange={(e) =>
                                  setSeasonChoiceByPlayer((prev) => ({
                                    ...prev,
                                    [group.playerId]: e.target.value,
                                  }))
                                }
                                className="h-6 shrink-0 rounded-[2px] border border-[#263039] bg-[#111820] px-1 font-mono text-[10px] font-bold text-[#F5F2EA]"
                              >
                                {group.seasons.map((s) => (
                                  <option key={makeSeasonKey(s)} value={makeSeasonKey(s)}>
                                    {s.franchise} {s.season}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="shrink-0 font-mono text-[10px] font-semibold text-[#9DA8B3]">
                                {activeRecord.franchise} {activeRecord.season}
                              </span>
                            )}
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <div className="font-mono text-[10.5px] text-[#9DA8B3] tabular-nums">
                              BAT{' '}
                              {activeRecord.hasRatings !== false && activeRecord.overallRating > 0
                                ? activeRecord.battingRating
                                : '—'}{' '}
                              · BWL{' '}
                              {activeRecord.hasRatings !== false && activeRecord.overallRating > 0
                                ? activeRecord.bowlingRating
                                : '—'}{' '}
                              ·{' '}
                              <span className="font-bold text-[#F05A32]">
                                IMP{' '}
                                {activeRecord.hasRatings !== false && activeRecord.overallRating > 0
                                  ? impScore
                                  : '—'}
                              </span>{' '}
                              ·{' '}
                              <span className="font-extrabold text-[#F5F2EA]">
                                OVR{' '}
                                {activeRecord.hasRatings !== false && activeRecord.overallRating > 0
                                  ? activeRecord.overallRating
                                  : '—'}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => handleAssign(activeRecord)}
                              className={`inline-flex min-h-[32px] min-w-[74px] items-center justify-center rounded-[2px] px-2.5 font-mono text-[10px] font-extrabold uppercase ${
                                isAlreadyRetained
                                  ? 'cursor-default border border-[#22D36B]/45 bg-[#0A2014] text-[#22D36B]'
                                  : disabled
                                    ? 'cursor-not-allowed border border-[#263039] bg-[#111820] text-[#667380]'
                                    : 'border border-[#22D36B] bg-[#22D36B] text-[#06110A]'
                              }`}
                            >
                              {btnLabel}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: YOUR RETENTIONS PANEL */}
          <aside
            data-testid="retention-summary"
            className="border border-[#263039] bg-[#0E1318]"
          >
            <div className="flex items-center justify-between border-b border-[#263039] bg-[#111820] px-3.5 py-2 text-[#F5F2EA]">
              <h2 className="font-display text-lg font-extrabold tracking-wider uppercase">
                YOUR RETENTIONS
              </h2>
              <span className="font-mono text-[11px] font-bold text-[#F5B942] tabular-nums">
                {summary.retainedCount}/{targetCount}
              </span>
            </div>

            <div className="divide-y divide-[#263039] bg-[#0E1318]">
              {slots.map((slot, idx) => {
                const isSelectedSlot = idx === activeSlotIndex;
                const player = slot.player;

                return (
                  <div
                    key={slot.slotNumber}
                    data-testid={`retention-slot-${slot.slotNumber}`}
                    onClick={() => setActiveSlotIndex(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveSlotIndex(idx);
                      }
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 transition-colors ${
                      isSelectedSlot ? 'bg-[#22D36B]/[0.08]' : 'hover:bg-[#111820]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <span className="font-extrabold text-[#9DA8B3]">
                          SLOT {slot.slotNumber}
                        </span>
                        <span className="font-extrabold text-[#F5B942] tabular-nums">
                          ₹{slot.costCr} Cr
                        </span>
                        {isSelectedSlot && (
                          <span className="rounded-[2px] border border-[#22D36B]/50 bg-[#0A2014] px-1 font-bold text-[#22D36B]">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      {player ? (
                        <div
                          className={`mt-0.5 ${
                            recentlyRetainedId === player.playerId ? 'ip-chip-pop' : ''
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-extrabold text-[#F5F2EA]">
                              {player.playerName}
                            </span>
                            <span className="shrink-0 rounded-[2px] border border-[#22D36B] bg-[#0A2014] px-1 py-[1px] font-mono text-[8.5px] font-extrabold text-[#22D36B]">
                              RET
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-[#9DA8B3] tabular-nums">
                            {player.franchise} {player.season} · OVR {player.overallRating}
                            {player.isOverseas ? ' · OS' : ' · IND'}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-0.5 text-xs text-[#667380]">
                          Tap player on left to retain
                        </div>
                      )}
                    </div>

                    {player && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearRetentionSlot(idx);
                          setActiveSlotIndex(idx);
                        }}
                        aria-label={`Remove ${player.playerName}`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border border-[#263039] text-[#9DA8B3] hover:border-[#E44949] hover:text-[#E44949]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#263039] bg-[#111820] p-3.5">
              <dl className="space-y-1 font-mono text-xs tabular-nums">
                <div className="flex justify-between">
                  <dt className="text-[#9DA8B3]">Retention Spend</dt>
                  <dd data-testid="summary-retention-spend" className="font-bold text-[#F5B942]">
                    <AnimatedNumber
                      value={summary.retentionSpendCr}
                      enabled={animPrefs.isFull}
                      format={(v) => formatCr(Math.max(0, v))}
                    />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#9DA8B3]">Purse After Lock</dt>
                  <dd className="font-extrabold text-[#F5F2EA]">
                    <AnimatedNumber
                      value={summary.remainingPurseCr}
                      enabled={animPrefs.isFull}
                      format={(v) => formatCr(Math.max(0, v))}
                    />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#9DA8B3]">Overseas Used</dt>
                  <dd data-testid="summary-overseas-count" className="font-bold text-[#22D36B]">
                    {summary.overseasCount}/{summary.overseasLimit}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                disabled={!summary.canLockAndStart}
                onClick={onLockRetentions}
                data-testid="lock-retentions-btn"
                className={`mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[2px] px-4 py-2 font-display text-lg font-extrabold tracking-wider uppercase transition-colors ${
                  summary.canLockAndStart
                    ? 'border border-[#22D36B] bg-[#22D36B] text-[#06110A] hover:bg-[#3CE282]'
                    : 'cursor-not-allowed border border-[#263039] bg-[#0E1318] text-[#667380]'
                }`}
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>LOCK RETENTIONS</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
