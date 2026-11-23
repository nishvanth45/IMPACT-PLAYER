import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type {
  CareerStats,
  DraftSettings,
  DraftState,
  PlayingXIState,
  SeasonState,
} from '../types/game';
import {
  DEFAULT_CLOUD_SAVE_ID,
  buildGameSaveMutableFields,
  isValidBlueprintId,
  sanitizeUserProfileFields,
  type ActiveMatchRef,
  type GameSaveMutableFields,
} from './cloudSaveValidation';
import { OperationType, db, handleFirestoreError } from './firebase';

export interface LoadedCloudGameSave {
  settings?: DraftSettings;
  draft?: DraftState;
  playingXi?: PlayingXIState;
  career?: CareerStats;
  season?: SeasonState | null;
  activeMatch?: ActiveMatchRef | null;
}

export async function ensureUserProfile(user: User): Promise<void> {
  if (!isValidBlueprintId(user.uid)) {
    throw new Error('Invalid Firebase Auth UID format.');
  }
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const fields = sanitizeUserProfileFields({
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  });

  let existsSnap = false;
  try {
    const snap = await getDoc(userRef);
    existsSnap = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (existsSnap) {
    try {
      await updateDoc(userRef, {
        displayName: fields.displayName,
        email: fields.email,
        photoURL: fields.photoURL,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  try {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: fields.displayName,
      email: fields.email,
      photoURL: fields.photoURL,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function loadUserGameSave(
  uid: string,
  saveId: string = DEFAULT_CLOUD_SAVE_ID
): Promise<LoadedCloudGameSave | null> {
  if (!isValidBlueprintId(uid) || !isValidBlueprintId(saveId)) {
    throw new Error('Invalid user or save document ID.');
  }
  const path = `users/${uid}/gameSaves/${saveId}`;
  const saveRef = doc(db, 'users', uid, 'gameSaves', saveId);

  try {
    const snap = await getDoc(saveRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as Partial<GameSaveMutableFields>;
    return {
      settings: data.settings,
      draft: data.draft,
      playingXi: data.playingXi,
      career: data.career,
      season: data.season ?? null,
      activeMatch: data.activeMatch ?? null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserGameSave(
  uid: string,
  state: {
    settings: DraftSettings;
    draft: DraftState;
    playingXi: PlayingXIState;
    career: CareerStats;
    season: SeasonState | null;
    activeMatch: ActiveMatchRef | null;
  },
  hasExistingDoc: boolean,
  saveId: string = DEFAULT_CLOUD_SAVE_ID
): Promise<boolean> {
  if (!isValidBlueprintId(uid) || !isValidBlueprintId(saveId)) {
    throw new Error('Invalid user or save document ID.');
  }
  const path = `users/${uid}/gameSaves/${saveId}`;
  const saveRef = doc(db, 'users', uid, 'gameSaves', saveId);
  const mutable = buildGameSaveMutableFields(state);

  if (hasExistingDoc) {
    try {
      await updateDoc(saveRef, {
        ...mutable,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // If document was removed remotely, fall through to create cleanly
      if (!msg.includes('No document to update') && !msg.includes('not-found')) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  }

  try {
    await setDoc(saveRef, {
      ownerUid: uid,
      ...mutable,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
