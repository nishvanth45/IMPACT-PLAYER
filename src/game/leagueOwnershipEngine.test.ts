import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultPlayerPool,
  buildLeagueAfterUserDraft,
  validateLeagueOwnership,
  selectMatchXIAndBench,
  decideAIImpactSubstitution,
  serializeLeagueState,
  restoreLeagueState,
  repairAIDuplicates,
  getCanonicalPlayerId,
  isEligibleBowler,
  PITCH_TYPES,
  ROLES,
  SQUAD_RULES,
} from './leagueOwnershipEngine.mjs';

function makeRealisticLeagueFixture() {
  const pool = createDefaultPlayerPool();
  const userCanonicalIds = [
    'jasprit_bumrah',
    'virat_kohli',
    'ms_dhoni',
    'suryakumar_yadav',
    'hardik_pandya',
    'rashid_khan',
    'jos_buttler',
    'trent_boult',
    'andre_russell',
    'rinku_singh',
    'yashasvi_jaiswal',
    'kuldeep_yadav',
    'arshdeep_singh',
    'ruturaj_gaikwad',
    'nicholas_pooran',
  ];
  const userSquad = userCanonicalIds.map((cid) => {
    const found = pool.find((p) => p.canonicalId === cid);
    assert.ok(found, `Missing test player ${cid}`);
    return found;
  });

  const league = buildLeagueAfterUserDraft({
    userFranchise: { id: 'USER', name: 'Mumbai Mavericks' },
    userSquad,
    playerPool: pool,
    seasonSeed: 20260401,
  });

  return { pool, league };
}

test('League Ownership 1: 11 teams exist (1 user + 10 AI)', () => {
  const { league } = makeRealisticLeagueFixture();
  const allTeams = [league.userTeam, ...league.opponentTeams];
  assert.equal(allTeams.length, 11);
  assert.equal(league.opponentTeams.length, 10);
});

test('League Ownership 2: Every squad has exactly 15 players', () => {
  const { league } = makeRealisticLeagueFixture();
  for (const t of [league.userTeam, ...league.opponentTeams]) {
    assert.equal(t.squad.length, 15, `${t.id} has ${t.squad.length}`);
  }
});

test('League Ownership 3: No canonical player appears twice across league (including season-suffixed IDs)', () => {
  const { league } = makeRealisticLeagueFixture();
  const audit = validateLeagueOwnership(league);
  assert.equal(audit.duplicatePlayerIds.length, 0);
  assert.equal(audit.uniqueCanonicalPlayers, 165);
  assert.equal(getCanonicalPlayerId('jasprit_bumrah_2023'), 'jasprit_bumrah');
  assert.equal(getCanonicalPlayerId('jasprit_bumrah_2025'), 'jasprit_bumrah');
});

test('League Ownership 4: User players never appear on opponent squads & Transfer Impact notice generated', () => {
  const { league } = makeRealisticLeagueFixture();
  const userIds = new Set(league.userTeam.squad.map(getCanonicalPlayerId));
  for (const ai of league.opponentTeams) {
    for (const p of ai.squad) {
      assert.ok(!userIds.has(getCanonicalPlayerId(p)), `${p.name} leaked to ${ai.id}`);
    }
  }
  const bumrahNotice = league.transferImpactNotices.find(
    (n) => n.playerCanonicalId === 'jasprit_bumrah'
  );
  assert.ok(
    bumrahNotice &&
      bumrahNotice.originalFranchise === 'MI' &&
      bumrahNotice.isInformationalOnly
  );
});

test('League Ownership 5: All opponent squads obey overseas limit (<= 6)', () => {
  const { league } = makeRealisticLeagueFixture();
  const audit = validateLeagueOwnership(league);
  for (const ai of league.opponentTeams) {
    const os = ai.squad.filter((p) => p.isOverseas).length;
    assert.ok(os <= SQUAD_RULES.MAX_OVERSEAS_SQUAD, `${ai.id} has ${os} overseas`);
  }
  assert.equal(audit.invalidOverseasCounts.length, 0);
});

test('League Ownership 6: Every Starting XI contains at least 1 wicketkeeper', () => {
  const { league } = makeRealisticLeagueFixture();
  for (const t of [league.userTeam, ...league.opponentTeams]) {
    const wks = t.startingXI.filter((p) => p.role === ROLES.WK).length;
    assert.ok(wks >= 1, `${t.id} XI has 0 WKs`);
  }
});

