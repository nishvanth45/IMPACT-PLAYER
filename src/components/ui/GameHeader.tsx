import { LogOut, Settings, User } from 'lucide-react';
import { formatCr } from '../../game/draftEngine';
import type { CustomFranchise, ScreenTab } from '../../types/game';
import { AnimatedNumber } from '../MotionPrimitives';
import { DESKTOP_NAV_ITEMS, GameNav } from './GameNav';
import { TeamLogo } from './TeamLogo';

interface GameHeaderProps {
  activeTab: ScreenTab;
  squadCount: number;
  squadLimit: number;
  remainingPurseCr: number;
  seasonNumber?: number | null;
  customFranchise?: CustomFranchise | null;
  hideNavigation?: boolean;
  isGuestMode?: boolean;
  userDisplayName?: string | null;
  userPhotoUrl?: string | null;
  animateNumbers?: boolean;
  onNavigate: (tab: ScreenTab) => void;
  onOpenSettings: () => void;
  onSignOut?: () => void;
}

export function GameHeader({
  activeTab,
  squadCount,
  squadLimit,
  remainingPurseCr,
  seasonNumber,
  customFranchise,
  hideNavigation = false,
  isGuestMode = false,
  userDisplayName,
  userPhotoUrl,
  animateNumbers = true,
  onNavigate,
  onOpenSettings,
  onSignOut,
}: GameHeaderProps) {
  const firstName = (userDisplayName ?? '').trim().split(/\s+/)[0] || 'Owner';
  const initials =
    (userDisplayName ?? 'O')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'O';

  return (
    <header className="sticky top-0 z-30 border-b border-[#263039] bg-[#080B0D]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        {/* Left: IMPACT PLAYER + [TEAM CODE] [FRANCHISE NAME] */}
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('HOME')}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-left transition-opacity hover:opacity-85"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 bg-[#F05A32]"
              aria-hidden="true"
            />
            <span className="font-display text-xl font-extrabold tracking-wider text-[#F5F2EA] uppercase sm:text-2xl">
              IMPACT PLAYER
            </span>
          </button>

          {customFranchise && (
            <div className="hidden min-w-0 items-center gap-2 border-l border-[#263039] pl-2.5 sm:flex">
              <TeamLogo
                code={customFranchise.code}
                primaryColor={customFranchise.primaryColor}
                secondaryColor={customFranchise.secondaryColor}
                size="xs"
              />
              <span className="max-w-[130px] truncate font-display text-sm font-bold tracking-wide text-[#F5F2EA] uppercase xl:max-w-[180px]">
                {customFranchise.name}
              </span>
            </div>
          )}
        </div>

        {/* Center: Persistent Desktop Primary Navigation */}
        {!hideNavigation && (
          <GameNav
            activeTab={activeTab}
            squadCount={squadCount}
            squadLimit={squadLimit}
            onNavigate={onNavigate}
            variant="desktop"
          />
        )}

        {/* Right: PURSE · SQUAD · SETTINGS · PROFILE/GUEST · SIGN OUT */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!hideNavigation && (
            <div className="hidden items-center gap-2 border-r border-[#263039] pr-2.5 font-mono text-[11px] tabular-nums md:flex">
              {seasonNumber && (
                <>
                  <span className="font-bold text-[#9DA8B3] uppercase">S{seasonNumber}</span>
                  <span className="text-[#263039]" aria-hidden="true">
                    ·
                  </span>
                </>
              )}
              <span className="font-bold text-[#F5B942]">
                <AnimatedNumber
                  value={remainingPurseCr}
                  enabled={animateNumbers}
                  format={(v) => formatCr(Math.max(0, v)).toUpperCase()}
                />
              </span>
              <span className="text-[#263039]" aria-hidden="true">
                ·
              </span>
              <span className="font-semibold text-[#F5F2EA]">
                <AnimatedNumber
                  value={squadCount}
                  enabled={animateNumbers}
                  format={(v) => String(Math.round(v))}
                />
                /{squadLimit}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] border border-[#263039] bg-[#0E1318] text-[#9DA8B3] transition-colors hover:border-[#22D36B]/50 hover:bg-[#111820] hover:text-[#F5F2EA]"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>

          {isGuestMode ? (
            <div
              data-testid="header-guest-badge"
              className="inline-flex h-9 items-center gap-1.5 rounded-[2px] border border-[#22D36B]/40 bg-[#0A2014] px-2.5 font-mono text-[10.5px] font-extrabold tracking-wider text-[#22D36B] uppercase"
              title="Guest Career · Saved on this device"
            >
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>GUEST</span>
            </div>
          ) : (
            <div
              data-testid="header-profile-badge"
              className="hidden h-9 items-center gap-1.5 rounded-[2px] border border-[#263039] bg-[#0E1318] px-2 xl:flex"
              title={userDisplayName ?? 'Franchise Owner'}
            >
              {userPhotoUrl ? (
                <img
                  src={userPhotoUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-5 w-5 rounded-[2px] object-cover"
                />
              ) : (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-[2px] bg-[#22D36B] font-mono text-[10px] font-extrabold text-[#06110A]">
                  {initials}
                </span>
              )}
              <span className="max-w-[80px] truncate font-mono text-[11px] font-semibold text-[#F5F2EA]">
                {firstName}
              </span>
            </div>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              data-testid="sign-out-btn"
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[2px] border border-[#263039] bg-[#0E1318] px-2.5 font-mono text-[10.5px] font-bold text-[#9DA8B3] uppercase transition-colors hover:border-[#E44949]/60 hover:bg-[#231012] hover:text-[#FCA5A5] whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">SIGN OUT</span>
            </button>
          )}
        </div>
      </div>

      {/* Tablet Secondary Nav Strip (md to lg) */}
      {!hideNavigation && (
        <nav
          className="hidden border-t border-[#263039] bg-[#0E1318] md:block lg:hidden"
          aria-label="Primary Tablet"
        >
          <div className="mx-auto flex h-10 max-w-6xl items-center justify-between px-4">
            <div className="flex items-center gap-1">
              {DESKTOP_NAV_ITEMS.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-[2px] border px-2.5 font-mono text-[11px] font-bold tracking-wider uppercase whitespace-nowrap transition-colors ${
                      active
                        ? 'border-[#22D36B]/55 bg-[#0A2014] text-[#22D36B]'
                        : 'border-transparent text-[#9DA8B3] hover:bg-[#111820] hover:text-[#F5F2EA]'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
