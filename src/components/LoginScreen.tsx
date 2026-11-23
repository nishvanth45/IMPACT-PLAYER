import { AlertCircle, ArrowRight, Loader2, Plus, User } from 'lucide-react';
import { formatCr } from '../game/draftEngine';
import type { GuestCareerSummary } from '../game/sessionRouting';
import { TeamLogo } from './ui';

interface LoginScreenProps {
  isSigningIn: boolean;
  authError: string | null;
  guestCareerSummary: GuestCareerSummary | null;
  onSignInWithGoogle: () => void;
  onContinueAsGuest: () => void;
  onContinueCareer: () => void;
  onStartNewFranchise: () => void;
  onDismissError: () => void;
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.81-.07-1.6-.21-2.36H12v4.47h6.45a5.52 5.52 0 0 1-2.39 3.62v3.01h3.87c2.26-2.08 3.56-5.15 3.56-8.74z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4 3.1c.95-2.84 3.6-4.95 6.72-4.95z"
      />
    </svg>
  );
}

const COMPACT_FACTS = [
  { label: 'PURSE', value: '₹120 CR PURSE' },
  { label: 'ROSTER', value: '15 PLAYER SQUAD' },
  { label: 'LEAGUE', value: '10 IPL OPPONENTS' },
  { label: 'SCHEDULE', value: '20 LEAGUE MATCHES' },
];

