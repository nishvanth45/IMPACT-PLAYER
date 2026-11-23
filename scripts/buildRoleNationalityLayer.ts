import fs from 'node:fs';
import path from 'node:path';
import {
  buildCanonicalRoleNationalityLayer,
  buildRoleNationalityValidationReport,
  normalizeBowlingType,
  resolveEffectiveSeasonRole,
  toPlayerOriginTypeFromCanonical,
  type RawRoleNationalityObservation,
} from '../src/game/roleNationalityEngine';
import type { IplDatabaseJson, IplDatabasePlayerRaw } from '../src/types/game';

const DB_PATH = path.resolve(process.cwd(), 'public/impact_player_database.json');

function main() {
  const rawContent = fs.readFileSync(DB_PATH, 'utf8');
  const db = JSON.parse(rawContent) as IplDatabaseJson;

  if (!db.seasons || typeof db.seasons !== 'object') {
    throw new Error('Invalid impact_player_database.json: missing seasons object.');
  }

  const observations: RawRoleNationalityObservation[] = [];

  for (const [seasonKey, teams] of Object.entries(db.seasons)) {
    const seasonNum = Number(seasonKey);
    if (!Number.isFinite(seasonNum) || !teams) continue;
    for (const team of Object.values(teams)) {
      if (!team || !Array.isArray(team.players)) continue;
      for (const p of team.players) {
        const pid = String(p.playerId ?? p.id ?? '').trim();
        if (!pid) continue;
        observations.push({
          playerId: pid,
          season: seasonNum,
          role: p.role,
          primaryRole: p.primaryRole,
          seasonRole: p.seasonRole,
          roleStatus: p.roleStatus,
          nationality: p.nationality,
          nationalityStatus: p.nationalityStatus,
          isOverseas: p.isOverseas,
          playerType: p.playerType,
          bowlingStyle: p.bowlingStyle,
          bowlingType: p.bowlingType,
        });
      }
    }
  }

  const canonicalPlayers = buildCanonicalRoleNationalityLayer(observations, db.canonicalPlayers);
  const report = buildRoleNationalityValidationReport(canonicalPlayers);

  let updatedRecords = 0;
  let fixedOverseasContradictions = 0;
  let fixedPartialRoleGaps = 0;
  let seasonRoleOverrides = 0;

  for (const [seasonKey, teams] of Object.entries(db.seasons)) {
    const seasonNum = Number(seasonKey);
    if (!Number.isFinite(seasonNum) || !teams) continue;
    for (const team of Object.values(teams)) {
      if (!team || !Array.isArray(team.players)) continue;
      for (const p of team.players as IplDatabasePlayerRaw[]) {
        const pid = String(p.playerId ?? p.id ?? '').trim();
        const canonical = canonicalPlayers[pid];
        if (!canonical) continue;

        const prevOverseas = p.isOverseas;
        const prevRole = p.role;

        const resolvedRole = resolveEffectiveSeasonRole(canonical, seasonNum);
        const bowlingType =
          normalizeBowlingType(p.bowlingType ?? p.bowlingStyle) !== 'Unknown'
            ? normalizeBowlingType(p.bowlingType ?? p.bowlingStyle)
            : canonical.bowlingType;

        if (prevOverseas !== canonical.isOverseas && typeof prevOverseas === 'boolean') {
          fixedOverseasContradictions += 1;
        }
        if ((prevRole === 'UNKNOWN' || !prevRole) && resolvedRole.role !== 'UNKNOWN') {
          fixedPartialRoleGaps += 1;
        }
        if (resolvedRole.seasonRole) {
          seasonRoleOverrides += 1;
        }

        p.primaryRole = resolvedRole.primaryRole;
        if (resolvedRole.seasonRole) {
          p.seasonRole = resolvedRole.seasonRole;
        } else {
          delete p.seasonRole;
        }
        p.role = resolvedRole.role;
        p.roleStatus = canonical.roleStatus;
        p.nationality = canonical.nationality;
        p.isOverseas = canonical.isOverseas;
        p.nationalityStatus = canonical.nationalityStatus;
        p.playerType = toPlayerOriginTypeFromCanonical(canonical.isOverseas);
        p.bowlingType = bowlingType;

        updatedRecords += 1;
      }
    }
  }

  // Sort canonicalPlayers deterministically by playerId
  const sortedCanonical: typeof canonicalPlayers = {};
  for (const pid of Object.keys(canonicalPlayers).sort()) {
    sortedCanonical[pid] = canonicalPlayers[pid];
  }

  const nextDb: IplDatabaseJson = {
    meta: {
      ...db.meta,
      uniqueCanonicalPlayers: report.totalCanonicalPlayers,
      playerSeasonRecords: updatedRecords,
    },
    ...(db.gameDefaults ? { gameDefaults: db.gameDefaults } : {}),
    canonicalPlayers: sortedCanonical,
    seasons: db.seasons,
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(nextDb, null, 2) + '\n', 'utf8');

  console.log('=== ROLE + NATIONALITY LAYER BUILT ===');
  console.log(`TOTAL CANONICAL PLAYERS: ${report.totalCanonicalPlayers}`);
  console.log(`ROLE VERIFIED: ${report.roleVerified}`);
  console.log(`ROLE INFERRED: ${report.roleInferred}`);
  console.log(`ROLE NEEDS REVIEW: ${report.roleNeedsReview}`);
  console.log(`NATIONALITY VERIFIED: ${report.nationalityVerified}`);
  console.log(`NATIONALITY NEEDS REVIEW: ${report.nationalityNeedsReview}`);
  console.log(`INDIAN PLAYERS: ${report.indianPlayers}`);
  console.log(`OVERSEAS PLAYERS: ${report.overseasPlayers}`);
  console.log(`UNKNOWN ORIGIN PLAYERS: ${report.unknownOriginPlayers}`);
  console.log(`MISSING NATIONALITY: ${report.missingNationality}`);
  console.log(`MISSING ROLE: ${report.missingRole}`);
  console.log('---');
  console.log(`TOTAL PLAYER-SEASON RECORDS UPDATED: ${updatedRecords}`);
  console.log(`CROSS-SEASON OVERSEAS CONTRADICTIONS FIXED: ${fixedOverseasContradictions}`);
  console.log(`PARTIAL-SEASON ROLE GAPS RESOLVED: ${fixedPartialRoleGaps}`);
  console.log(`HISTORICAL SEASON-ROLE OVERRIDES PRESERVED: ${seasonRoleOverrides}`);
}

main();
