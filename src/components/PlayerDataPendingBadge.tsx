import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import {
  formatCrUpper,
  getPlayerDataCompleteness,
  getPlayerDisplayPriceInfo,
} from '../game/draftEngine';
import type { PlayerSeasonRecord } from '../types/game';

interface PlayerDataPendingBadgeProps {
  player: PlayerSeasonRecord;
  compact?: boolean;
}

interface PopoverCoords {
  top: number;
  left: number;
  placeAbove: boolean;
}

const POPOVER_WIDTH = 264;
const POPOVER_EST_HEIGHT = 276;

export function PlayerDataPendingBadge({
  player,
  compact = false,
}: PlayerDataPendingBadgeProps) {
  const completeness = getPlayerDataCompleteness(player);
  const priceInfo = getPlayerDisplayPriceInfo(player);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  const isOpen = hovered || pinned;

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < POPOVER_EST_HEIGHT && rect.top > POPOVER_EST_HEIGHT;
    const rawLeft = rect.left;
    const maxLeft = Math.max(8, window.innerWidth - POPOVER_WIDTH - 12);
    const clampedLeft = Math.max(8, Math.min(rawLeft, maxLeft));

    setCoords({
      top: placeAbove ? rect.top - 6 : rect.bottom + 6,
      left: clampedLeft,
      placeAbove,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => updatePosition();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setHovered(false);
      }
    };
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setPinned(false);
        setHovered(false);
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  if (!completeness.hasPendingData) {
    return null;
  }

  const handleMouseEnter = () => {
    clearCloseTimer();
    updatePosition();
    setHovered(true);
  };

  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setHovered(false);
    }, 120);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    updatePosition();
    setPinned((prev) => !prev);
  };

  const displayName = player.name || player.playerName;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid={`data-pending-btn-${player.playerId}`}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Data pending info for ${displayName}`}
        title="Data pending — click or hover for breakdown"
        className={`inline-flex shrink-0 items-center justify-center rounded-[2px] border border-[#F5B942]/35 bg-[#201A0A] text-[#F5B942] transition-colors hover:border-[#F5B942] hover:bg-[#2B220C] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#F5B942] ${
          compact ? 'h-4 w-4' : 'h-4.5 w-4.5'
        }`}
      >
        <Info className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden="true" />
      </button>

      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={`${displayName} player data breakdown`}
            data-testid="player-data-popover"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: POPOVER_WIDTH,
              transform: coords.placeAbove ? 'translateY(-100%)' : undefined,
              zIndex: 60,
            }}
            className="rounded-[2px] border border-[#263039] bg-[#0E1318] p-3 text-left text-[#F5F2EA] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#263039] pb-1.5">
              <span className="font-mono text-[10px] font-extrabold tracking-widest text-[#F5F2EA] uppercase">
                PLAYER DATA
              </span>
              <span className="truncate font-mono text-[9.5px] font-semibold text-[#9DA8B3]">
                {player.franchise} {player.season}
              </span>
            </div>

            <ul className="mt-2 space-y-1 font-mono text-[10.5px]">
              {completeness.items.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    {item.available ? (
                      <span
                        className="inline-flex w-3 justify-center font-extrabold text-[#22D36B]"
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    ) : (
                      <span
                        className="inline-flex w-3 justify-center text-sm leading-none font-extrabold text-[#F5B942]"
                        aria-hidden="true"
                      >
                        •
                      </span>
                    )}
                    <span
                      className={
                        item.available
                          ? 'font-semibold text-[#F5F2EA]'
                          : 'font-medium text-[#9DA8B3]'
                      }
                    >
                      {item.label}
                    </span>
                  </span>
                  <span
                    className={`text-[9px] font-bold uppercase ${
                      item.available ? 'text-[#22D36B]' : 'text-[#F5B942]'
                    }`}
                  >
                    {item.available ? 'OK' : 'PENDING'}
                  </span>
                </li>
              ))}
            </ul>

            {(!completeness.hasRealContract || !completeness.hasRatings) && (
              <div className="mt-2 space-y-1 border-t border-[#263039] pt-1.5 font-mono text-[9.5px]">
                {!completeness.hasRealContract && priceInfo.amountCr !== null && (
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-[#22D36B]">
                      GAME VALUE {formatCrUpper(priceInfo.amountCr)}
                    </div>
                    <div className="font-bold text-[#F5B942]">REAL CONTRACT PENDING</div>
                  </div>
                )}
                {!completeness.hasRatings && (
                  <div className="font-bold text-[#F5B942]">RATING PENDING</div>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
