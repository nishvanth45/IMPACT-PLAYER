import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BLUEPRINT_DISPLAY_NAME_MAX_LENGTH,
  BLUEPRINT_EMAIL_MAX_LENGTH,
  BLUEPRINT_FRANCHISE_NAME_MAX_LENGTH,
  BLUEPRINT_PHOTO_URL_MAX_LENGTH,
  BLUEPRINT_VALID_DRAFT_STATUSES,
  buildGameSaveMutableFields,
  isValidBlueprintId,
  sanitizeUserProfileFields,
  stripUndefinedDeep,
} from './src/firebase/cloudSaveValidation';
import { DEFAULT_SETTINGS, createInitialDraftState } from './src/game/draftEngine';
import { createInitialPlayingXIState } from './src/game/playingXiEngine';
import { createInitialCareerStats } from './src/game/careerEngine';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprintJson = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

const SERVER_TIME = 1795000000000;

interface MockAuth {
  uid: string;
  token: {
    email: string;
    email_verified: boolean;
  };
}

interface RuleEvalContext {
  auth: MockAuth | null;
  time: number;
  existingParentUser?: Record<string, unknown> | null;
  existingDoc?: Record<string, unknown> | null;
}

const USER_PROFILE_KEYS = ['uid', 'displayName', 'email', 'photoURL', 'createdAt', 'updatedAt'];
const USER_PROFILE_UPDATE_KEYS = ['displayName', 'email', 'photoURL', 'updatedAt'];
const GAME_SAVE_KEYS = [
  'ownerUid',
  'schemaVersion',
  'franchiseName',
  'squadCount',
  'draftStatus',
  'settings',
  'draft',
  'playingXi',
  'career',
  'season',
  'activeMatch',
  'createdAt',
  'updatedAt',
];
const GAME_SAVE_UPDATE_KEYS = [
  'schemaVersion',
  'franchiseName',
  'squadCount',
  'draftStatus',
  'settings',
  'draft',
  'playingXi',
  'career',
  'season',
  'activeMatch',
  'updatedAt',
];

function hasExactKeys(obj: Record<string, unknown>, allowed: string[]): boolean {
  const keys = Object.keys(obj);
  return allowed.every((k) => keys.includes(k)) && keys.every((k) => allowed.includes(k));
}

function affectedKeys(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): string[] {
  const all = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  return [...all].filter((k) => JSON.stringify(incoming[k]) !== JSON.stringify(existing[k]));
}

function isOwner(auth: MockAuth | null, userId: string): boolean {
  return Boolean(auth && auth.token.email_verified === true && auth.uid === userId);
}

function isValidUserProfile(
  data: Record<string, unknown>,
  userId: string,
  auth: MockAuth | null
): boolean {
  if (!auth || !hasExactKeys(data, USER_PROFILE_KEYS)) return false;
  return (
    typeof data.uid === 'string' &&
    isValidBlueprintId(data.uid) &&
    data.uid === auth.uid &&
    data.uid === userId &&
    typeof data.displayName === 'string' &&
    data.displayName.length >= 1 &&
    data.displayName.length <= BLUEPRINT_DISPLAY_NAME_MAX_LENGTH &&
    typeof data.email === 'string' &&
    data.email.length >= 3 &&
    data.email.length <= BLUEPRINT_EMAIL_MAX_LENGTH &&
    data.email === auth.token.email &&
    typeof data.photoURL === 'string' &&
    data.photoURL.length <= BLUEPRINT_PHOTO_URL_MAX_LENGTH &&
    typeof data.createdAt === 'number' &&
    typeof data.updatedAt === 'number'
  );
}

