import { useState } from 'react';
import { ArrowRight, MapPin, Palette, Shield, Sparkles } from 'lucide-react';
import {
  createDefaultCustomFranchise,
  suggestFranchiseCode,
} from '../game/draftEngine';
import type { CustomFranchise } from '../types/game';

const PRIMARY_SWATCHES = [
  '#D94E28',
  '#1D4ED8',
  '#157F3D',
  '#6D28D9',
  '#B45309',
  '#BE185D',
  '#0F766E',
  '#0D1B2A',
];

const SECONDARY_SWATCHES = [
  '#F59E0B',
  '#FFFFFF',
  '#38BDF8',
  '#FACC15',
  '#FB7185',
  '#34D399',
  '#A78BFA',
  '#141619',
];

interface FranchiseCreatorProps {
  initialFranchise?: CustomFranchise | null;
  defaultName?: string;
  onCreateFranchise: (franchise: CustomFranchise) => void;
}

export function FranchiseCreator({
  initialFranchise,
  defaultName,
  onCreateFranchise,
}: FranchiseCreatorProps) {
  const starter =
    initialFranchise ?? createDefaultCustomFranchise(defaultName || 'Mumbai Warriors');

  const [name, setName] = useState(starter.name);
  const [code, setCode] = useState(starter.code);
  const [codeEditedManually, setCodeEditedManually] = useState(Boolean(initialFranchise));
  const [homeCity, setHomeCity] = useState(starter.homeCity);
  const [homeGround, setHomeGround] = useState(starter.homeGround);
  const [primaryColor, setPrimaryColor] = useState(starter.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(starter.secondaryColor);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    setError(null);
    if (!codeEditedManually) {
      setCode(suggestFranchiseCode(val));
    }
  };

  const handleCodeChange = (val: string) => {
    setCodeEditedManually(true);
    setError(null);
    setCode(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3));
  };

  const displayName = name.trim() || 'Mumbai Warriors';
  const displayCode = (code.trim() || suggestFranchiseCode(displayName)).slice(0, 3).padEnd(3, 'X');
  const displayCity = homeCity.trim() || 'Mumbai';
  const displayGround = homeGround.trim() || `${displayCity} Cricket Stadium`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Enter a Team Name (at least 2 characters).');
      return;
    }
    if (code.trim().length !== 3) {
      setError('Enter an exact 3-letter Team Code (e.g. MWR).');
      return;
    }
    if (homeCity.trim().length < 2) {
      setError('Enter a Home City.');
      return;
    }
    onCreateFranchise({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      homeCity: homeCity.trim(),
      homeGround: homeGround.trim() || `${homeCity.trim()} Cricket Stadium`,
      primaryColor,
      secondaryColor,
    });
  };

  return (
    <section
      data-testid="franchise-creator"
      className="mx-auto w-full max-w-5xl px-4 py-4 pb-24 md:pb-10"
    >
      <div className="border-2 border-[#141619] bg-[#FAF8F3] shadow-[4px_4px_0px_#141619]">
        {/* Header Masthead */}
        <div className="border-b-2 border-[#141619] bg-[#0D1B2A] px-5 py-4 text-white">
          <div className="flex items-center gap-2 font-mono text-[10.5px] font-bold tracking-widest text-[#F59E0B] uppercase">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Expansion Franchise Registration · 11th IPL Team</span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-wide uppercase sm:text-4xl">
            CREATE YOUR FRANCHISE
          </h1>
          <p className="mt-0.5 text-xs text-slate-300">
            Register your new 11th franchise to join all 10 official IPL teams in the 20-match season and 20-0 Challenge.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.25fr_0.95fr]">
          {/* Left: Form Fields */}
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
              <label className="block">
                <span className="font-mono text-[10.5px] font-bold tracking-wider text-[#4A4E54] uppercase">
                  Team Name *
                </span>
                <input
                  type="text"
                  data-testid="franchise-name-input"
                  maxLength={28}
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Mumbai Warriors"
                  className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/35 bg-white px-3 py-2 font-display text-lg font-bold tracking-wide text-[#141619] uppercase focus:border-[#D94E28] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="font-mono text-[10.5px] font-bold tracking-wider text-[#4A4E54] uppercase">
                  3-Letter Code *
                </span>
                <input
                  type="text"
                  data-testid="franchise-code-input"
                  maxLength={3}
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="MWR"
                  className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/35 bg-white px-3 py-2 text-center font-mono text-lg font-extrabold tracking-widest text-[#141619] uppercase focus:border-[#D94E28] focus:outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="font-mono text-[10.5px] font-bold tracking-wider text-[#4A4E54] uppercase">
                  Home City *
                </span>
                <input
                  type="text"
                  data-testid="franchise-city-input"
                  maxLength={24}
                  value={homeCity}
                  onChange={(e) => {
                    setHomeCity(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Mumbai"
                  className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/35 bg-white px-3 py-2 text-sm font-semibold text-[#141619] focus:border-[#D94E28] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="font-mono text-[10.5px] font-bold tracking-wider text-[#4A4E54] uppercase">
                  Home Ground (Optional)
                </span>
                <input
                  type="text"
                  data-testid="franchise-ground-input"
                  maxLength={44}
                  value={homeGround}
                  onChange={(e) => setHomeGround(e.target.value)}
                  placeholder={`${displayCity} Cricket Stadium`}
                  className="mt-1 min-h-[42px] w-full rounded-[3px] border border-[#141619]/35 bg-white px-3 py-2 text-sm font-semibold text-[#141619] focus:border-[#D94E28] focus:outline-none"
                />
              </label>
            </div>

            {/* Primary & Secondary Colors */}
            <div className="grid grid-cols-1 gap-3 border border-[#141619]/20 bg-white p-3 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-mono text-[10.5px] font-bold text-[#4A4E54] uppercase">
                    <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Primary Color</span>
                  </span>
                  <input
                    type="color"
                    aria-label="Primary color picker"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-6 w-8 cursor-pointer border border-[#141619]/30 bg-transparent p-0"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRIMARY_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setPrimaryColor(hex)}
                      aria-label={`Primary color ${hex}`}
                      className={`h-7 w-7 rounded-[2px] border-2 transition-transform ${
                        primaryColor.toUpperCase() === hex
                          ? 'scale-110 border-[#141619] ring-2 ring-[#D94E28]/50'
                          : 'border-[#141619]/30 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-mono text-[10.5px] font-bold text-[#4A4E54] uppercase">
                    <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Secondary Color</span>
                  </span>
                  <input
                    type="color"
                    aria-label="Secondary color picker"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-6 w-8 cursor-pointer border border-[#141619]/30 bg-transparent p-0"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SECONDARY_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setSecondaryColor(hex)}
                      aria-label={`Secondary color ${hex}`}
                      className={`h-7 w-7 rounded-[2px] border-2 transition-transform ${
                        secondaryColor.toUpperCase() === hex
                          ? 'scale-110 border-[#141619] ring-2 ring-[#D94E28]/50'
                          : 'border-[#141619]/30 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <p role="alert" className="font-mono text-xs font-bold text-[#D94E28]">
                {error}
              </p>
            )}
          </div>

          {/* Right: Live Franchise Identity Preview */}
          <div className="flex flex-col justify-between gap-4 border-2 border-[#141619] bg-white p-4">
            <div>
              <div className="font-mono text-[10px] font-bold tracking-widest text-[#4A4E54] uppercase">
                Live Franchise Identity Preview
              </div>

              <div
                data-testid="franchise-preview-card"
                className="mt-2.5 border-2 border-[#141619] bg-[#0D1B2A] p-4 text-white shadow-[3px_3px_0px_#141619]"
                style={{ borderTopWidth: '6px', borderTopColor: primaryColor }}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[3px] border-2 font-mono text-xl font-extrabold tracking-widest shadow-sm"
                    style={{
                      backgroundColor: primaryColor,
                      borderColor: secondaryColor,
                      color: '#FFFFFF',
                    }}
                  >
                    <Shield className="mb-0.5 h-3.5 w-3.5 opacity-90" aria-hidden="true" />
                    <span className="leading-none">{displayCode}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div
                      className="font-mono text-[10px] font-bold tracking-wider uppercase"
                      style={{ color: secondaryColor }}
                    >
                      11TH IPL FRANCHISE · {displayCity}
                    </div>
                    <h2 className="mt-0.5 truncate font-display text-2xl font-extrabold tracking-wide text-white uppercase">
                      {displayName}
                    </h2>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-300">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{displayGround}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-white/15 pt-2.5 font-mono text-[10px] text-slate-300">
                  <span>11 TEAMS · 20 LEAGUE MATCHES</span>
                  <span style={{ color: secondaryColor }} className="font-bold">
                    20-0 CHALLENGE
                  </span>
                </div>
              </div>

              <div className="mt-3 border border-[#141619]/15 bg-[#FAF8F3] px-3 py-2 text-[11px] text-[#4A4E54]">
                Joins all 10 official IPL franchises (CSK, MI, RCB, KKR, SRH, RR, DC, PBKS, GT, LSG) for a double round-robin season (10 Home · 10 Away).
              </div>
            </div>

            <button
              type="submit"
              data-testid="create-franchise-submit"
              className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-5 py-2.5 font-display text-xl font-extrabold tracking-wider text-white uppercase shadow-[3px_3px_0px_#141619] transition-colors hover:bg-[#B83C1B]"
            >
              <span>CREATE FRANCHISE &amp; CONTINUE</span>
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