export function LoginScreen({
  isSigningIn,
  authError,
  guestCareerSummary,
  onSignInWithGoogle,
  onContinueAsGuest,
  onContinueCareer,
  onStartNewFranchise,
  onDismissError,
}: LoginScreenProps) {
  return (
    <div
      data-testid="login-screen"
      className="flex min-h-screen flex-col justify-between bg-[#080B0D] text-[#F5F2EA]"
    >
      {/* Top Bar */}
      <header className="border-b border-[#263039] bg-[#080B0D]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5 whitespace-nowrap">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 bg-[#F05A32]"
              aria-hidden="true"
            />
            <span className="font-display text-xl font-extrabold tracking-wider text-[#F5F2EA] uppercase sm:text-2xl">
              IMPACT PLAYER
            </span>
          </div>
          <span className="font-mono text-[11px] font-medium tracking-wider text-[#9DA8B3] uppercase whitespace-nowrap">
            2008–2026 IPL ARCHIVE
          </span>
        </div>
      </header>

      {/* Main Entry Grid */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid w-full grid-cols-1 items-stretch gap-8 lg:grid-cols-[1.22fr_0.78fr] lg:gap-12">
          {/* LEFT SIDE */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="ip-fade-slide inline-flex items-center gap-2 font-mono text-xs font-bold tracking-[0.2em] text-[#F05A32] uppercase">
                <span className="inline-block h-1.5 w-4 bg-[#F05A32]" aria-hidden="true" />
                <span>IMPACT PLAYER</span>
              </div>

              <h1
                className="ip-fade-slide mt-4 font-display text-5xl font-extrabold leading-[0.94] tracking-tight text-[#F5F2EA] uppercase sm:text-6xl lg:text-[68px]"
                style={{ animationDelay: '55ms' }}
              >
                <span className="block">BUILD YOUR FRANCHISE.</span>
                <span className="mt-1 block text-[#22D36B]">RULE THE LEAGUE.</span>
              </h1>

              <div
                className="ip-fade-slide mt-6 max-w-md space-y-1 text-sm leading-relaxed text-[#9DA8B3] sm:text-base"
                style={{ animationDelay: '105ms' }}
              >
                <p>Create the 11th IPL franchise.</p>
                <p>Draft from IPL history.</p>
                <p>Build your XI.</p>
                <p>Master the Impact Player.</p>
                <p>Win the championship.</p>
              </div>
            </div>

            {/* 4 Compact Facts */}
            <dl
              className="ip-fade-slide mt-8 grid grid-cols-2 border border-[#263039] bg-[#0E1318] sm:grid-cols-4"
              style={{ animationDelay: '140ms' }}
            >
              {COMPACT_FACTS.map((fact, idx) => (
                <div
                  key={fact.value}
                  className={`px-3.5 py-3 ${
                    idx % 2 === 1 ? 'border-l border-[#263039]' : ''
                  } ${idx >= 2 ? 'border-t border-[#263039] sm:border-t-0' : ''} ${
                    idx === 2 ? 'sm:border-l sm:border-[#263039]' : ''
                  }`}
                >
                  <dt className="font-mono text-[10px] font-semibold tracking-widest text-[#9DA8B3] uppercase">
                    {fact.label}
                  </dt>
                  <dd className="mt-1 font-mono text-xs font-bold text-[#F5F2EA] tabular-nums whitespace-nowrap">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* RIGHT SIDE: FRANCHISE OWNER ACCESS */}
          <div
            className="ip-fade-slide flex flex-col justify-between border border-[#263039] bg-[#0E1318] p-6 sm:p-7"
            style={{ animationDelay: '110ms' }}
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#263039] pb-3.5">
                <h2 className="font-mono text-xs font-bold tracking-[0.18em] text-[#F5F2EA] uppercase">
                  FRANCHISE OWNER ACCESS
                </h2>
                <span className="font-mono text-[10px] font-semibold tracking-wider text-[#22D36B] uppercase">
                  11TH SLOT OPEN
                </span>
              </div>

              {authError && (
                <div
                  role="alert"
                  data-testid="login-error"
                  className="mt-4 flex items-start gap-2.5 border border-[#E44949]/60 bg-[#231012] p-3 text-xs text-[#FCA5A5]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E44949]" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-medium leading-snug">{authError}</p>
                    <button
                      type="button"
                      onClick={onDismissError}
                      className="mt-1 font-mono text-[10px] font-bold text-[#F5F2EA] uppercase underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Saved Local Guest Career Quick Resume */}
              {guestCareerSummary && (
                <div
                  data-testid="saved-guest-career-panel"
                  className="mt-5 border border-[#22D36B]/40 bg-[#0A1710] p-4"
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase">
                    <span className="font-bold tracking-wider text-[#22D36B]">GUEST CAREER</span>
                    <span className="text-[#9DA8B3]">Saved on this device</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2.5">
                    <TeamLogo
                      code={guestCareerSummary.franchiseCode}
                      primaryColor={guestCareerSummary.primaryColor}
                      secondaryColor={guestCareerSummary.secondaryColor}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-lg font-extrabold tracking-wide text-[#F5F2EA] uppercase leading-tight">
                        {guestCareerSummary.franchiseName}
                      </div>
                      <div className="font-mono text-[11px] text-[#9DA8B3] tabular-nums">
                        {guestCareerSummary.seasonNumber
                          ? `Season ${guestCareerSummary.seasonNumber}`
                          : 'Pre-Season'}{' '}
                        · {guestCareerSummary.squadCount}/{guestCareerSummary.squadLimit} Squad ·{' '}
                        {formatCr(guestCareerSummary.remainingPurseCr)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                    <button
                      type="button"
                      data-testid="continue-career-btn"
                      onClick={onContinueCareer}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-4 py-2 font-mono text-xs font-extrabold tracking-wider text-[#06110A] uppercase transition-colors hover:bg-[#3CE282] whitespace-nowrap"
                    >
                      <span>CONTINUE CAREER</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      data-testid="new-franchise-btn"
                      onClick={onStartNewFranchise}
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[2px] border border-[#263039] bg-[#111820] px-3.5 py-2 font-mono text-xs font-bold tracking-wider text-[#F5F2EA] uppercase transition-colors hover:border-[#22D36B]/50 hover:text-[#22D36B] whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>NEW FRANCHISE</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Auth Actions */}
              <div className="ip-fade-slide mt-5 space-y-2.5" style={{ animationDelay: '155ms' }}>
                <button
                  type="button"
                  data-testid="google-signin-btn"
                  disabled={isSigningIn}
                  onClick={onSignInWithGoogle}
                  className="ip-login-btn-glow inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-4 py-3 font-mono text-xs font-extrabold tracking-wider text-[#06110A] uppercase hover:bg-[#3CE282] disabled:cursor-wait disabled:opacity-70 whitespace-nowrap"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-[#06110A]" aria-hidden="true" />
                      <span>SIGNING IN...</span>
                    </>
                  ) : (
                    <>
                      <GoogleMark />
                      <span>CONTINUE WITH GOOGLE</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="guest-signin-btn"
                  disabled={isSigningIn}
                  onClick={onContinueAsGuest}
                  className="ip-login-btn-glow inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-[2px] border border-[#263039] bg-[#111820] px-4 py-3 font-mono text-xs font-extrabold tracking-wider text-[#F5F2EA] uppercase hover:text-[#22D36B] disabled:opacity-60 whitespace-nowrap"
                >
                  <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>CONTINUE AS GUEST</span>
                </button>

                {!guestCareerSummary && (
                  <button
                    type="button"
                    data-testid="new-franchise-btn"
                    disabled={isSigningIn}
                    onClick={onStartNewFranchise}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[2px] border border-[#263039] bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase transition-colors hover:border-[#22D36B]/50 hover:text-[#F5F2EA] whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#22D36B]" aria-hidden="true" />
                    <span>NEW FRANCHISE</span>
                  </button>
                )}
              </div>
            </div>

            {/* Footer Notes inside Access Panel */}
            <div className="mt-6 space-y-2 border-t border-[#263039] pt-4 font-mono text-[11px] text-[#9DA8B3]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#F5F2EA]">GOOGLE ACCOUNT</span>
                <span>Cloud sync across devices</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#F5F2EA]">GUEST CAREER</span>
                <span>Saved on this device · Link later</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#263039] bg-[#080B0D] py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 font-mono text-[10px] text-[#9DA8B3] sm:px-6">
          <span>IMPACT PLAYER · 11TH IPL FRANCHISE SIMULATOR</span>
          <span className="hidden sm:inline">RETENTION · SPIN DRAFT · PLAYING XI · IMPACT SUB</span>
        </div>
      </footer>
    </div>
  );
}
