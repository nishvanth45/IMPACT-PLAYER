import {
  BarChart3,
  Calendar,
  Disc3,
  Home,
  Table2,
  Trophy,
  Users,
} from 'lucide-react';
import type { ScreenTab } from '../../types/game';

export const DESKTOP_NAV_ITEMS: Array<{
  id: ScreenTab;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'HOME', label: 'HOME', icon: Home },
  { id: 'DRAFT', label: 'DRAFT', icon: Disc3 },
  { id: 'SQUAD', label: 'SQUAD', icon: Users },
  { id: 'FIXTURES', label: 'FIXTURES', icon: Calendar },
  { id: 'STANDINGS', label: 'STANDINGS', icon: Table2 },
  { id: 'STATS', label: 'STATS', icon: BarChart3 },
];

const MOBILE_NAV_ITEMS: Array<{
  id: 'HOME' | 'DRAFT' | 'SQUAD' | 'SEASON' | 'STATS';
  targetTab: ScreenTab;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'HOME', targetTab: 'HOME', label: 'HOME', icon: Home },
  { id: 'DRAFT', targetTab: 'DRAFT', label: 'DRAFT', icon: Disc3 },
  { id: 'SQUAD', targetTab: 'SQUAD', label: 'SQUAD', icon: Users },
  { id: 'SEASON', targetTab: 'FIXTURES', label: 'SEASON', icon: Trophy },
  { id: 'STATS', targetTab: 'STATS', label: 'STATS', icon: BarChart3 },
];

interface GameNavProps {
  activeTab: ScreenTab;
  squadCount: number;
  squadLimit: number;
  onNavigate: (tab: ScreenTab) => void;
  variant: 'desktop' | 'mobile';
}

export function GameNav({
  activeTab,
  squadCount,
  squadLimit,
  onNavigate,
  variant,
}: GameNavProps) {
  if (variant === 'desktop') {
    return (
      <nav
        className="hidden items-center gap-0.5 lg:flex"
        aria-label="Primary"
      >
        {DESKTOP_NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`nav-tab-${item.id}`}
              onClick={() => onNavigate(item.id)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-[2px] border px-2.5 font-mono text-[11px] font-bold tracking-wider uppercase whitespace-nowrap transition-colors ${
                active
                  ? 'border-[#22D36B]/55 bg-[#0A2014] text-[#22D36B]'
                  : 'border-transparent text-[#9DA8B3] hover:border-[#263039] hover:bg-[#111820] hover:text-[#F5F2EA]'
              }`}
            >
              <span>{item.label}</span>
              {item.id === 'SQUAD' && (
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    active ? 'text-[#22D36B]' : 'text-[#667380]'
                  }`}
                >
                  {squadCount}/{squadLimit}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 grid h-14 grid-cols-5 border-t border-[#263039] bg-[#0E1318] md:hidden"
      aria-label="Mobile Navigation"
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const active =
          item.id === 'SEASON'
            ? activeTab === 'FIXTURES' || activeTab === 'STANDINGS'
            : activeTab === item.targetTab;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`mobile-nav-tab-${item.id}`}
            onClick={() => onNavigate(item.targetTab)}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 border-t-2 px-1 transition-colors ${
              active
                ? 'border-[#22D36B] bg-[#111820] text-[#22D36B]'
                : 'border-transparent text-[#9DA8B3] hover:text-[#F5F2EA]'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="font-mono text-[9.5px] font-bold tracking-wider uppercase leading-none">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