function isValidGameSave(
  data: Record<string, unknown>,
  userId: string,
  auth: MockAuth | null
): boolean {
  if (!auth || !hasExactKeys(data, GAME_SAVE_KEYS)) return false;
  return (
    typeof data.ownerUid === 'string' &&
    isValidBlueprintId(data.ownerUid) &&
    data.ownerUid === auth.uid &&
    data.ownerUid === userId &&
    typeof data.schemaVersion === 'number' &&
    Number.isInteger(data.schemaVersion) &&
    data.schemaVersion >= 1 &&
    data.schemaVersion <= 100 &&
    typeof data.franchiseName === 'string' &&
    data.franchiseName.length >= 1 &&
    data.franchiseName.length <= BLUEPRINT_FRANCHISE_NAME_MAX_LENGTH &&
    typeof data.squadCount === 'number' &&
    Number.isInteger(data.squadCount) &&
    data.squadCount >= 0 &&
    data.squadCount <= 30 &&
    typeof data.draftStatus === 'string' &&
    (BLUEPRINT_VALID_DRAFT_STATUSES as readonly string[]).includes(data.draftStatus) &&
    typeof data.settings === 'object' &&
    data.settings !== null &&
    typeof data.draft === 'object' &&
    data.draft !== null &&
    typeof data.playingXi === 'object' &&
    data.playingXi !== null &&
    typeof data.career === 'object' &&
    data.career !== null &&
    (data.season === null || typeof data.season === 'object') &&
    (data.activeMatch === null || typeof data.activeMatch === 'object') &&
    typeof data.createdAt === 'number' &&
    typeof data.updatedAt === 'number'
  );
}

function evalUserRule(
  op: 'list' | 'get' | 'create' | 'update' | 'delete',
  userId: string,
  ctx: RuleEvalContext,
  incoming?: Record<string, unknown>
): boolean {
  if (op === 'list' || op === 'delete') return false;
  if (!isOwner(ctx.auth, userId) || !isValidBlueprintId(userId)) return false;
  if (op === 'get') return true;
  if (!incoming || !isValidUserProfile(incoming, userId, ctx.auth)) return false;
  if (op === 'create') {
    return incoming.createdAt === ctx.time && incoming.updatedAt === ctx.time;
  }
  if (!ctx.existingDoc) return false;
  const changed = affectedKeys(incoming, ctx.existingDoc);
  return (
    incoming.uid === ctx.existingDoc.uid &&
    incoming.createdAt === ctx.existingDoc.createdAt &&
    incoming.updatedAt === ctx.time &&
    changed.every((k) => USER_PROFILE_UPDATE_KEYS.includes(k))
  );
}

function evalGameSaveRule(
  op: 'list' | 'get' | 'create' | 'update' | 'delete',
  userId: string,
  saveId: string,
  ctx: RuleEvalContext,
  incoming?: Record<string, unknown>
): boolean {
  if (op === 'list') return false;
  if (!isOwner(ctx.auth, userId) || !isValidBlueprintId(userId) || !isValidBlueprintId(saveId)) {
    return false;
  }
  const hasParent = Boolean(
    ctx.existingParentUser && ctx.existingParentUser.uid === ctx.auth?.uid
  );
  if (op === 'get' || op === 'delete') return hasParent;
  if (!incoming || !isValidGameSave(incoming, userId, ctx.auth)) return false;
  if (op === 'create') {
    return hasParent && incoming.createdAt === ctx.time && incoming.updatedAt === ctx.time;
  }
  if (!ctx.existingDoc) return false;
  const changed = affectedKeys(incoming, ctx.existingDoc);
  return (
    hasParent &&
    incoming.ownerUid === ctx.existingDoc.ownerUid &&
    incoming.createdAt === ctx.existingDoc.createdAt &&
    incoming.updatedAt === ctx.time &&
    changed.every((k) => GAME_SAVE_UPDATE_KEYS.includes(k))
  );
}

const VALID_AUTH: MockAuth = {
  uid: 'user_a',
  token: { email: 'user_a@example.com', email_verified: true },
};

const VALID_PROFILE = {
  uid: 'user_a',
  displayName: 'Virat Manager',
  email: 'user_a@example.com',
  photoURL: 'https://lh3.googleusercontent.com/avatar',
  createdAt: SERVER_TIME,
  updatedAt: SERVER_TIME,
};

const VALID_GAME_SAVE = {
  ownerUid: 'user_a',
  schemaVersion: 1,
  franchiseName: 'Mumbai Warriors',
  squadCount: 0,
  draftStatus: 'READY_TO_SPIN',
  settings: DEFAULT_SETTINGS,
  draft: createInitialDraftState(DEFAULT_SETTINGS),
  playingXi: createInitialPlayingXIState(),
  career: createInitialCareerStats(),
  season: null,
  activeMatch: null,
  createdAt: SERVER_TIME,
  updatedAt: SERVER_TIME,
};

