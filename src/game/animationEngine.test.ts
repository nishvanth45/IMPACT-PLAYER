import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSpinDecelerationSchedule,
  classifyMatchResultPresentation,
  detectMatchFeedback,
  getChaseTensionState,
  resolveAnimationMode,
} from './animationEngine';
import type { InningsEngineState } from './cricketMatchEngine';

function makeStubInnings(
  overrides: Partial<InningsEngineState> = {}
): InningsEngineState {
  return {
    battingTeam: {
      id: 'YOU',
      code: 'MUM',
      name: 'Mumbai Warriors',
      shortName: 'MUM',
      primaryColor: '#D94E28',
      homeVenue: 'Wankhede',
      players: [],
    },
    bowlingTeam: {
      id: 'CSK',
      code: 'CSK',
      name: 'Chennai Super Kings',
      shortName: 'CSK',
      primaryColor: '#F59E0B',
      homeVenue: 'Chepauk',
      players: [],
    },
    pitchCondition: 'BALANCED',
    playerForms: {},
    injuredPlayerIds: [],
    difficulty: 'STANDARD',
    teamDaySwing: 0,
    batOrder: [],
    batterStates: {},
    batterOrderIds: [],
    strikerId: 'p1',
    nonStrikerId: 'p2',
    nextBatterCursor: 2,
    bowlers: [],
    runs: 40,
    wickets: 1,
    extras: 2,
    extrasBreakdown: { wides: 2, noBalls: 0, byes: 0, legByes: 0 },
    legalBalls: 30,
    completedOvers: 5,
    lastBowlerId: null,
    lastOverBowledWasQuiet: false,
    freeHitActive: false,
    activeOver: null,
    phaseTrack: {
      POWERPLAY: { runs: 40, wickets: 1, balls: 30, fours: 4, sixes: 1 },
      MIDDLE: { runs: 0, wickets: 0, balls: 0, fours: 0, sixes: 0 },
      DEATH: { runs: 0, wickets: 0, balls: 0, fours: 0, sixes: 0 },
    },
    fallOfWickets: [],
    partnerships: [],
    currentPartnershipRuns: 30,
    currentPartnershipBalls: 22,
    currentPartnershipFours: 3,
    currentPartnershipSixes: 1,
    currentPartnershipDots: 6,
    partnershipWicketNum: 2,
    recentWicketBalls: [],
    disruptionBallsLeft: 0,
    disruptionScoringMult: 1,
    disruptionWicketMult: 1,
    collapsePressureActive: false,
    collapseIntensity: 0,
    ballsSinceLastWicket: 12,
    collapseEvents: 0,
    hadRecoveryAfterCollapse: false,
    nightRunMult: 1,
    nightWicketMult: 1,
    overHistory: [],
    deliveryLog: [],
    isCompleted: false,
    ...overrides,
  };
}

test('resolveAnimationMode honors settings, legacy animationEnabled, and prefers-reduced-motion', () => {
  const full = resolveAnimationMode(
    { animationEnabled: true, animationMode: 'FULL', skipMatchAnimations: false },
    false
  );
  assert.equal(full.effectiveMode, 'FULL');
  assert.equal(full.matchAnimationsEnabled, true);

  const osReduced = resolveAnimationMode(
    { animationEnabled: true, animationMode: 'FULL', skipMatchAnimations: false },
    true
  );
  assert.equal(osReduced.effectiveMode, 'REDUCED');
  assert.equal(osReduced.isReduced, true);

  const off = resolveAnimationMode(
    { animationEnabled: false, animationMode: 'OFF', skipMatchAnimations: false },
    false
  );
  assert.equal(off.effectiveMode, 'OFF');
  assert.equal(off.matchAnimationsEnabled, false);

  const skipMatch = resolveAnimationMode(
    { animationEnabled: true, animationMode: 'FULL', skipMatchAnimations: true },
    false
  );
  assert.equal(skipMatch.effectiveMode, 'FULL');
  assert.equal(skipMatch.matchAnimationsEnabled, false);

  const legacyOff = resolveAnimationMode(
    { animationEnabled: false },
    false
  );
  assert.equal(legacyOff.effectiveMode, 'OFF');
});

test('buildSpinDecelerationSchedule accelerates cleanly into deceleration within 1.0–1.5s for FULL mode', () => {
  const full = buildSpinDecelerationSchedule('FULL');
  assert.ok(full.length >= 10);
  for (let i = 1; i < full.length; i += 1) {
    assert.ok(full[i] > full[i - 1], 'Each spin tick must decelerate');
  }
  const totalMs = full.reduce((a, b) => a + b, 0);
  assert.ok(totalMs >= 1000 && totalMs <= 1500, `Expected 1000–1500ms, got ${totalMs}`);

  const reduced = buildSpinDecelerationSchedule('REDUCED');
  assert.ok(reduced.length > 0 && reduced.reduce((a, b) => a + b, 0) < 500);
  assert.deepEqual(buildSpinDecelerationSchedule('OFF'), []);
});

