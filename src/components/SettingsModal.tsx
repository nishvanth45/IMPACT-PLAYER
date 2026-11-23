import { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../game/draftEngine';
import type { AnimationMode, DraftSettings } from '../types/game';
import { GameButton } from './ui';

interface SettingsModalProps {
  settings: DraftSettings;
  onClose: () => void;
  onSave: (next: DraftSettings, resetDraft: boolean) => void;
}

export function SettingsModal({ settings, onClose, onSave }: SettingsModalProps) {
  const [draft, setDraft] = useState<DraftSettings>({ ...settings });

  const structuralChanged =
    draft.startingPurseCr !== settings.startingPurseCr ||
    draft.squadSize !== settings.squadSize ||
    draft.overseasSquadLimit !== settings.overseasSquadLimit ||
    draft.seasonStart !== settings.seasonStart ||
    draft.seasonEnd !== settings.seasonEnd;

  const handleReset = () => {
    setDraft({ ...DEFAULT_SETTINGS });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#080B0D]/80 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[2px] border border-[#263039] bg-[#0E1318] p-5 text-[#F5F2EA] shadow-2xl sm:rounded-[2px] sm:p-6">
        <div className="flex items-center justify-between border-b border-[#263039] pb-3">
          <div>
            <div className="font-mono text-[10px] font-bold tracking-widest text-[#22D36B] uppercase">
              Franchise Configuration
            </div>
            <h2
              id="settings-modal-title"
              className="font-display text-2xl font-extrabold tracking-wide text-[#F5F2EA] uppercase"
            >
              Draft &amp; Match Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[2px] border border-[#263039] bg-[#111820] text-[#9DA8B3] transition-colors hover:border-[#22D36B] hover:text-[#F5F2EA]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase">
              Franchise Name
            </span>
            <input
              type="text"
              maxLength={28}
              value={draft.franchiseName}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  franchiseName: e.target.value,
                }))
              }
              placeholder="Mumbai Warriors"
              className="mt-1 min-h-[42px] w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 py-2 font-display text-base font-bold tracking-wide text-[#F5F2EA] uppercase focus:border-[#22D36B] focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                Starting Purse (₹ Cr)
              </span>
              <input
                type="number"
                min={60}
                max={200}
                step={5}
                value={draft.startingPurseCr}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    startingPurseCr: Math.max(60, Math.min(200, Number(e.target.value) || 120)),
                  }))
                }
                className="mt-1 min-h-[42px] w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 py-2 font-mono text-sm font-semibold text-[#F5F2EA] tabular-nums focus:border-[#22D36B] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                Squad Size
              </span>
              <input
                type="number"
                min={11}
                max={18}
                value={draft.squadSize}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    squadSize: Math.max(11, Math.min(18, Number(e.target.value) || 15)),
                  }))
                }
                className="mt-1 min-h-[42px] w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 py-2 font-mono text-sm font-semibold text-[#F5F2EA] tabular-nums focus:border-[#22D36B] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                Overseas Squad Cap
              </span>
              <input
                type="number"
                min={2}
                max={8}
                value={draft.overseasSquadLimit}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    overseasSquadLimit: Math.max(2, Math.min(8, Number(e.target.value) || 6)),
                  }))
                }
                className="mt-1 min-h-[42px] w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 py-2 font-mono text-sm font-semibold text-[#F5F2EA] tabular-nums focus:border-[#22D36B] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                Playing XI OS Cap
              </span>
              <input
                type="number"
                min={2}
                max={6}
                value={draft.playingXIOverseasLimit}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    playingXIOverseasLimit: Math.max(2, Math.min(6, Number(e.target.value) || 4)),
                  }))
                }
                className="mt-1 min-h-[42px] w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 py-2 font-mono text-sm font-semibold text-[#F5F2EA] tabular-nums focus:border-[#22D36B] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                Season Start
              </span>
              <input
                type="number"
                min={2008}
                max={2026}
                value={draft.seasonStart}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    seasonStart: Math.max(2008, Math.min(2026, Number(e.target.value) || 2008)),
                  }))
                }
                className="mt-1 min-h-[42px] w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 py-2 font-mono text-sm font-semibold text-[#F5F2EA] tabular-nums focus:border-[#22D36B] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                Season End
              </span>
              <input
                type="number"
                min={2008}
                max={2026}
                value={draft.seasonEnd}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    seasonEnd: Math.max(2008, Math.min(2026, Number(e.target.value) || 2026)),
                  }))
                }
                className="mt-1 min-h-[42px] w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 py-2 font-mono text-sm font-semibold text-[#F5F2EA] tabular-nums focus:border-[#22D36B] focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                Difficulty
              </span>
              <select
                value={draft.difficulty}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    difficulty: e.target.value as DraftSettings['difficulty'],
                  }))
                }
                className="mt-1 min-h-[42px] w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 py-2 text-sm font-semibold text-[#F5F2EA] focus:border-[#22D36B] focus:outline-none"
              >
                <option value="Casual">Casual</option>
                <option value="Standard">Standard</option>
                <option value="Hard">Expert (Hard)</option>
              </select>
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                Sim Speed
              </span>
              <select
                value={draft.simSpeed}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    simSpeed: e.target.value as DraftSettings['simSpeed'],
                  }))
                }
                className="mt-1 min-h-[42px] w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 py-2 text-sm font-semibold text-[#F5F2EA] focus:border-[#22D36B] focus:outline-none"
              >
                <option value="Normal">Normal</option>
                <option value="Fast">Fast</option>
              </select>
            </label>
          </div>

          <div className="space-y-2 border-t border-[#263039] pt-3">
            <label className="flex min-h-[42px] cursor-pointer items-center justify-between rounded-[2px] border border-[#263039] bg-[#111820] px-3.5 py-2">
              <span className="text-sm font-semibold text-[#F5F2EA]">Sound Effects</span>
              <input
                type="checkbox"
                checked={draft.soundEnabled}
                onChange={(e) => setDraft((prev) => ({ ...prev, soundEnabled: e.target.checked }))}
                className="h-4 w-4 accent-[#22D36B]"
              />
            </label>

            <div className="rounded-[2px] border border-[#263039] bg-[#111820] px-3.5 py-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="block text-sm font-semibold text-[#F5F2EA]">Animations</span>
                  <span className="block font-mono text-[10px] text-[#9DA8B3]">
                    Respects system reduced motion automatically
                  </span>
                </div>
                <div
                  role="radiogroup"
                  aria-label="Animation mode"
                  data-testid="settings-animation-mode"
                  className="grid grid-cols-3 gap-1 rounded-[2px] border border-[#263039] bg-[#080B0D] p-0.5"
                >
                  {(['FULL', 'REDUCED', 'OFF'] as AnimationMode[]).map((mode) => {
                    const currentMode: AnimationMode =
                      draft.animationMode ?? (draft.animationEnabled ? 'FULL' : 'OFF');
                    const active = currentMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        data-testid={`animation-mode-${mode}`}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            animationMode: mode,
                            animationEnabled: mode !== 'OFF',
                          }))
                        }
                        className={`min-h-[32px] rounded-[2px] px-2.5 font-mono text-[11px] font-bold tracking-wider uppercase transition-colors ${
                          active
                            ? 'bg-[#22D36B] text-[#06110A]'
                            : 'text-[#9DA8B3] hover:bg-[#111820] hover:text-[#F5F2EA]'
                        }`}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <label className="flex min-h-[42px] cursor-pointer items-center justify-between rounded-[2px] border border-[#263039] bg-[#111820] px-3.5 py-2">
              <div>
                <span className="block text-sm font-semibold text-[#F5F2EA]">
                  Skip Match Animations
                </span>
                <span className="block font-mono text-[10px] text-[#9DA8B3]">
                  Instant toss, boundaries &amp; Impact Player for Quick Sim / fast play
                </span>
              </div>
              <input
                type="checkbox"
                data-testid="settings-skip-match-animations"
                checked={Boolean(draft.skipMatchAnimations)}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    skipMatchAnimations: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-[#22D36B]"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2.5 border-t border-[#263039] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <GameButton variant="secondary" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Defaults</span>
          </GameButton>

          <div className="flex flex-col gap-2 sm:flex-row">
            {structuralChanged ? (
              <GameButton variant="primary" size="md" onClick={() => onSave(draft, true)}>
                Apply &amp; New Draft
              </GameButton>
            ) : (
              <GameButton variant="primary" size="md" onClick={() => onSave(draft, false)}>
                Save Settings
              </GameButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