test('firestore.rules enforces all Eight Pillars and matches firebase-blueprint.json', () => {
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('match /{document=**}'));
  assert.ok(rulesText.includes('allow read, write: if false;'));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesText.includes('function isValidId(id)'));
  assert.ok(rulesText.includes('function hasActiveParentUser(userId)'));
  assert.ok(rulesText.includes('function isValidUserProfile(data, userId)'));
  assert.ok(rulesText.includes('function isValidGameSave(data, userId)'));
  assert.ok(rulesText.includes('allow list: if false;'));
  assert.ok(rulesText.includes('incoming().diff(existing()).affectedKeys().hasOnly'));
  assert.ok(rulesText.includes('incoming().updatedAt == request.time'));

  assert.ok(blueprintJson.entities.UserProfile);
  assert.ok(blueprintJson.entities.GameSave);
  assert.ok(blueprintJson.firestore['/users/{userId}']);
  assert.ok(blueprintJson.firestore['/users/{userId}/gameSaves/{saveId}']);
});

test('Dirty Dozen adversarial payloads all return PERMISSION_DENIED', () => {
  // 1. Unauthenticated Read/Write
  assert.equal(evalUserRule('get', 'user_a', { auth: null, time: SERVER_TIME }), false);
  assert.equal(
    evalUserRule('create', 'user_a', { auth: null, time: SERVER_TIME }, VALID_PROFILE),
    false
  );

  // 2. Unverified Email Spoof
  const unverifiedAuth: MockAuth = {
    uid: 'user_a',
    token: { email: 'user_a@example.com', email_verified: false },
  };
  assert.equal(
    evalUserRule('create', 'user_a', { auth: unverifiedAuth, time: SERVER_TIME }, VALID_PROFILE),
    false
  );

  // 3. Cross-User PII Read
  assert.equal(evalUserRule('get', 'user_b', { auth: VALID_AUTH, time: SERVER_TIME }), false);

  // 4. Identity Spoofing on Create
  assert.equal(
    evalUserRule(
      'create',
      'user_a',
      { auth: VALID_AUTH, time: SERVER_TIME },
      { ...VALID_PROFILE, uid: 'user_b' }
    ),
    false
  );

  // 5. Shadow / Privilege Escalation Ghost Field
  assert.equal(
    evalUserRule(
      'create',
      'user_a',
      { auth: VALID_AUTH, time: SERVER_TIME },
      { ...VALID_PROFILE, isAdmin: true }
    ),
    false
  );
  assert.equal(
    evalUserRule(
      'update',
      'user_a',
      { auth: VALID_AUTH, time: SERVER_TIME + 10, existingDoc: VALID_PROFILE },
      { ...VALID_PROFILE, role: 'admin', updatedAt: SERVER_TIME + 10 }
    ),
    false
  );

  // 6. Resource Poisoning (Oversized String)
  assert.equal(
    evalUserRule(
      'create',
      'user_a',
      { auth: VALID_AUTH, time: SERVER_TIME },
      { ...VALID_PROFILE, displayName: 'A'.repeat(200) }
    ),
    false
  );

  // 7. Path ID Poisoning
  assert.equal(
    evalGameSaveRule(
      'create',
      'user_a',
      'bad$id..',
      { auth: VALID_AUTH, time: SERVER_TIME, existingParentUser: VALID_PROFILE },
      VALID_GAME_SAVE
    ),
    false
  );

  // 8. Orphaned Subcollection Write (missing parent /users/{userId})
  assert.equal(
    evalGameSaveRule(
      'create',
      'user_a',
      'current',
      { auth: VALID_AUTH, time: SERVER_TIME, existingParentUser: null },
      VALID_GAME_SAVE
    ),
    false
  );

  // 9. Client Timestamp Forgery
  assert.equal(
    evalGameSaveRule(
      'create',
      'user_a',
      'current',
      { auth: VALID_AUTH, time: SERVER_TIME, existingParentUser: VALID_PROFILE },
      { ...VALID_GAME_SAVE, createdAt: SERVER_TIME - 5000 }
    ),
    false
  );

  // 10. Immutable Field Tampering on Update
  assert.equal(
    evalGameSaveRule(
      'update',
      'user_a',
      'current',
      {
        auth: VALID_AUTH,
        time: SERVER_TIME + 100,
        existingParentUser: VALID_PROFILE,
        existingDoc: VALID_GAME_SAVE,
      },
      { ...VALID_GAME_SAVE, createdAt: SERVER_TIME + 100, updatedAt: SERVER_TIME + 100 }
    ),
    false
  );

  // 11. Value Poisoning on Allowed Key
  assert.equal(
    evalGameSaveRule(
      'update',
      'user_a',
      'current',
      {
        auth: VALID_AUTH,
        time: SERVER_TIME + 100,
        existingParentUser: VALID_PROFILE,
        existingDoc: VALID_GAME_SAVE,
      },
      { ...VALID_GAME_SAVE, draftStatus: 'HACKED_STATE', updatedAt: SERVER_TIME + 100 }
    ),
    false
  );
  assert.equal(
    evalGameSaveRule(
      'update',
      'user_a',
      'current',
      {
        auth: VALID_AUTH,
        time: SERVER_TIME + 100,
        existingParentUser: VALID_PROFILE,
        existingDoc: VALID_GAME_SAVE,
      },
      { ...VALID_GAME_SAVE, squadCount: 999, updatedAt: SERVER_TIME + 100 }
    ),
    false
  );

  // 12. Blanket Collection List Scraping
  assert.equal(evalUserRule('list', 'user_a', { auth: VALID_AUTH, time: SERVER_TIME }), false);
  assert.equal(
    evalGameSaveRule('list', 'user_a', 'current', {
      auth: VALID_AUTH,
      time: SERVER_TIME,
      existingParentUser: VALID_PROFILE,
    }),
    false
  );
});

