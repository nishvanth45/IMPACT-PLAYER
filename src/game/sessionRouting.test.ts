import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearGuestSaveBundle,
  extractGuestCareerSummary,
  hasFranchiseCareer,
  readGuestSaveBundle,
  readStoredSessionMode,
  resolveAppRoute,
  resolveGuestLinkMigration,
  writeGuestSaveBundle,
  writeStoredSessionMode,
  type SavedCareerBundle,
} from './sessionRouting';
import {
  DEFAULT_SETTINGS,
  createDefaultCustomFranchise,
  createInitialDraftState,
  setCustomFranchise,
} from './draftEngine';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

test('resolveAppRoute enforces exact entry, onboarding, and dashboard routing matrix', () => {
  // Auth still initializing
  assert.equal(
    resolveAppRoute({
      authReady: false,
      isGoogleAuthenticated: false,
      isGuestSession: false,
      isHydratingSession: false,
      hasCareer: false,
    }),
    'LOADING'
  );

  // NOT AUTHENTICATED -> ENTRY
  assert.equal(
    resolveAppRoute({
      authReady: true,
      isGoogleAuthenticated: false,
      isGuestSession: false,
      isHydratingSession: false,
      hasCareer: false,
    }),
    'ENTRY'
  );

  // GOOGLE AUTH + CAREER EXISTS -> OWNER DASHBOARD (never returns to ENTRY)
  assert.equal(
    resolveAppRoute({
      authReady: true,
      isGoogleAuthenticated: true,
      isGuestSession: false,
      isHydratingSession: false,
      hasCareer: true,
    }),
    'OWNER_DASHBOARD'
  );

  // GOOGLE AUTH + NO CAREER -> CREATE FRANCHISE
  assert.equal(
    resolveAppRoute({
      authReady: true,
      isGoogleAuthenticated: true,
      isGuestSession: false,
      isHydratingSession: false,
      hasCareer: false,
    }),
    'CREATE_FRANCHISE'
  );

  // GOOGLE AUTH while hydrating cloud save -> LOADING (prevents flash of Create Franchise)
  assert.equal(
    resolveAppRoute({
      authReady: true,
      isGoogleAuthenticated: true,
      isGuestSession: false,
      isHydratingSession: true,
      hasCareer: false,
    }),
    'LOADING'
  );

  // GUEST + LOCAL CAREER -> OWNER DASHBOARD
  assert.equal(
    resolveAppRoute({
      authReady: true,
      isGoogleAuthenticated: false,
      isGuestSession: true,
      isHydratingSession: false,
      hasCareer: true,
    }),
    'OWNER_DASHBOARD'
  );

  // GUEST + NO CAREER -> CREATE FRANCHISE
  assert.equal(
    resolveAppRoute({
      authReady: true,
      isGoogleAuthenticated: false,
      isGuestSession: true,
      isHydratingSession: false,
      hasCareer: false,
    }),
    'CREATE_FRANCHISE'
  );
});

test('Guest career persists across simulated refresh and clears session mode on sign out without losing local save', () => {
  const storage = createMemoryStorage();
  const baseDraft = createInitialDraftState(DEFAULT_SETTINGS);
  const franchise = createDefaultCustomFranchise('Deccan Storm');
  const draftWithFranchise = setCustomFranchise(baseDraft, franchise);

  const bundle: SavedCareerBundle = {
    settings: DEFAULT_SETTINGS,
    draft: draftWithFranchise,
    season: null,
    activeMatch: null,
  };

  writeStoredSessionMode('GUEST', storage);
  writeGuestSaveBundle(bundle, storage);

  // Simulated browser refresh
  assert.equal(readStoredSessionMode(storage), 'GUEST');
  const reloaded = readGuestSaveBundle(storage);
  assert.ok(reloaded);
  assert.equal(hasFranchiseCareer(reloaded.draft, reloaded.season), true);

  const summary = extractGuestCareerSummary(reloaded);
  assert.ok(summary);
  assert.equal(summary.franchiseName, 'Deccan Storm');
  assert.equal(summary.franchiseCode, franchise.code);

  // Simulated Sign Out from Guest Mode -> returns to ENTRY, guest save stays on device for CONTINUE CAREER
  writeStoredSessionMode(null, storage);
  assert.equal(readStoredSessionMode(storage), null);
  assert.ok(readGuestSaveBundle(storage));

  // Starting a brand new franchise clears old guest bundle cleanly
  clearGuestSaveBundle(storage);
  assert.equal(readGuestSaveBundle(storage), null);
});

test('resolveGuestLinkMigration auto-migrates when cloud is empty and prompts when cloud career already exists', () => {
  const emptyDraft = createInitialDraftState(DEFAULT_SETTINGS);
  const guestDraft = setCustomFranchise(
    emptyDraft,
    createDefaultCustomFranchise('Kochi Tuskers')
  );
  const cloudDraft = setCustomFranchise(
    emptyDraft,
    createDefaultCustomFranchise('Mumbai Warriors')
  );

  assert.equal(
    resolveGuestLinkMigration({
      pendingGuestCareer: { draft: guestDraft },
      cloudSave: null,
    }),
    'AUTO_MIGRATE_TO_CLOUD'
  );

  assert.equal(
    resolveGuestLinkMigration({
      pendingGuestCareer: { draft: guestDraft },
      cloudSave: { draft: emptyDraft },
    }),
    'AUTO_MIGRATE_TO_CLOUD'
  );

  assert.equal(
    resolveGuestLinkMigration({
      pendingGuestCareer: { draft: guestDraft },
      cloudSave: { draft: cloudDraft },
    }),
    'PROMPT_CONFLICT'
  );

  assert.equal(
    resolveGuestLinkMigration({
      pendingGuestCareer: { draft: emptyDraft },
      cloudSave: null,
    }),
    'NONE'
  );
});