test('League Ownership 7: Every Starting XI has enough bowling options (>= 5)', () => {
  const { league } = makeRealisticLeagueFixture();
  for (const t of [league.userTeam, ...league.opponentTeams]) {
    const bowlers = t.startingXI.filter(isEligibleBowler).length;
    assert.ok(bowlers >= 5, `${t.id} XI has only ${bowlers} bowlers`);
  }
});

test('League Ownership 8: Every Impact Bench contains exactly 4 players', () => {
  const { league } = makeRealisticLeagueFixture();
  for (const t of [league.userTeam, ...league.opponentTeams]) {
    assert.equal(t.impactBench.length, 4, `${t.id} bench has ${t.impactBench.length}`);
  }
});

test('League Ownership 9: AI does not blindly pick top-11 OVR (reserves tactical Impact options)', () => {
  const { league } = makeRealisticLeagueFixture();
  let foundNonTopOvrXI = false;
  for (const ai of league.opponentTeams) {
    const top11Ids = new Set(
      [...ai.squad]
        .sort((a, b) => Number(b.ovr ?? 0) - Number(a.ovr ?? 0))
        .slice(0, 11)
        .map(getCanonicalPlayerId)
    );
    const xiIds = new Set(ai.startingXI.map(getCanonicalPlayerId));
    if ([...xiIds].some((id) => !top11Ids.has(id))) {
      foundNonTopOvrXI = true;
    }
  }
  assert.ok(foundNonTopOvrXI, 'AI blindly picked top-11 OVR on every team');
});

test('League Ownership 10: Pitch conditions change AI XI selection', () => {
  const { league } = makeRealisticLeagueFixture();
  let changedOnAtLeastOneTeam = false;
  for (const ai of league.opponentTeams) {
    const spinXI = selectMatchXIAndBench(ai.squad, {
      pitch: PITCH_TYPES.SPIN_FRIENDLY,
      seed: 42,
    }).startingXI.map(getCanonicalPlayerId);

    const paceXI = selectMatchXIAndBench(ai.squad, {
      pitch: PITCH_TYPES.PACE_AND_BOUNCE,
      seed: 42,
    }).startingXI.map(getCanonicalPlayerId);

    const spinSet = new Set(spinXI);
    if (paceXI.some((id) => !spinSet.has(id))) {
      changedOnAtLeastOneTeam = true;
      break;
    }
  }
  assert.ok(changedOnAtLeastOneTeam, 'Pitch had zero effect on AI XI selection');
});

test('League Ownership 11: AI Impact substitutions obey all legality & overseas rules', () => {
  const { league } = makeRealisticLeagueFixture();
  const ai = league.opponentTeams[0];
  const xiOS = ai.startingXI.filter((p) => p.isOverseas).length;
  const subDecision = decideAIImpactSubstitution(
    {
      impactSubUsed: false,
      isBatting: false,
      phase: 'Death',
      wickets: 4,
      requiredRate: 11.5,
      pitch: PITCH_TYPES.BALANCED,
      overseasUsedInMatch: xiOS,
    },
    ai.startingXI,
    ai.impactBench
  );
  if (subDecision) {
    assert.ok(
      !ai.startingXI.some((p) => p.canonicalId === subDecision.incomingCanonicalId)
    );
    assert.ok(
      ai.startingXI.some((p) => p.canonicalId === subDecision.outgoingCanonicalId)
    );
    const finalOS = xiOS + (subDecision.incomingPlayer.isOverseas ? 1 : 0);
    assert.ok(finalOS <= SQUAD_RULES.MAX_OVERSEAS_MATCH_WITH_IMPACT);
  }
});

test('League Ownership 12: Saved rosters restore identically & duplicate repair protects user', () => {
  const { pool, league } = makeRealisticLeagueFixture();
  const saved = serializeLeagueState(league);
  const restored = restoreLeagueState(saved);
  assert.deepEqual(restored, league);

  const corrupted = restoreLeagueState(saved);
  corrupted.opponentTeams[0].squad[0] = league.userTeam.squad[0];
  const badAudit = validateLeagueOwnership(corrupted);
  assert.ok(!badAudit.isValid && badAudit.duplicatePlayerIds.length > 0);

  const repaired = repairAIDuplicates(corrupted, pool, 888);
  const repairedAudit = validateLeagueOwnership(repaired);
  assert.ok(repairedAudit.isValid);
  assert.deepEqual(repaired.userTeam.squad, league.userTeam.squad);
});