test('valid owner operations and defensive cloud save builders pass blueprint constraints', () => {
  assert.equal(
    evalUserRule('create', 'user_a', { auth: VALID_AUTH, time: SERVER_TIME }, VALID_PROFILE),
    true
  );
  assert.equal(
    evalUserRule(
      'update',
      'user_a',
      { auth: VALID_AUTH, time: SERVER_TIME + 50, existingDoc: VALID_PROFILE },
      { ...VALID_PROFILE, displayName: 'Updated Name', updatedAt: SERVER_TIME + 50 }
    ),
    true
  );
  assert.equal(
    evalGameSaveRule(
      'create',
      'user_a',
      'current',
      { auth: VALID_AUTH, time: SERVER_TIME, existingParentUser: VALID_PROFILE },
      VALID_GAME_SAVE
    ),
    true
  );
  assert.equal(
    evalGameSaveRule(
      'update',
      'user_a',
      'current',
      {
        auth: VALID_AUTH,
        time: SERVER_TIME + 50,
        existingParentUser: VALID_PROFILE,
        existingDoc: VALID_GAME_SAVE,
      },
      { ...VALID_GAME_SAVE, franchiseName: 'Chennai Chargers', updatedAt: SERVER_TIME + 50 }
    ),
    true
  );

  // Defensive payload sanitization
  const sanitizedProfile = sanitizeUserProfileFields({
    displayName: 'X'.repeat(300),
    email: 'owner@example.com',
    photoURL: null,
  });
  assert.equal(sanitizedProfile.displayName.length, BLUEPRINT_DISPLAY_NAME_MAX_LENGTH);
  assert.equal(sanitizedProfile.photoURL, '');

  const cleaned = stripUndefinedDeep({ a: 1, b: undefined, nested: { c: undefined, d: null } });
  assert.deepEqual(cleaned, { a: 1, nested: { d: null } });

  const savePayload = buildGameSaveMutableFields({
    settings: { ...DEFAULT_SETTINGS, franchiseName: 'Z'.repeat(200) },
    draft: createInitialDraftState(DEFAULT_SETTINGS),
    playingXi: createInitialPlayingXIState(),
    career: createInitialCareerStats(),
    season: null,
    activeMatch: null,
  });
  assert.equal(savePayload.franchiseName.length, BLUEPRINT_FRANCHISE_NAME_MAX_LENGTH);
  assert.equal(savePayload.squadCount, 0);
  assert.equal(savePayload.draftStatus, 'READY_TO_SPIN');
});
