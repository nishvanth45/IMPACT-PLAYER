# IMPACT PLAYER — Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **Authentication & Verified Email Gate**: Every read and write requires a signed-in Firebase Auth user with `request.auth.token.email_verified == true`.
2. **Default Deny**: All unspecified paths under `/databases/{database}/documents/{document=**}` return `PERMISSION_DENIED`.
3. **Strict Owner Isolation (PII Protection)**:
   - `/users/{userId}` stores PII (`email`, `displayName`, `photoURL`) and is strictly readable and writable only when `request.auth.uid == userId`.
   - Blanket `list` queries on `/users` and `/users/{userId}/gameSaves` are disabled (`allow list: if false;`).
4. **Master Gate (Relational Sync)**:
   - Any read or write to `/users/{userId}/gameSaves/{saveId}` requires the parent `/users/{userId}` document to exist with `uid == request.auth.uid`.
5. **Path Variable Hardening**:
   - Every single-document operation validates `userId` and `saveId` against `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
6. **Validation Blueprint & Anti-Update-Gap**:
   - `isValidUserProfile(data, userId)` and `isValidGameSave(data, userId)` run on both `create` and `update`.
   - Exact key allowlists (`hasAll` + `hasOnly`) forbid shadow/ghost fields (e.g. `role`, `isAdmin`, `isVerified`).
   - All string fields enforce explicit `.size()` bounds matching `firebase-blueprint.json`.
   - Action-based updates use `incoming().diff(existing()).affectedKeys().hasOnly([...])`.
7. **Immutability & Temporal Integrity**:
   - `uid`, `ownerUid`, and `createdAt` are immutable after creation.
   - `createdAt == request.time` on `create`; `updatedAt == request.time` on `create` and `update`.

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Adversarial Payload / Context | Expected Result |
|---|---------------|-------------|-------------------------------|-----------------|
| 1 | Unauthenticated Read/Write | `/users/user_a` | `auth: null`, create/get profile | `PERMISSION_DENIED` |
| 2 | Unverified Email Spoof | `/users/user_a` | `auth.uid = 'user_a'`, `email_verified: false` | `PERMISSION_DENIED` |
| 3 | Cross-User PII Read | `/users/user_b` | `auth.uid = 'user_a'` reading `user_b`'s email/profile | `PERMISSION_DENIED` |
| 4 | Identity Spoofing on Create | `/users/user_a` | `auth.uid = 'user_a'`, payload `{ uid: 'user_b', ... }` | `PERMISSION_DENIED` |
| 5 | Shadow / Privilege Escalation Field | `/users/user_a` | Valid profile + ghost field `{ isAdmin: true }` or `{ role: 'admin' }` | `PERMISSION_DENIED` |
| 6 | Resource Poisoning (Oversized String) | `/users/user_a` | `displayName` of length 200 (> 120 maxLength) | `PERMISSION_DENIED` |
| 7 | Path ID Poisoning | `/users/user_a/gameSaves/bad$id..` | Invalid `saveId` containing `$` / `.` | `PERMISSION_DENIED` |
| 8 | Orphaned Subcollection Write | `/users/user_a/gameSaves/current` | Creating game save when parent `/users/user_a` does not exist | `PERMISSION_DENIED` |
| 9 | Client Timestamp Forgery | `/users/user_a/gameSaves/current` | `createdAt` or `updatedAt` != `request.time` | `PERMISSION_DENIED` |
| 10 | Immutable Field Tampering | `/users/user_a/gameSaves/current` | Update attempting to change `ownerUid` or `createdAt` | `PERMISSION_DENIED` |
| 11 | Value Poisoning on Allowed Key | `/users/user_a/gameSaves/current` | Update `draftStatus: 'HACKED_STATE'` or `squadCount: 999` | `PERMISSION_DENIED` |
| 12 | Blanket Collection List Scraping | `/users` or `/users/user_a/gameSaves` | `list` query on `/users` or `/gameSaves` | `PERMISSION_DENIED` |
