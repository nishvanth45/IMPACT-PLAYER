import { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../game/draftEngine';
import type { DraftSettings } from '../types/game';

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-md border-2 border-[#141619] bg-[#FAF8F3] p-5 text-[#141619] shadow-2xl sm:rounded-md sm:p-6">
        <div className="flex items-center justify-between border-b-2 border-[#141619] pb-3">
          <div>
            <div className="font-mono text-[10px] font-bold tracking-widest text-[#D94E28] uppercase">
              Franchise Configuration
            </div>
            <h2
              id="settings-modal-title"
              className="font-display text-2xl font-extrabold tracking-wide text-[#141619] uppercase"
            >
              Draft &amp; Match Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[3px] border border-[#141619]/20 bg-white text-[#141619] transition-colors hover:bg-[#141619] hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="font-mono text-[11px] font-bold tracking-wider text-[#4A4E54] uppercase">
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
              className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/30 bg-white px-3 py-2 font-display text-base font-bold tracking-wide text-[#141619] uppercase focus:border-[#D94E28] focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#4A4E54] uppercase">
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
                className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/30 bg-white px-3 py-2 font-mono text-sm font-semibold text-[#141619] tabular-nums focus:border-[#D94E28] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#4A4E54] uppercase">
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
                className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/30 bg-white px-3 py-2 font-mono text-sm font-semibold text-[#141619] tabular-nums focus:border-[#D94E28] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#4A4E54] uppercase">
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
                className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/30 bg-white px-3 py-2 font-mono text-sm font-semibold text-[#141619] tabular-nums focus:border-[#D94E28] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#4A4E54] uppercase">
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
                className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/30 bg-white px-3 py-2 font-mono text-sm font-semibold text-[#141619] tabular-nums focus:border-[#D94E28] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#4A4E54] uppercase">
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
                className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/30 bg-white px-3 py-2 font-mono text-sm font-semibold text-[#141619] tabular-nums focus:border-[#D94E28] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#4A4E54] uppercase">
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
                className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/30 bg-white px-3 py-2 font-mono text-sm font-semibold text-[#141619] tabular-nums focus:border-[#D94E28] focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#4A4E54] uppercase">
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
                className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/30 bg-white px-3 py-2 text-sm font-semibold text-[#141619] focus:border-[#D94E28] focus:outline-none"
              >
                <option value="Casual">Casual</option>
                <option value="Standard">Standard</option>
                <option value="Hard">Expert (Hard)</option>
              </select>
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#4A4E54] uppercase">
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
                className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/30 bg-white px-3 py-2 text-sm font-semibold text-[#141619] focus:border-[#D94E28] focus:outline-none"
              >
                <option value="Normal">Normal</option>
                <option value="Fast">Fast</option>
              </select>
            </label>
          </div>

          <div className="space-y-2 border-t border-[#141619]/15 pt-3">
            <label className="flex min-h-[42px] cursor-pointer items-center justify-between rounded-[3px] border border-[#141619]/20 bg-white px-3.5 py-2">
              <span className="text-sm font-semibold text-[#141619]">Sound Effects</span>
              <input
                type="checkbox"
                checked={draft.soundEnabled}
                onChange={(e) => setDraft((prev) => ({ ...prev, soundEnabled: e.target.checked }))}
                className="h-4 w-4 accent-[#D94E28]"
              />
            </label>

            <label className="flex min-h-[42px] cursor-pointer items-center justify-between rounded-[3px] border border-[#141619]/20 bg-white px-3.5 py-2">
              <span className="text-sm font-semibold text-[#141619]">Spin &amp; Match Animations</span>
              <input
                type="checkbox"
                checked={draft.animationEnabled}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, animationEnabled: e.target.checked }))
                }
                className="h-4 w-4 accent-[#D94E28]"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2.5 border-t-2 border-[#141619] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[3px] border border-[#141619] bg-white px-4 py-2 text-xs font-bold tracking-wider text-[#141619] uppercase transition-colors hover:bg-[#EAE3D5]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            {structuralChanged ? (
              <button
                type="button"
                onClick={() => onSave(draft, true)}
                className="inline-flex min-h-[42px] items-center justify-center rounded-[3px] bg-[#D94E28] px-5 py-2 font-display text-base font-bold tracking-wider text-white uppercase transition-colors hover:bg-[#B83C1B]"
              >
                Apply &amp; New Draft
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSave(draft, false)}
                className="inline-flex min-h-[42px] items-center justify-center rounded-[3px] bg-[#D94E28] px-5 py-2 font-display text-base font-bold tracking-wider text-white uppercase transition-colors hover:bg-[#B83C1B]"
              >
                Save Settings
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
