import type { ReactNode } from 'react';
import { Disc3, Home, Settings, Shield, Trophy, Users } from 'lucide-react';
import type { ScreenTab } from '../types/game';

interface AppShellProps {
  activeTab: ScreenTab;
  squadCount: number;
  squadLimit: number;
  onNavigate: (tab: ScreenTab) => void;
  onOpenSettings: () => void;
  children: ReactNode;
}

export function AppShell({
  activeTab,
  squadCount,
  squadLimit,
  onNavigate,
  onOpenSettings,
  children,
}: AppShellProps) {
  const navItems: Array<{ id: ScreenTab; label: string }> = [
    { id: 'HOME', label: 'HOME' },
    { id: 'DRAFT', label: 'DRAFT' },
    { id: 'SQUAD', label: `MY SQUAD (${squadCount}/${squadLimit})` },
    { id: 'PLAYING_XI', label: 'PLAYING XI' },
    { id: 'SEASON', label: 'SEASON' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F1E8] text-[#141619]">
      {/* Desktop & Mobile Top Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#141619] bg-[#FAF8F3]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <button
            type="button"
            onClick={() => onNavigate('HOME')}
            className="flex items-baseline gap-2.5 whitespace-nowrap shrink-0 text-left hover:opacity-80 transition-opacity"
          >
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] bg-[#D94E28]" aria-hidden="true" />
            <span className="font-display text-2xl font-extrabold tracking-wide text-[#141619] uppercase">
              IMPACT PLAYER
            </span>
            <span className="hidden lg:inline font-mono text-[10px] font-bold tracking-[0.16em] text-[#4A4E54] uppercase">
              DRAFT. DECIDE. DOMINATE.
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`min-h-[38px] rounded-[3px] px-3 py-1.5 font-display text-sm font-bold tracking-wider whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#D94E28] text-white'
                      : 'text-[#141619] hover:bg-[#EAE3D5]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Open settings"
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-[3px] border border-[#141619] bg-white px-3 py-1.5 text-xs font-bold tracking-wide text-[#141619] transition-colors hover:bg-[#141619] hover:text-white whitespace-nowrap shrink-0"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline uppercase">Settings</span>
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      {/* Mobile Bottom Thumb Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 grid h-16 grid-cols-5 border-t-2 border-[#141619] bg-[#FAF8F3] md:hidden"
        aria-label="Mobile Navigation"
      >
        <button
          type="button"
          onClick={() => onNavigate('HOME')}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'HOME'
              ? 'bg-[#D94E28] text-white'
              : 'text-[#4A4E54] hover:text-[#141619]'
          }`}
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          <span className="font-display text-[11px] font-bold tracking-wider uppercase">Home</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('DRAFT')}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'DRAFT'
              ? 'bg-[#D94E28] text-white'
              : 'text-[#4A4E54] hover:text-[#141619]'
          }`}
        >
          <Disc3 className="h-4 w-4" aria-hidden="true" />
          <span className="font-display text-[11px] font-bold tracking-wider uppercase">Draft</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('SQUAD')}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'SQUAD'
              ? 'bg-[#D94E28] text-white'
              : 'text-[#4A4E54] hover:text-[#141619]'
          }`}
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          <span className="font-display text-[11px] font-bold tracking-wider tabular-nums whitespace-nowrap uppercase">
            Squad ({squadCount}/{squadLimit})
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('PLAYING_XI')}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'PLAYING_XI'
              ? 'bg-[#D94E28] text-white'
              : 'text-[#4A4E54] hover:text-[#141619]'
          }`}
        >
          <Shield className="h-4 w-4" aria-hidden="true" />
          <span className="font-display text-[11px] font-bold tracking-wider whitespace-nowrap uppercase">
            XI
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('SEASON')}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'SEASON'
              ? 'bg-[#D94E28] text-white'
              : 'text-[#4A4E54] hover:text-[#141619]'
          }`}
        >
          <Trophy className="h-4 w-4" aria-hidden="true" />
          <span className="font-display text-[11px] font-bold tracking-wider whitespace-nowrap uppercase">
            Season
          </span>
        </button>
      </nav>
    </div>
  );
}