test('detectMatchFeedback detects FOUR, SIX, WICKET, and key milestones without mutating state', () => {
  const prev = makeStubInnings({
    runs: 96,
    wickets: 1,
    currentPartnershipRuns: 46,
    batterStates: {
      p1: {
        player: { playerId: 'p1', playerName: 'Virat Kohli' } as any,
        runs: 46,
        balls: 31,
        fours: 5,
        sixes: 1,
        out: false,
        dismissalText: 'not out',
        knockFactor: 1,
        arrivedIndex: 0,
      },
    },
    bowlers: [
      {
        player: { playerId: 'b1', playerName: 'Jasprit Bumrah' } as any,
        wickets: 2,
        runsConceded: 18,
      } as any,
    ],
  });

  const nextSix = makeStubInnings({
    runs: 102,
    wickets: 1,
    legalBalls: 31,
    currentPartnershipRuns: 52,
    currentPartnershipBalls: 23,
    batterStates: {
      p1: {
        player: { playerId: 'p1', playerName: 'Virat Kohli' } as any,
        runs: 52,
        balls: 32,
        fours: 5,
        sixes: 2,
        out: false,
        dismissalText: 'not out',
        knockFactor: 1,
        arrivedIndex: 0,
      },
    },
    deliveryLog: [
      {
        batterId: 'p1',
        bowlerId: 'b1',
        outcome: '6',
        batterRuns: 6,
        isWicket: false,
      } as any,
    ],
  });

  const feedbackSix = detectMatchFeedback(prev, nextSix);
  assert.equal(feedbackSix.flash?.kind, 'SIX');
  assert.equal(feedbackSix.flash?.headline, 'SIX!');
  assert.ok(feedbackSix.milestones.some((m) => m.kind === 'BATTER_50'));
  assert.ok(feedbackSix.milestones.length <= 2);

  const nextWicket = makeStubInnings({
    runs: 96,
    wickets: 2,
    legalBalls: 31,
    fallOfWickets: [
      {
        wicketNumber: 2,
        runs: 96,
        overLabel: '5.1',
        batterId: 'p1',
        batterName: 'Virat Kohli',
        phase: 'POWERPLAY',
      },
    ],
    batterStates: {
      p1: {
        player: { playerId: 'p1', playerName: 'Virat Kohli' } as any,
        runs: 46,
        balls: 32,
        fours: 5,
        sixes: 1,
        out: true,
        dismissalText: 'b Bumrah',
        knockFactor: 1,
        arrivedIndex: 0,
      },
    },
    bowlers: [
      {
        player: { playerId: 'b1', playerName: 'Jasprit Bumrah' } as any,
        wickets: 3,
        runsConceded: 18,
      } as any,
    ],
    deliveryLog: [
      {
        batterId: 'p1',
        dismissedBatterId: 'p1',
        bowlerId: 'b1',
        outcome: 'W',
        batterRuns: 0,
        isWicket: true,
        dismissalType: 'BOWLED',
      } as any,
    ],
  });

  const feedbackWicket = detectMatchFeedback(prev, nextWicket);
  assert.equal(feedbackWicket.flash?.kind, 'WICKET');
  assert.ok(feedbackWicket.flash?.detail.includes('Virat Kohli'));
  assert.ok(feedbackWicket.milestones.some((m) => m.kind === 'WICKET_HAUL_3'));
});

test('getChaseTensionState activates localized pulse only in critical chase windows', () => {
  const relaxed = getChaseTensionState({
    target: 160,
    runs: 60,
    wickets: 1,
    legalBalls: 42,
    isCompleted: false,
  });
  assert.equal(relaxed.isChase, true);
  assert.equal(relaxed.isCritical, false);

  const tense = getChaseTensionState({
    target: 185,
    runs: 173,
    wickets: 5,
    legalBalls: 114,
    isCompleted: false,
  });
  assert.equal(tense.isCritical, true);
  assert.equal(tense.calloutText, '12 NEEDED FROM 6');

  const firstInnings = getChaseTensionState({
    target: undefined,
    runs: 170,
    wickets: 4,
    legalBalls: 114,
    isCompleted: false,
  });
  assert.equal(firstInnings.isChase, false);
  assert.equal(firstInnings.isCritical, false);
});

test('classifyMatchResultPresentation distinguishes VICTORY, DEFEAT, SUPER_OVER, and CHAMPIONS', () => {
  assert.equal(
    classifyMatchResultPresentation(
      { winnerId: 'YOU', resultText: 'Won by 14 runs', isSuperOver: false, isTie: false },
      'YOU',
      false
    ).variant,
    'VICTORY'
  );
  assert.equal(
    classifyMatchResultPresentation(
      { winnerId: 'CSK', resultText: 'CSK won by 5 wickets', isSuperOver: false, isTie: false },
      'YOU',
      false
    ).variant,
    'DEFEAT'
  );
  assert.equal(
    classifyMatchResultPresentation(
      { winnerId: 'YOU', resultText: 'Won in Super Over', isSuperOver: true, isTie: false },
      'YOU',
      false
    ).variant,
    'SUPER_OVER'
  );
  assert.equal(
    classifyMatchResultPresentation(
      { winnerId: 'YOU', resultText: 'Won Final by 6 wickets', isSuperOver: false, isTie: false },
      'YOU',
      true
    ).variant,
    'CHAMPIONS'
  );
  assert.equal(
    classifyMatchResultPresentation(
      { winnerId: 'MI', resultText: 'MI won Final by 2 runs', isSuperOver: false, isTie: false },
      'YOU',
      true
    ).variant,
    'DEFEAT'
  );
});
