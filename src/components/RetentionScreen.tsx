import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Info,
  Lock,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { FRANCHISES } from '../data/franchises';
import type { PlayerRepository } from '../data/playerRepository';
import { formatCr } from '../game/draftEngine';
import {
  RETENTION_SLOT_COSTS,
  canRetainPlayerInSlot,
  getPlayerImpactScore,
  getRetentionSummary,
} from '../game/retentionEngine';
import type {
  DraftState,
  PlayerRole,
  PlayerSeasonRecord,
} from '../types/game';
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

interface UniquePlayerGroup {
  playerId: string;
  playerName: string;
  role: PlayerRole;
  bowlingStyle: string;
  isOverseas: boolean | null;
  bestOvr: number;
  bestImp: number;
  seasons: PlayerSeasonRecord[];
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
  const [selectedUniqueId, setSelectedUniqueId] = useState<string | null>(null);

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

  const allRecords = useMemo(() => repository.getAllPlayerSeasonRecords(), [repository]);

  // Group records by unique player first (filtered by season bounds, role, origin, search)
  const uniquePlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const groups = new Map<string, UniquePlayerGroup>();

    for (const rec of allRecords) {
      if (
        rec.season < state.settings.seasonStart ||
        rec.season > state.settings.seasonEnd
      ) {
        continue;
      }
      if (roleFilter !== 'ALL' && rec.role !== roleFilter) continue;
      if (originFilter === 'INDIAN' && rec.isOverseas !== false) continue;
      if (originFilter === 'OVERSEAS' && rec.isOverseas !== true) continue;

      const key = rec.playerId;
      const name = rec.name || rec.playerName;
      if (q) {
        const franchiseMeta = FRANCHISES[rec.franchise];
        const matchesName = name.toLowerCase().includes(q);
        const matchesTeam =
          rec.franchise.toLowerCase().includes(q) ||
          franchiseMeta.name.toLowerCase().includes(q);
        const matchesSeason = String(rec.season).includes(q);
        if (!matchesName && !matchesTeam && !matchesSeason) continue;
      }

      const existing = groups.get(key);
      const imp = getPlayerImpactScore(rec);
      if (!existing) {
        groups.set(key, {
          playerId: key,
          playerName: name,
          role: rec.role,
          bowlingStyle: rec.bowlingStyle,
          isOverseas: rec.isOverseas,
          bestOvr: rec.overallRating,
          bestImp: imp,
          seasons: [rec],
        });
      } else {
        existing.seasons.push(rec);
        if (rec.overallRating > existing.bestOvr) {
          existing.bestOvr = rec.overallRating;
          existing.role = rec.role;
          existing.bowlingStyle = rec.bowlingStyle;
        }
        if (imp > existing.bestImp) existing.bestImp = imp;
      }
    }

