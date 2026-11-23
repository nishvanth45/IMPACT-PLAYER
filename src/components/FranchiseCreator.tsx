import { useState } from 'react';
import { ArrowRight, MapPin, Palette, Shield } from 'lucide-react';
import {
  createDefaultCustomFranchise,
  suggestFranchiseCode,
} from '../game/draftEngine';
import type { CustomFranchise } from '../types/game';
import { GameButton, GamePanel } from './ui';

const PRIMARY_SWATCHES = [
  '#22D36B',
  '#1D4ED8',
  '#F05A32',
  '#7C3AED',
  '#F5B942',
  '#E44949',
  '#0F766E',
  '#1E293B',
];

const SECONDARY_SWATCHES = [
  '#F5B942',
  '#F5F2EA',
  '#38BDF8',
  '#22D36B',
  '#F05A32',
  '#C084FC',
  '#9DA8B3',
  '#080B0D',
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
  const [groundEditedManually, setGroundEditedManually] = useState(Boolean(initialFranchise));
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
      setError('Enter a Franchise Name (at least 2 characters).');
      return;
    }
    if (code.trim().length !== 3) {
      setError('Enter an exact 3-letter Code (e.g. MWR).');
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
      className="mx-auto w-full max-w-5xl px-4 py-6 pb-20 md:py-10 md:pb-12"
    >
      <GamePanel>
        {/* Header */}
        <div className="border-b border-[#263039] bg-[#111820] px-5 py-4">
          <div className="font-mono text-[10px] font-bold tracking-[0.18em] text-[#22D36B] uppercase">
            11TH IPL FRANCHISE REGISTRATION
          </div>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-wide text-[#F5F2EA] uppercase sm:text-4xl">
            CREATE YOUR FRANCHISE
          </h1>
          <p className="mt-1 text-xs text-[#9DA8B3]">
            Establish your team identity before entering the Retention Room and Live 11-Franchise Draft.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.25fr_0.95fr]">
          {/* Left: Form Inputs */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_132px]">
              <label className="block">
                <span className="font-mono text-[10px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                  FRANCHISE NAME *
                </span>
                <input
                  type="text"
                  data-testid="franchise-name-input"
                  maxLength={28}
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Mumbai Warriors"
                  className="mt-1 h-10 w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 font-display text-lg font-bold tracking-wide text-[#F5F2EA] uppercase placeholder:text-[#667380] focus:border-[#22D36B] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="font-mono text-[10px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                  TEAM CODE *
                </span>
                <input
                  type="text"
                  data-testid="franchise-code-input"
                  maxLength={3}
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="MWR"
                  className="mt-1 h-10 w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 text-center font-mono text-base font-extrabold tracking-widest text-[#F5F2EA] uppercase placeholder:text-[#667380] focus:border-[#22D36B] focus:outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="font-mono text-[10px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                  HOME CITY *
                </span>
                <input
                  type="text"
                  data-testid="franchise-city-input"
                  maxLength={24}
                  value={homeCity}
                  onChange={(e) => {
                    const nextCity = e.target.value;
                    setHomeCity(nextCity);
                    setError(null);
                    if (!groundEditedManually) {
                      const trimmed = nextCity.trim();
                      setHomeGround(trimmed ? `${trimmed} Cricket Stadium` : '');
                    }
                  }}
                  placeholder="e.g. Mumbai"
                  className="mt-1 h-10 w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 text-sm font-semibold text-[#F5F2EA] placeholder:text-[#667380] focus:border-[#22D36B] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="font-mono text-[10px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                  HOME GROUND
                </span>
                <input
                  type="text"
                  data-testid="franchise-ground-input"
                  maxLength={44}
                  value={homeGround}
                  onChange={(e) => {
                    setGroundEditedManually(true);
                    setHomeGround(e.target.value);
                  }}
                  placeholder={`${displayCity} Cricket Stadium`}
                  className="mt-1 h-10 w-full rounded-[2px] border border-[#263039] bg-[#111820] px-3 text-sm font-semibold text-[#F5F2EA] placeholder:text-[#667380] focus:border-[#22D36B] focus:outline-none"
                />
              </label>
            </div>

            {/* Primary & Secondary Color Swatches */}
            <div className="grid grid-cols-1 gap-3 border border-[#263039] bg-[#111820] p-3.5 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">
                    <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Primary Color</span>
                  </span>
                  <input
                    type="color"
                    aria-label="Primary color picker"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-6 w-8 cursor-pointer border border-[#263039] bg-transparent p-0"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRIMARY_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setPrimaryColor(hex)}
                      aria-label={`Primary color ${hex}`}
                      className={`h-7 w-7 rounded-[2px] border transition-transform ${
                        primaryColor.toUpperCase() === hex
                          ? 'scale-105 border-[#F5F2EA] ring-2 ring-[#22D36B]/70'
                          : 'border-[#263039] hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">
                    <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Secondary Color</span>
                  </span>
                  <input
                    type="color"
                    aria-label="Secondary color picker"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-6 w-8 cursor-pointer border border-[#263039] bg-transparent p-0"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SECONDARY_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setSecondaryColor(hex)}
                      aria-label={`Secondary color ${hex}`}
                      className={`h-7 w-7 rounded-[2px] border transition-transform ${
                        secondaryColor.toUpperCase() === hex
                          ? 'scale-105 border-[#F5F2EA] ring-2 ring-[#22D36B]/70'
                          : 'border-[#263039] hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <p role="alert" className="font-mono text-xs font-bold text-[#E44949]">
                {error}
              </p>
            )}
          </div>

          {/* Right: Live Preview + Register CTA */}
          <div className="flex flex-col justify-between gap-4 border border-[#263039] bg-[#111820] p-4">
            <div>
              <div className="font-mono text-[10px] font-bold tracking-widest text-[#9DA8B3] uppercase">
                LIVE FRANCHISE PREVIEW
              </div>

              <div
                data-testid="franchise-preview-card"
                className="mt-2.5 border border-[#263039] bg-[#080B0D] p-4 text-[#F5F2EA]"
              >
                <div
                  className="mb-3 h-1.5 w-full"
                  style={{ backgroundColor: primaryColor }}
                  aria-hidden="true"
                />

                <div className="flex items-center gap-3.5">
                  <div
                    className="flex h-15 w-15 shrink-0 flex-col items-center justify-center rounded-[2px] border-2 font-mono text-lg font-extrabold tracking-widest"
                    style={{
                      backgroundColor: primaryColor,
                      borderColor: secondaryColor,
                      color: '#F5F2EA',
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
                      {displayCity}
                    </div>
                    <h2 className="mt-0.5 truncate font-display text-2xl font-extrabold tracking-wide text-[#F5F2EA] uppercase">
                      [{displayCode}] {displayName}
                    </h2>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-[#9DA8B3]">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{displayGround}</span>
                    </div>
                  </div>
                </div>

                {/* Color Swatch Readout */}
                <div className="mt-3.5 flex items-center justify-between border-t border-[#263039] pt-2.5 font-mono text-[10px] text-[#9DA8B3]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block h-3 w-3 border border-[#F5F2EA]/35"
                        style={{ backgroundColor: primaryColor }}
                      />
                      Primary
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block h-3 w-3 border border-[#F5F2EA]/35"
                        style={{ backgroundColor: secondaryColor }}
                      />
                      Secondary
                    </span>
                  </div>
                  <span className="font-bold text-[#F5B942]">11TH FRANCHISE</span>
                </div>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-[#9DA8B3]">
                Joins CSK, MI, RCB, KKR, SRH, RR, DC, PBKS, GT, and LSG in a 20-match home-and-away
                season.
              </p>
            </div>

            <GameButton
              type="submit"
              variant="primary"
              size="lg"
              data-testid="create-franchise-submit"
              className="w-full"
            >
              <span>REGISTER FRANCHISE</span>
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </GameButton>
          </div>
        </form>
      </GamePanel>
    </section>
  );
}
