import React, { useEffect, useRef, useState } from 'react';
import type { DraftSettings } from '../types/game';
import {
  resolveAnimationMode,
  type ResolvedAnimationPrefs,
} from '../game/animationEngine';

/**
 * Listens to OS `prefers-reduced-motion` and merges with app settings.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    setPrefersReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return prefersReduced;
}

export function useAnimationPreferences(
  settings: Pick<
    DraftSettings,
    'animationEnabled' | 'animationMode' | 'skipMatchAnimations'
  >
): ResolvedAnimationPrefs {
  const prefersReduced = usePrefersReducedMotion();
  return resolveAnimationMode(settings, prefersReduced);
}

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  enabled?: boolean;
  className?: string;
}

/**
 * Smooth ease-out cubic animated numeric readout for key game metrics only:
 * Purse, Squad count, Points, NRR, Runs, Wickets, Required runs.
 * Renders instantaneously when animations are OFF or REDUCED.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 260,
  enabled = true,
  className,
}) => {
  const [display, setDisplay] = useState<number>(value);
  const fromRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !Number.isFinite(value) || fromRef.current === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const startVal = fromRef.current;
    const delta = value - startVal;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startVal + delta * eased;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        fromRef.current = value;
        setDisplay(value);
        rafRef.current = null;
      }
    };

    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      fromRef.current = value;
    };
  }, [value, durationMs, enabled]);

  return <span className={className}>{format(display)}</span>;
};

interface FranchiseBadgeProps {
  code: string;
  primaryColor?: string;
  secondaryColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Sharp geometric franchise emblem used across Spin Draft reel, Live AI Draft
 * ticker, Toss coin/matchup, and Final header.
 */
export const FranchiseBadge: React.FC<FranchiseBadgeProps> = ({
  code,
  primaryColor = '#111820',
  secondaryColor = '#F5B942',
  size = 'md',
  className = '',
}) => {
  const dims =
    size === 'xs'
      ? 'w-5 h-5 text-[9px]'
      : size === 'sm'
      ? 'w-7 h-7 text-[10px]'
      : size === 'lg'
      ? 'w-12 h-12 text-base'
      : 'w-9 h-9 text-xs';

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-[2px] font-display font-bold uppercase tracking-wider text-white border relative overflow-hidden select-none ${dims} ${className}`}
      style={{
        backgroundColor: primaryColor,
        borderColor: secondaryColor,
      }}
    >
      <span
        className="absolute inset-x-0 bottom-0 h-[3px]"
        style={{ backgroundColor: secondaryColor }}
      />
      <span className="relative z-10 leading-none">{code.slice(0, 4)}</span>
    </span>
  );
};