    const list = Array.from(groups.values());
    for (const g of list) {
      g.seasons.sort((a, b) => b.season - a.season || b.overallRating - a.overallRating);
    }
    list.sort((a, b) => b.bestOvr - a.bestOvr || b.bestImp - a.bestImp || a.playerName.localeCompare(b.playerName));
    return list;
  }, [allRecords, state.settings.seasonStart, state.settings.seasonEnd, roleFilter, originFilter, searchQuery]);

  // Keep a valid selected player in sync when results change
  const activeUniquePlayer = useMemo(() => {
    if (uniquePlayers.length === 0) return null;
    if (selectedUniqueId) {
      const found = uniquePlayers.find((u) => u.playerId === selectedUniqueId);
      if (found) return found;
    }
    return uniquePlayers[0];
  }, [uniquePlayers, selectedUniqueId]);

  const activeSlot = slots[activeSlotIndex] ?? null;

  const handleAssign = (player: PlayerSeasonRecord) => {
    if (!activeSlot) return;
    onAssignRetention(player, activeSlotIndex);
    const nextEmptyIndex = slots.findIndex(
      (s, idx) => idx !== activeSlotIndex && s.player === null
    );
    if (nextEmptyIndex >= 0) {
      setActiveSlotIndex(nextEmptyIndex);
    }
  };

  return (
    <div data-testid="retention-screen" className="mt-3 space-y-3">
      {/* Step 1: Retention Count Prompt */}
      <div className="border-2 border-[#141619] bg-[#FAF8F3] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest text-[#D94E28] uppercase">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Pre-Auction Retention Phase</span>
            </div>
            <h1 className="mt-0.5 font-display text-2xl font-extrabold tracking-wide text-[#141619] uppercase sm:text-3xl">
              HOW MANY PLAYERS DO YOU WANT TO RETAIN?
            </h1>
            <p className="mt-0.5 text-xs text-[#4A4E54]">
              Lock 0–4 historical player-seasons at fixed prices before Spin Draft. Counts toward{' '}
              {state.settings.squadSize}-man squad and max {state.settings.overseasSquadLimit}{' '}
              overseas.
            </p>
          </div>

          <div className="shrink-0 border border-[#141619] bg-[#0D1B2A] px-3 py-1.5 text-white">
            <div className="font-mono text-[9.5px] font-bold tracking-wider text-slate-300 uppercase">
              Fixed Retention Slabs
            </div>
            <div className="font-mono text-xs font-bold text-[#F59E0B] tabular-nums">
              R1 ₹18 · R2 ₹15 · R3 ₹12 · R4 ₹10 Cr
            </div>
          </div>
        </div>

        <div
          className="mt-3 grid grid-cols-5 gap-2"
          role="group"
          aria-label="Number of players to retain"
        >
          {([0, 1, 2, 3, 4] as const).map((count) => {
            const active = targetCount === count;
            const totalCost = RETENTION_SLOT_COSTS.slice(0, count).reduce((a, b) => a + b, 0);
            const remainingCr = state.settings.startingPurseCr - totalCost;
            const toDraft = Math.max(0, state.settings.squadSize - count);

            return (
              <button
                key={count}
                type="button"
                data-testid={`retention-count-${count}`}
                aria-pressed={active}
                onClick={() => onSetRetentionCount(count)}
                className={`flex min-h-[58px] flex-col items-center justify-center rounded-[3px] border-2 px-2 py-1.5 text-center transition-colors ${
                  active
                    ? 'border-[#141619] bg-[#D94E28] text-white shadow-[2px_2px_0px_#141619]'
                    : 'border-[#141619]/35 bg-white text-[#141619] hover:border-[#141619]'
                }`}
              >
                <span className="font-display text-2xl font-extrabold leading-none tabular-nums">
                  {count}
                </span>
                <span
                  className={`mt-0.5 font-mono text-[10px] font-bold tabular-nums ${
                    active ? 'text-white' : 'text-[#B45309]'
                  }`}
                >
                  ₹{totalCost} Cr
                </span>
                <span
                  className={`hidden font-mono text-[9.5px] tabular-nums sm:block ${
                    active ? 'text-white/90' : 'text-[#4A4E54]'
                  }`}
                >
                  ₹{remainingCr} · {toDraft} Spin
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Retention Slots (when 1..4 chosen) */}
      {targetCount !== null && targetCount > 0 && (
        <div className="border border-[#141619] bg-[#FAF8F3] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold tracking-wide text-[#141619] uppercase">
              Retention Slots ({summary.retainedCount}/{targetCount} Filled)
            </h2>
            <span className="font-mono text-[11px] text-[#4A4E54]">
              Select a slot, search a player below, then pick their historical season.
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                  aria-label={`Retention Slot ${slot.slotNumber}, ₹${slot.costCr} Cr`}
                  className={`flex min-h-[86px] cursor-pointer flex-col justify-between rounded-[3px] border-2 p-2.5 text-left transition-colors ${
                    isSelectedSlot
                      ? 'border-[#D94E28] bg-white shadow-[2px_2px_0px_#D94E28]'
                      : player
                        ? 'border-[#141619] bg-white'
                        : 'border-dashed border-[#141619]/35 bg-[#F5F1E8] hover:border-[#141619]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-[#4A4E54]">
                        SLOT {slot.slotNumber}
                      </span>
                      {player && (
                        <span className="rounded-[2px] bg-[#6D28D9] px-1 py-0.2 font-mono text-[9px] font-extrabold text-white">
                          RET
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs font-extrabold text-[#B45309] tabular-nums">
                      ₹{slot.costCr} Cr
                    </span>
                  </div>

                  {player ? (
                    <div className="mt-1.5 flex items-end justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-[#141619]">
                          {player.playerName}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-semibold text-[#4A4E54] tabular-nums">
                          <span>
                            {player.franchise} • {player.season}
                          </span>
                          <span>·</span>
                          <span className="font-bold text-[#141619]">OVR {player.overallRating}</span>
                          {player.isOverseas && (
                            <span className="rounded-[2px] bg-[#FEF3C7] px-1 text-[#B45309]">
                              OS
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearRetentionSlot(idx);
                          setActiveSlotIndex(idx);
                        }}
                        aria-label={`Remove ${player.playerName} from Retention Slot ${slot.slotNumber}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border border-[#141619]/25 bg-[#FAF8F3] text-[#4A4E54] hover:border-[#D94E28] hover:text-[#D94E28]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-[#4A4E54]">
                        {isSelectedSlot ? 'Active slot...' : 'Empty — click to target'}
                      </span>
                      {isSelectedSlot && (
                        <span className="rounded-[2px] bg-[#D94E28] px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-white">
                          ACTIVE
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RETENTION SUMMARY & LOCK BUTTON */}
      {targetCount !== null && (
        <div
          data-testid="retention-summary"
          className="border-2 border-[#141619] bg-[#0D1B2A] p-4 text-white"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
                <h2 className="font-display text-lg font-extrabold tracking-wider text-white uppercase">
                  RETENTION SUMMARY
                </h2>
              </div>

              <dl className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="border border-white/15 bg-[#132338] px-2.5 py-1.5">
                  <dt className="font-mono text-[10px] text-slate-300 uppercase">Retained</dt>
                  <dd
                    data-testid="summary-retained-count"
                    className="font-mono text-sm font-bold text-white tabular-nums"
                  >
                    {summary.retainedCount}
                  </dd>
                </div>
                <div className="border border-white/15 bg-[#132338] px-2.5 py-1.5">
                  <dt className="font-mono text-[10px] text-slate-300 uppercase">Spend</dt>
                  <dd
                    data-testid="summary-retention-spend"
                    className="font-mono text-sm font-bold text-[#F59E0B] tabular-nums"
                  >
                    {formatCr(summary.retentionSpendCr)}
                  </dd>
                </div>
                <div className="border border-white/15 bg-[#132338] px-2.5 py-1.5">
                  <dt className="font-mono text-[10px] text-slate-300 uppercase">Purse Left</dt>
                  <dd
                    data-testid="summary-remaining-purse"
                    className="font-mono text-sm font-bold text-white tabular-nums"
                  >
                    {formatCr(summary.remainingPurseCr)}
                  </dd>
                </div>
                <div className="border border-white/15 bg-[#132338] px-2.5 py-1.5">
                  <dt className="font-mono text-[10px] text-slate-300 uppercase">Squad</dt>
                  <dd
                    data-testid="summary-squad-count"
                    className="font-mono text-sm font-bold text-white tabular-nums"
                  >
                    {summary.squadCount}/{summary.squadSize}
                  </dd>
                </div>
                <div className="col-span-2 border border-white/15 bg-[#132338] px-2.5 py-1.5 sm:col-span-1">
                  <dt className="font-mono text-[10px] text-slate-300 uppercase">Overseas</dt>
                  <dd
                    data-testid="summary-overseas-count"
                    className="font-mono text-sm font-bold text-emerald-300 tabular-nums"
                  >
                    {summary.overseasCount}/{summary.overseasLimit}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex shrink-0 flex-col items-stretch lg:items-end">
              {!summary.allSlotsFilled && targetCount > 0 && (
                <p className="mb-1.5 font-mono text-[11px] font-semibold text-[#F59E0B]">
                  Fill all {targetCount} retention slot{targetCount > 1 ? 's' : ''} to lock.
                </p>
              )}
              <button
                type="button"
                disabled={!summary.canLockAndStart}
                onClick={onLockRetentions}
                data-testid="lock-retentions-btn"
                className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[3px] px-5 py-2.5 font-display text-lg font-extrabold tracking-wider uppercase transition-colors whitespace-nowrap ${
                  summary.canLockAndStart
                    ? 'bg-[#D94E28] text-white hover:bg-[#B83C1B]'
                    : 'cursor-not-allowed border border-white/15 bg-slate-800 text-slate-400'
                }`}
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>LOCK RETENTIONS &amp; START SPIN DRAFT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Unique Player Search -> Historical Seasons Table */}
      {targetCount !== null && targetCount > 0 && activeSlot && (
        <div className="border border-[#141619] bg-[#FAF8F3] p-3.5">
          {/* Search + Role/Origin Filter Bar */}
          <div className="flex flex-col gap-2 border-b border-[#141619]/15 pb-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[210px] flex-1 sm:max-w-[270px]">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4A4E54]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search unique player name..."
                  aria-label="Search retention players"
                  className="h-9 w-full rounded-[3px] border border-[#141619]/35 bg-white pl-8 pr-7 text-xs font-medium text-[#141619] placeholder:text-[#6A6E75] focus:border-[#D94E28] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear retention search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[#4A4E54] hover:text-[#141619]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div
                className="flex items-center gap-0.5 rounded-[3px] border border-[#141619]/30 bg-white p-0.5"
                role="group"
                aria-label="Filter retention by role"
              >
                {(['ALL', 'BAT', 'WK', 'AR', 'BOWL'] as RoleFilter[]).map((role) => {
                  const active = roleFilter === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleFilter(role)}
                      aria-pressed={active}
                      className={`min-h-[28px] rounded-[2px] px-2 py-0.5 font-mono text-[10.5px] font-bold transition-colors ${
                        active
                          ? 'bg-[#D94E28] text-white'
                          : 'text-[#141619] hover:bg-[#EAE3D5]'
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>

              <div
                className="flex items-center gap-0.5 rounded-[3px] border border-[#141619]/30 bg-white p-0.5"
                role="group"
                aria-label="Filter retention by nationality"
              >
                {(
                  [
                    { id: 'ALL', label: 'ALL' },
                    { id: 'INDIAN', label: 'IND' },
                    { id: 'OVERSEAS', label: 'OS' },
                  ] as const
                ).map((opt) => {
                  const active = originFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setOriginFilter(opt.id)}
                      aria-pressed={active}
                      className={`min-h-[28px] rounded-[2px] px-2 py-0.5 font-mono text-[10.5px] font-bold transition-colors ${
                        active
                          ? 'bg-[#0D1B2A] text-white'
                          : 'text-[#141619] hover:bg-[#EAE3D5]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="font-mono text-[11px] font-semibold text-[#4A4E54] tabular-nums">
              {uniquePlayers.length} unique players · Slot {activeSlot.slotNumber} (₹{activeSlot.costCr} Cr)
            </div>
          </div>

          {/* Two-Column Scorebook Layout: Left = Unique Players Directory, Right = Selected Player's Historical Seasons */}
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[0.9fr_1.35fr]">
            {/* Left: Unique Players List */}
            <div className="border border-[#141619] bg-white">
              <div className="flex items-center justify-between border-b border-[#141619] bg-[#EAE3D5] px-3 py-1.5 font-mono text-[10px] font-bold tracking-wider text-[#141619] uppercase">
                <span>1. Select Player</span>
                <span>Peak OVR</span>
              </div>

              <div className="max-h-[360px] divide-y divide-[#D6D0C4] overflow-y-auto">
                {uniquePlayers.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-[#4A4E54]">
                    No players match your current filters.
                  </div>
                ) : (
                  uniquePlayers.slice(0, 120).map((group) => {
                    const isSelected = activeUniquePlayer?.playerId === group.playerId;
                    return (
                      <button
                        key={group.playerId}
                        type="button"
                        data-testid={`retention-player-${group.playerId}`}
                        onClick={() => setSelectedUniqueId(group.playerId)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'bg-[#0D1B2A] text-white'
                            : 'bg-white text-[#141619] hover:bg-[#F5F1E8]'
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <RoleBadge role={group.role} bowlingStyle={group.bowlingStyle} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-bold">
                                {group.playerName}
                              </span>
                              <span
                                className={`shrink-0 rounded-[2px] px-1 py-0.2 font-mono text-[9px] font-bold ${
                                  group.isOverseas === true
                                    ? isSelected
                                      ? 'bg-amber-400/20 text-amber-300'
                                      : 'bg-[#FEF3C7] text-[#B45309]'
                                    : group.isOverseas === false
                                      ? isSelected
                                        ? 'bg-emerald-400/20 text-emerald-300'
                                        : 'bg-[#DCFCE7] text-[#157F3D]'
                                      : 'bg-stone-200 text-stone-700'
                                }`}
                              >
                                {group.isOverseas === true
                                  ? 'OS'
                                  : group.isOverseas === false
                                    ? 'IND'
                                    : 'UNK'}
                              </span>
                            </div>
                            <div
                              className={`font-mono text-[10px] ${
                                isSelected ? 'text-slate-300' : 'text-[#4A4E54]'
                              }`}
                            >
                              {group.seasons.length} season{group.seasons.length > 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 font-mono text-xs font-extrabold tabular-nums ${
                            isSelected ? 'text-[#F59E0B]' : 'text-[#141619]'
                          }`}
                        >
                          {group.bestOvr}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Selected Player's Historical Seasons Table */}
            <div className="border border-[#141619] bg-white">
              <div className="flex items-center justify-between border-b border-[#141619] bg-[#EAE3D5] px-3 py-1.5">
                <span className="font-mono text-[10px] font-bold tracking-wider text-[#141619] uppercase">
                  2. Historical Seasons{' '}
                  {activeUniquePlayer ? `— ${activeUniquePlayer.playerName}` : ''}
                </span>
                <span className="font-mono text-[10px] font-bold text-[#B45309]">
                  Slot Price: ₹{activeSlot.costCr} Cr
                </span>
              </div>

              {!activeUniquePlayer ? (
                <div className="px-4 py-10 text-center text-xs text-[#4A4E54]">
                  Select a player from the left directory to view their historical IPL seasons.
                </div>
              ) : (
                <div
                  data-testid="retention-player-list"
                  className="max-h-[360px] overflow-x-auto overflow-y-auto"
                >
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 border-b border-[#141619]/20 bg-[#FAF8F3] font-mono text-[10px] font-bold tracking-wider text-[#4A4E54] uppercase">
                      <tr>
                        <th className="px-2.5 py-2">ROLE</th>
                        <th className="px-2.5 py-2">PLAYER</th>
                        <th className="px-2 py-2 text-center">SEASON</th>
                        <th className="px-2 py-2">TEAM</th>
                        <th className="px-1.5 py-2 text-center">BAT</th>
                        <th className="px-1.5 py-2 text-center">BOWL</th>
                        <th className="px-1.5 py-2 text-center">IMP</th>
                        <th className="px-1.5 py-2 text-center">OVR</th>
                        <th className="px-2.5 py-2 text-right">RETAIN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D6D0C4]">
                      {activeUniquePlayer.seasons.map((player) => {
                        const check = canRetainPlayerInSlot(state, player, activeSlotIndex);
                        const isCurrentSlotPick =
                          activeSlot.player !== null &&
                          (activeSlot.player.id ?? activeSlot.player.playerId) ===
                            (player.id ?? player.playerId) &&
                          activeSlot.player.season === player.season &&
                          activeSlot.player.franchise === player.franchise;
                        const impScore = getPlayerImpactScore(player);
                        const disabled = !check.allowed || isCurrentSlotPick;
                        const buttonLabel = isCurrentSlotPick
                          ? 'SELECTED'
                          : check.allowed
                            ? 'RETAIN'
                            : check.label ?? 'LOCKED';

                        return (
                          <tr
                            key={`${player.franchise}-${player.season}-${player.playerId}`}
                            data-testid={`retention-row-${player.playerId}-${player.franchise}-${player.season}`}
                            className={`transition-colors ${
                              isCurrentSlotPick
                                ? 'bg-[#FEF3C7]/60'
                                : disabled
                                  ? 'bg-[#F5F1E8]/60 opacity-65'
                                  : 'hover:bg-[#FAF8F3]'
                            }`}
                          >
                            <td className="px-2.5 py-2">
                              <RoleBadge role={player.role} bowlingStyle={player.bowlingStyle} />
                            </td>
                            <td className="px-2.5 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#141619]">
                                  {player.playerName}
                                </span>
                                {onInspectPlayer && (
                                  <button
                                    type="button"
                                    onClick={() => onInspectPlayer(player)}
                                    aria-label={`Inspect ${player.playerName} (${player.season})`}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#141619]/25 text-[#4A4E54] hover:border-[#141619] hover:text-[#141619]"
                                  >
                                    <Info className="h-3 w-3" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center font-mono font-bold text-[#141619] tabular-nums">
                              {player.season}
                            </td>
                            <td className="px-2 py-2 font-mono font-bold text-[#4A4E54]">
                              {player.franchise}
                            </td>
                            <td className="px-1.5 py-2 text-center font-mono tabular-nums">
                              {player.battingRating}
                            </td>
                            <td className="px-1.5 py-2 text-center font-mono tabular-nums">
                              {player.bowlingRating}
                            </td>
                            <td className="px-1.5 py-2 text-center font-mono font-semibold text-[#6D28D9] tabular-nums">
                              {impScore}
                            </td>
                            <td className="px-1.5 py-2 text-center font-mono font-extrabold text-[#141619] tabular-nums">
                              {player.overallRating}
                            </td>
                            <td className="px-2.5 py-2 text-right">
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => handleAssign(player)}
                                aria-label={`Retain ${player.playerName} (${player.franchise} ${player.season}) for ₹${activeSlot.costCr} Cr`}
                                className={`inline-flex min-h-[30px] min-w-[78px] items-center justify-center rounded-[2px] px-2.5 py-1 font-mono text-[10.5px] font-bold tracking-wider uppercase transition-colors ${
                                  disabled
                                    ? 'cursor-not-allowed border border-[#141619]/20 bg-[#EAE3D5] text-[#6A6E75]'
                                    : 'bg-[#D94E28] text-white hover:bg-[#B83C1B]'
                                }`}
                              >
                                {buttonLabel}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
