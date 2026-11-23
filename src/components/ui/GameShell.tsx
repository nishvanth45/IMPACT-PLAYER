import type { ReactNode } from 'react';
import { CloudUpload, Loader2 } from 'lucide-react';
import type { CustomFranchise, ScreenTab } from '../../types/game';
import { GameHeader } from './GameHeader';
import { GameNav } from './GameNav';

export interface GameShellProps {
  activeTab: ScreenTab;
  squadCount: number;
  squadLimit: number;
  remainingPurseCr: number;
  seasonNumber?: number | null;
  customFranchise?: CustomFranchise | null;
  hideNavigation?: boolean;
  isGuestMode?: boolean;
  isLinkingGoogle?: boolean;
  linkNotice?: string | null;
  userDisplayName?: string | null;
  userPhotoUrl?: string | null;
  onNavigate: (tab: ScreenTab) => void;
  onOpenSettings: () => void;
  onLinkGoogleAccount?: () => void;
  onDismissLinkNotice?: () => void;
  onSignOut?: () => void;
  animateNumbers?: boolean;
  children: ReactNode;
}

export function GameShell({
  activeTab,
  squadCount,
  squadLimit,
  remainingPurseCr,
  seasonNumber,
  customFranchise,
  hideNavigation = false,
  isGuestMode = false,
  isLinkingGoogle = false,
  linkNotice,
  userDisplayName,
  userPhotoUrl,
  onNavigate,
  onOpenSettings,
  onLinkGoogleAccount,
  onDismissLinkNotice,
  onSignOut,
  animateNumbers = true,
  children,
}: GameShellProps) {
  return (
    <div
      data-testid="game-shell"
      className="min-h-screen bg-[#080B0D] text-[#F5F2EA]"
    >
      <GameHeader
        activeTab={activeTab}
        squadCount={squadCount}
        squadLimit={squadLimit}
        remainingPurseCr={remainingPurseCr}
        seasonNumber={seasonNumber}
        customFranchise={customFranchise}
        hideNavigation={hideNavigation}
        isGuestMode={isGuestMode}
        userDisplayName={userDisplayName}
        userPhotoUrl={userPhotoUrl}
        animateNumbers={animateNumbers}
        onNavigate={onNavigate}
        onOpenSettings={onOpenSettings}
        onSignOut={onSignOut}
      />

      {/* Non-sticky Guest Career Storage Strip */}
      {isGuestMode && (
        <div
          data-testid="guest-status-bar"
          className="border-b border-[#263039] bg-[#0E1318] text-[#F5F2EA]"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-1.5 sm:px-4">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="font-extrabold tracking-wider text-[#22D36B] uppercase">
                GUEST CAREER
              </span>
              <span className="text-[#263039]">·</span>
              <span className="text-[#9DA8B3]">Saved on this device</span>
            </div>
            {onLinkGoogleAccount && (
              <button
                type="button"
                data-testid="link-google-account-btn"
                disabled={isLinkingGoogle}
                onClick={onLinkGoogleAccount}
                className="inline-flex min-h-[28px] items-center gap-1.5 rounded-[2px] border border-[#263039] bg-[#111820] px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider text-[#F5F2EA] uppercase transition-colors hover:border-[#22D36B] hover:text-[#22D36B] disabled:opacity-60 whitespace-nowrap"
              >
                {isLinkingGoogle ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    <span>LINKING...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="h-3 w-3 text-[#22D36B]" aria-hidden="true" />
                    <span>LINK GOOGLE ACCOUNT</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Non-sticky Cloud Migration Confirmation Notice */}
      {linkNotice && (
        <div
          role="status"
          data-testid="cloud-link-notice"
          className="border-b border-[#22D36B]/35 bg-[#0A2014] text-[#22D36B]"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-1.5 font-mono text-[11px] sm:px-4">
            <span className="font-semibold">{linkNotice}</span>
            {onDismissLinkNotice && (
              <button
                type="button"
                onClick={onDismissLinkNotice}
                className="font-bold text-[#F5F2EA] uppercase underline"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      <main className="min-h-[calc(100vh-56px)] bg-[#080B0D] text-[#F5F2EA]">{children}</main>

      {!hideNavigation && (
        <GameNav
          activeTab={activeTab}
          squadCount={squadCount}
          squadLimit={squadLimit}
          onNavigate={onNavigate}
          variant="mobile"
        />
      )}
    </div>
  );
}
