import { useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Lock,
  Play,
  RotateCcw,
  Settings,
  Trophy,
} from 'lucide-react';
import type { CareerStats, CustomFranchise, DraftSettings } from '../types/game';

interface HomeScreenProps {
  settings: DraftSettings;
  customFranchise?: CustomFranchise | null;
  career: CareerStats;
  hasActiveDraft: boolean;
  hasActiveSeason: boolean;
  draftedCount: number;
  onStartNewDraft: () => void;
  onResumeDraft: () => void;
  onOpenSeason: () => void;
  onOpenSettings: () => void;
}

export function HomeScreen({
  settings,
  customFranchise,
  career,
  hasActiveDraft,
  hasActiveSeason,
  draftedCount,
  onStartNewDraft,
  onResumeDraft,
  onOpenSeason,
  onOpenSettings,
}: HomeScreenProps) {
  const [openSection, setOpenSection] = useState<'RULES' | 'HOW_TO_PLAY' | 'ACHIEVEMENTS' | null>(null);
  const unlockedCount = career.achievements.filter((a) => a.unlocked).length;
  const activeFranchiseName = customFranchise?.name || settings.franchiseName || 'Mumbai Warriors';
  const activeFranchiseCode = customFranchise?.code || 'NEW';
  const primaryColor = customFranchise?.primaryColor || '#D94E28';
  const secondaryColor = customFranchise?.secondaryColor || '#F59E0B';

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-5 pb-24 md:py-8 md:pb-12">
      {/* Main Franchise Manager Header Panel */}
      <div className="border-2 border-[#141619] bg-[#FAF8F3] shadow-[4px_4px_0px_#141619]">
        {/* Top Masthead */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#141619] bg-[#0D1B2A] px-4 py-3.5 text-white sm:px-6"
          style={{ borderTopWidth: '5px', borderTopColor: primaryColor }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[3px] border-2 font-mono text-sm font-extrabold tracking-widest text-white"
              style={{ backgroundColor: primaryColor, borderColor: secondaryColor }}
            >
              {activeFranchiseCode}
            </div>
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.18em] text-[#F59E0B] uppercase">
                <span>IMPACT PLAYER · FRANCHISE MANAGER</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-300">DRAFT. DECIDE. DOMINATE.</span>
              </div>
              <h1 className="mt-0.5 font-display text-3xl font-extrabold tracking-wide text-white uppercase sm:text-4xl">
                {customFranchise ? activeFranchiseName : 'EXPAND THE LEAGUE'}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[3px] border border-white/25 bg-white/10 px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-white/20"
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Edit Rules &amp; Settings</span>
          </button>
        </div>

        {/* Horizontal 6-Column Settings Summary */}
        <dl
          data-testid="home-settings-summary"
          className="grid grid-cols-2 divide-x divide-y divide-[#141619]/15 border-b border-[#141619]/20 bg-white sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0"
        >
          <div className="px-3.5 py-2.5">
            <dt className="font-mono text-[10px] font-bold tracking-wider text-[#4A4E54] uppercase">
              FRANCHISE
            </dt>
            <dd className="mt-0.5 truncate font-display text-base font-extrabold tracking-wide text-[#141619] uppercase">
              {customFranchise ? customFranchise.name : '11TH EXPANSION'}
            </dd>
          </div>
          <div className="px-3.5 py-2.5">
            <dt className="font-mono text-[10px] font-bold tracking-wider text-[#4A4E54] uppercase">
              FORMAT
            </dt>
            <dd className="mt-0.5 font-display text-base font-extrabold tracking-wide text-[#141619] uppercase tabular-nums">
              {settings.squadSize}-MAN SQUAD
            </dd>
          </div>
          <div className="px-3.5 py-2.5">
            <dt className="font-mono text-[10px] font-bold tracking-wider text-[#4A4E54] uppercase">
              ROSTER
            </dt>
            <dd className="mt-0.5 font-display text-base font-extrabold tracking-wide text-[#141619] uppercase">
              HISTORICAL IPL
            </dd>
          </div>
          <div className="px-3.5 py-2.5">
            <dt className="font-mono text-[10px] font-bold tracking-wider text-[#4A4E54] uppercase">
              DRAFT
            </dt>
            <dd className="mt-0.5 font-display text-base font-extrabold tracking-wide text-[#141619] uppercase">
              RETENTION + SPIN
            </dd>
          </div>
          <div className="px-3.5 py-2.5">
            <dt className="font-mono text-[10px] font-bold tracking-wider text-[#4A4E54] uppercase">
              PURSE
            </dt>
            <dd className="mt-0.5 font-display text-base font-extrabold tracking-wide text-[#D94E28] uppercase tabular-nums">
              ₹{settings.startingPurseCr} CR
            </dd>
          </div>
          <div className="px-3.5 py-2.5">
            <dt className="font-mono text-[10px] font-bold tracking-wider text-[#4A4E54] uppercase">
              SEASON
            </dt>
            <dd className="mt-0.5 font-display text-base font-extrabold tracking-wide text-[#141619] uppercase">
              20 MATCHES + PLAYOFFS
            </dd>
          </div>
        </dl>

        {/* Primary CTA Strip + Career Telemetry */}
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              data-start="true"
              onClick={onStartNewDraft}
              className="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-7 py-3 font-display text-xl font-extrabold tracking-wider text-white uppercase shadow-[3px_3px_0px_#141619] transition-all hover:bg-[#B83C1B] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none whitespace-nowrap"
            >
              <span>START NEW FRANCHISE</span>
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>

            {hasActiveDraft && (
              <button
                type="button"
                onClick={onResumeDraft}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#0D1B2A] px-5 py-3 font-display text-lg font-bold tracking-wider text-white uppercase transition-colors hover:bg-[#162B42] whitespace-nowrap"
              >
                <Play className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
                <span>
                  RESUME DRAFT ({draftedCount}/{settings.squadSize})
                </span>
              </button>
            )}

            {hasActiveSeason && (
              <button
                type="button"
                onClick={onOpenSeason}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#157F3D] px-5 py-3 font-display text-lg font-bold tracking-wider text-white uppercase transition-colors hover:bg-[#116832] whitespace-nowrap"
              >
                <Trophy className="h-4 w-4" aria-hidden="true" />
                <span>OPEN SEASON</span>
              </button>
            )}
          </div>

          {/* Career Stats 4-column Strip */}
          <dl className="grid grid-cols-2 divide-x divide-y divide-[#141619]/15 border border-[#141619] bg-white sm:grid-cols-4 sm:divide-y-0">
            <div className="px-3 py-2.5 text-center">
              <dt className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                Seasons Played
              </dt>
              <dd
                data-testid="career-seasons-played"
                className="mt-0.5 font-mono text-lg font-extrabold text-[#141619] tabular-nums"
              >
                {career.seasonsPlayed}
              </dd>
            </div>
            <div className="px-3 py-2.5 text-center">
              <dt className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                Titles Won
              </dt>
              <dd
                data-testid="career-titles-won"
                className="mt-0.5 font-mono text-lg font-extrabold text-[#157F3D] tabular-nums"
              >
                {career.titlesWon}
              </dd>
            </div>
            <div className="px-3 py-2.5 text-center">
              <dt className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                Best Finish
              </dt>
              <dd
                data-testid="career-best-finish"
                className="mt-0.5 truncate font-mono text-sm font-extrabold text-[#B45309] tabular-nums"
              >
                {career.bestFinish}
              </dd>
            </div>
            <div className="px-3 py-2.5 text-center">
              <dt className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                Achievements
              </dt>
              <dd
                data-testid="career-achievements-count"
                className="mt-0.5 font-mono text-lg font-extrabold text-[#6D28D9] tabular-nums"
              >
                {unlockedCount}/{career.achievements.length}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Expandable Compact Accordion Sections: Rules, How to Play, Achievements */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Rules */}
        <div className="border border-[#141619] bg-[#FAF8F3]">
          <button
            type="button"
            onClick={() => setOpenSection((s) => (s === 'RULES' ? null : 'RULES'))}
            aria-expanded={openSection === 'RULES'}
            className="flex min-h-[46px] w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[#EAE3D5]/60"
          >
            <span className="flex items-center gap-2 font-display text-lg font-extrabold tracking-wide text-[#141619] uppercase">
              <BookOpen className="h-4 w-4 text-[#D94E28]" aria-hidden="true" />
              <span>Rules</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-[#4A4E54] transition-transform ${
                openSection === 'RULES' ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
          {openSection === 'RULES' && (
            <ul className="space-y-1.5 border-t border-[#141619]/15 bg-white px-4 py-3 text-xs leading-relaxed text-[#2D3138]">
              <li>
                <strong>Purse &amp; Squad:</strong> ₹{settings.startingPurseCr} Cr total purse to
                build a {settings.squadSize}-player squad (max {settings.overseasSquadLimit}{' '}
                overseas).
              </li>
              <li>
                <strong>Retentions:</strong> Lock 0–4 players before spinning (₹18 / ₹15 / ₹12 / ₹10
                Cr fixed slots).
              </li>
              <li>
                <strong>Playing XI:</strong> 11 starters with max {settings.playingXIOverseasLimit}{' '}
                overseas, ≥1 Wicketkeeper, Captain &amp; batting order.
              </li>
              <li>
                <strong>Impact Bench:</strong> Remaining 4 squad players sit on the Impact Bench. 1
                tactical swap allowed mid-match (including a 5th overseas Impact Player).
              </li>
            </ul>
          )}
        </div>

        {/* How to Play */}
        <div className="border border-[#141619] bg-[#FAF8F3]">
          <button
            type="button"
            onClick={() => setOpenSection((s) => (s === 'HOW_TO_PLAY' ? null : 'HOW_TO_PLAY'))}
            aria-expanded={openSection === 'HOW_TO_PLAY'}
            className="flex min-h-[46px] w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[#EAE3D5]/60"
          >
            <span className="flex items-center gap-2 font-display text-lg font-extrabold tracking-wide text-[#141619] uppercase">
              <RotateCcw className="h-4 w-4 text-[#157F3D]" aria-hidden="true" />
              <span>How to Play</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-[#4A4E54] transition-transform ${
                openSection === 'HOW_TO_PLAY' ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
          {openSection === 'HOW_TO_PLAY' && (
            <ol className="list-decimal space-y-1.5 border-t border-[#141619]/15 bg-white py-3 pl-8 pr-4 text-xs leading-relaxed text-[#2D3138]">
              <li>Create your 11th IPL Franchise (Name, 3-letter Code, City, Ground &amp; Colors).</li>
              <li>Choose 0–4 Retentions ({settings.seasonStart}–{settings.seasonEnd}) and spin the Auction Room to finish your 15-player squad.</li>
              <li>Set your Playing XI on the pitch, assign Captain &amp; Keeper, and confirm your 4-man Impact Bench.</li>
              <li>Play or Quick Sim the 11-team, 20-match season (10 Home / 10 Away), chase the 20-0 Challenge, and lift the Trophy.</li>
            </ol>
          )}
        </div>

        {/* Achievements */}
        <div className="border border-[#141619] bg-[#FAF8F3]">
          <button
            type="button"
            onClick={() => setOpenSection((s) => (s === 'ACHIEVEMENTS' ? null : 'ACHIEVEMENTS'))}
            aria-expanded={openSection === 'ACHIEVEMENTS'}
            className="flex min-h-[46px] w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[#EAE3D5]/60"
          >
            <span className="flex items-center gap-2 font-display text-lg font-extrabold tracking-wide text-[#141619] uppercase">
              <Award className="h-4 w-4 text-[#6D28D9]" aria-hidden="true" />
              <span>
                Achievements ({unlockedCount}/{career.achievements.length})
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-[#4A4E54] transition-transform ${
                openSection === 'ACHIEVEMENTS' ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
          {openSection === 'ACHIEVEMENTS' && (
            <ul className="divide-y divide-[#141619]/10 border-t border-[#141619]/15 bg-white">
              {career.achievements.map((ach) => (
                <li key={ach.id} className="flex items-start gap-2.5 px-3.5 py-2.5 text-xs">
                  {ach.unlocked ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#157F3D]" aria-hidden="true" />
                  ) : (
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8A8F98]" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div
                      className={`font-bold ${
                        ach.unlocked ? 'text-[#141619]' : 'text-[#6A6E75]'
                      }`}
                    >
                      {ach.title}
                    </div>
                    <div className="text-[11px] text-[#4A4E54]">{ach.description}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
