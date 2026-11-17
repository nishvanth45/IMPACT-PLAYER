/**
 * IMPACT PLAYER — League Ownership, Tactical AI Roster & Impact Bench Engine
 * Pure deterministic ESM module usable both by Node verification scripts and Vite/TS.
 */

export const PITCH_TYPES = {
  BALANCED: 'BALANCED',
  BATTING_PARADISE: 'BATTING_PARADISE',
  SPIN_FRIENDLY: 'SPIN_FRIENDLY',
  PACE_AND_BOUNCE: 'PACE_AND_BOUNCE',
  SLOW_AND_LOW: 'SLOW_AND_LOW',
  SWINGING: 'SWINGING',
};

export const ROLES = {
  WK: 'WK',
  TOP_BAT: 'TOP_BAT',
  MID_BAT: 'MID_BAT',
  FINISHER: 'FINISHER',
  BAT: 'BAT',
  AR: 'AR',
  PACE: 'PACE',
  SPIN: 'SPIN',
  BOWL: 'BOWL',
};

export const SQUAD_RULES = {
  SQUAD_SIZE: 15,
  STARTING_XI_SIZE: 11,
  IMPACT_BENCH_SIZE: 4,
  MAX_OVERSEAS_SQUAD: 6,
  MAX_OVERSEAS_XI: 4,
  MAX_OVERSEAS_MATCH_WITH_IMPACT: 5,
  MIN_WICKETKEEPERS_XI: 1,
  MIN_BOWLERS_XI: 5,
};

export const AI_FRANCHISES = [
  'MI',
  'CSK',
  'RCB',
  'KKR',
  'SRH',
  'RR',
  'DC',
  'PBKS',
  'GT',
  'LSG',
];

const FRANCHISE_META = {
  MI: { name: 'Mumbai Indians', homePitch: PITCH_TYPES.BATTING_PARADISE },
  CSK: { name: 'Chennai Super Kings', homePitch: PITCH_TYPES.SPIN_FRIENDLY },
  RCB: { name: 'Royal Challengers Bengaluru', homePitch: PITCH_TYPES.BATTING_PARADISE },
  KKR: { name: 'Kolkata Knight Riders', homePitch: PITCH_TYPES.SPIN_FRIENDLY },
  SRH: { name: 'Sunrisers Hyderabad', homePitch: PITCH_TYPES.PACE_AND_BOUNCE },
  RR: { name: 'Rajasthan Royals', homePitch: PITCH_TYPES.BALANCED },
  DC: { name: 'Delhi Capitals', homePitch: PITCH_TYPES.SLOW_AND_LOW },
  PBKS: { name: 'Punjab Kings', homePitch: PITCH_TYPES.PACE_AND_BOUNCE },
  GT: { name: 'Gujarat Titans', homePitch: PITCH_TYPES.SWINGING },
  LSG: { name: 'Lucknow Super Giants', homePitch: PITCH_TYPES.SLOW_AND_LOW },
};

function createRng(seed = 1) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function getCanonicalPlayerId(playerOrId) {
  if (!playerOrId) return '';
  const raw =
    typeof playerOrId === 'string'
      ? playerOrId
      : playerOrId.canonicalId ?? playerOrId.playerId ?? playerOrId.id ?? playerOrId.name ?? '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/(?:_|-)(?:19|20)\d{2}$/, '')
    .replace(/^_+|_+$/g, '');
}

export function normalizePitchType(pitch) {
  if (!pitch) return PITCH_TYPES.BALANCED;
  const upper = String(pitch).trim().toUpperCase();
  if (upper === 'PACE_SEAMER' || upper === 'PACE_AND_BOUNCE') {
    return PITCH_TYPES.PACE_AND_BOUNCE;
  }
  if (PITCH_TYPES[upper]) return PITCH_TYPES[upper];
  return PITCH_TYPES.BALANCED;
}

export function getPlayerBat(p) {
  return Number(p?.bat ?? p?.battingRating ?? 50);
}

export function getPlayerBowl(p) {
  return Number(p?.bowl ?? p?.bowlingRating ?? 25);
}

export function getPlayerImp(p) {
  return Number(p?.imp ?? p?.impactRating ?? Math.round((getPlayerBat(p) + getPlayerBowl(p)) / 2));
}

export function getPlayerOvr(p) {
  return Number(p?.ovr ?? p?.overallRating ?? Math.max(getPlayerBat(p), getPlayerBowl(p)));
}

export function isWicketkeeper(p) {
  return String(p?.role ?? '').toUpperCase() === ROLES.WK;
}

export function classifyBowlerKind(p) {
  if (!p) return 'NONE';
  const role = String(p.role ?? '').toUpperCase();
  const style = String(p.bowlingStyle ?? p.bowlingType ?? '').toLowerCase();
  if (role === ROLES.SPIN || p.isSpinner === true) return 'SPIN';
  if (role === ROLES.PACE || p.isPacer === true) return 'PACE';
  if (/spin|legbreak|offbreak|orthodox|chinaman|wrist/.test(style)) return 'SPIN';
  if (/fast|medium|seam|pace/.test(style)) return 'PACE';
  if (role === ROLES.AR || role === ROLES.BOWL) {
    return hashStr(getCanonicalPlayerId(p)) % 2 === 0 ? 'PACE' : 'SPIN';
  }
  return 'NONE';
}

export function isEligibleBowler(p) {
  if (!p) return false;
  if (p.canBowl === true) return true;
  const role = String(p.role ?? '').toUpperCase();
  if (role === ROLES.PACE || role === ROLES.SPIN || role === ROLES.BOWL || role === ROLES.AR) {
    return true;
  }
  const bowl = getPlayerBowl(p);
  const style = String(p.bowlingStyle ?? p.bowlingType ?? '').toLowerCase();
  if (bowl >= 55) return true;
  if (style && style !== 'none' && bowl >= 48) return true;
  return false;
}

function makePoolPlayer({
  canonicalId,
  name,
  franchise,
  role,
  isOverseas,
  bat,
  bowl,
  imp,
  ovr,
  bowlingStyle,
  battingStyle = 'Right-hand bat',
  season = 2025,
  priceCr,
}) {
  const cid = getCanonicalPlayerId(canonicalId || name);
  const isSpinner =
    role === ROLES.SPIN ||
    /spin|legbreak|offbreak|orthodox|chinaman|wrist/i.test(bowlingStyle || '');
  const isPacer =
    role === ROLES.PACE ||
    /fast|medium|seam|pace/i.test(bowlingStyle || '');
  const effectiveBowlStyle =
    bowlingStyle ??
    (role === ROLES.PACE
      ? 'Right-arm fast'
      : role === ROLES.SPIN
        ? 'Right-arm offbreak'
        : role === ROLES.AR
          ? isSpinner
            ? 'Slow left-arm orthodox'
            : 'Right-arm fast-medium'
          : 'None');

  const computedOvr =
    ovr ??
    Math.round(
      role === ROLES.PACE || role === ROLES.SPIN || role === ROLES.BOWL
        ? bowl * 0.88 + bat * 0.12
        : role === ROLES.AR
          ? bat * 0.54 + bowl * 0.46
          : bat * 0.9 + (imp ?? bat) * 0.1
    );

  const computedImp = imp ?? clamp(Math.round(computedOvr + (role === ROLES.FINISHER || role === ROLES.AR ? 3 : 0)), 45, 98);
  const resolvedPrice =
    priceCr ?? clamp(Math.round((computedOvr - 58) * 0.45 * 2) / 2, 1, 18);

  const spinSkill = clamp(
    Math.round(bat * 0.92 + (isSpinner ? 4 : 0) + ((hashStr(cid + 'sp') % 11) - 5)),
    35,
    99
  );
  const paceSkill = clamp(
    Math.round(bat * 0.94 + (isPacer ? 3 : 0) + ((hashStr(cid + 'pc') % 11) - 5)),
    35,
    99
  );

  return {
    canonicalId: cid,
    id: `${cid}_${season}`,
    playerId: `${cid}_${season}`,
    name,
    playerName: name,
    franchise,
    season,
    role,
    isOverseas: Boolean(isOverseas),
    nationality: isOverseas ? 'Overseas' : 'India',
    bat,
    bowl,
    imp: computedImp,
    ovr: computedOvr,
    battingRating: bat,
    bowlingRating: bowl,
    impactRating: computedImp,
    overallRating: computedOvr,
    priceCr: resolvedPrice,
    battingStyle,
    bowlingStyle: effectiveBowlStyle,
    bowlingType: isSpinner ? 'SPIN' : isPacer ? 'PACE' : 'NONE',
    isSpinner,
    isPacer,
    isFinisher: role === ROLES.FINISHER,
    spinSkill,
    paceSkill,
    powerplay: clamp(Math.round((role === ROLES.TOP_BAT || role === ROLES.PACE ? 5 : 0) + computedOvr), 40, 99),
    middle: clamp(Math.round((role === ROLES.MID_BAT || role === ROLES.SPIN ? 5 : 0) + computedOvr), 40, 99),
    death: clamp(Math.round((role === ROLES.FINISHER || role === ROLES.PACE ? 6 : 0) + computedOvr), 40, 99),
    impactAbility: computedImp,
  };
}

export function createDefaultPlayerPool() {
  const specs = [
    // ================= MI (18 players, 6 OS, 12 IND) =================
    ['jasprit_bumrah', 'Jasprit Bumrah', 'MI', ROLES.PACE, false, 34, 97, 96, 97, 'Right-arm fast'],
    ['suryakumar_yadav', 'Suryakumar Yadav', 'MI', ROLES.MID_BAT, false, 94, 24, 94, 93, 'None'],
    ['hardik_pandya', 'Hardik Pandya', 'MI', ROLES.AR, false, 84, 83, 91, 88, 'Right-arm fast-medium'],
    ['trent_boult', 'Trent Boult', 'MI', ROLES.PACE, true, 30, 89, 88, 88, 'Left-arm fast-medium'],
    ['rohit_sharma', 'Rohit Sharma', 'MI', ROLES.TOP_BAT, false, 89, 28, 87, 88, 'None'],
    ['tilak_varma', 'Tilak Varma', 'MI', ROLES.MID_BAT, false, 85, 42, 85, 84, 'None'],
    ['ryan_rickelton', 'Ryan Rickelton', 'MI', ROLES.WK, true, 82, 22, 83, 82, 'None', 'Left-hand bat'],
    ['ishan_kishan', 'Ishan Kishan', 'MI', ROLES.WK, false, 81, 22, 83, 81, 'None', 'Left-hand bat'],
    ['mitchell_santner', 'Mitchell Santner', 'MI', ROLES.SPIN, true, 64, 83, 84, 82, 'Slow left-arm orthodox'],
    ['deepak_chahar', 'Deepak Chahar', 'MI', ROLES.PACE, false, 44, 80, 79, 79, 'Right-arm medium'],
    ['will_jacks', 'Will Jacks', 'MI', ROLES.AR, true, 82, 70, 86, 80, 'Right-arm offbreak'],
    ['naman_dhir', 'Naman Dhir', 'MI', ROLES.FINISHER, false, 78, 60, 82, 77, 'Right-arm offbreak'],
    ['karn_sharma', 'Karn Sharma', 'MI', ROLES.SPIN, false, 38, 76, 76, 75, 'Right-arm legbreak'],
    ['piyush_chawla', 'Piyush Chawla', 'MI', ROLES.SPIN, false, 42, 78, 77, 77, 'Right-arm legbreak'],
    ['akshar_madhwal', 'Akash Madhwal', 'MI', ROLES.PACE, false, 24, 77, 77, 76, 'Right-arm fast-medium'],
    ['nehal_wadhera', 'Nehal Wadhera', 'MI', ROLES.FINISHER, false, 77, 30, 80, 76, 'None'],
    ['corbin_bosch', 'Corbin Bosch', 'MI', ROLES.AR, true, 68, 76, 77, 75, 'Right-arm fast-medium'],
    ['robin_minz', 'Robin Minz', 'MI', ROLES.WK, false, 73, 22, 75, 72, 'None', 'Left-hand bat'],
    ['nuwan_thushara', 'Nuwan Thushara', 'MI', ROLES.PACE, true, 22, 78, 80, 77, 'Right-arm fast-medium'],

    // ================= CSK (18 players, 6 OS, 12 IND) =================
    ['ms_dhoni', 'MS Dhoni', 'CSK', ROLES.WK, false, 84, 22, 90, 85, 'None'],
    ['ruturaj_gaikwad', 'Ruturaj Gaikwad', 'CSK', ROLES.TOP_BAT, false, 89, 24, 87, 88, 'None'],
    ['ravindra_jadeja', 'Ravindra Jadeja', 'CSK', ROLES.AR, false, 79, 86, 89, 87, 'Slow left-arm orthodox'],
    ['matheesha_pathirana', 'Matheesha Pathirana', 'CSK', ROLES.PACE, true, 22, 88, 91, 87, 'Right-arm fast'],
    ['shivam_dube', 'Shivam Dube', 'CSK', ROLES.FINISHER, false, 84, 56, 88, 83, 'Right-arm medium'],
    ['noor_ahmad', 'Noor Ahmad', 'CSK', ROLES.SPIN, true, 30, 86, 87, 85, 'Left-arm wrist-spin'],
    ['devon_conway', 'Devon Conway', 'CSK', ROLES.WK, true, 85, 22, 83, 84, 'None', 'Left-hand bat'],
    ['rachin_ravindra', 'Rachin Ravindra', 'CSK', ROLES.AR, true, 82, 71, 83, 80, 'Slow left-arm orthodox'],
    ['khaleel_ahmed', 'Khaleel Ahmed', 'CSK', ROLES.PACE, false, 24, 81, 80, 80, 'Left-arm fast-medium'],
    ['ravichandran_ashwin', 'R Ashwin', 'CSK', ROLES.SPIN, false, 60, 83, 82, 82, 'Right-arm offbreak'],
    ['sam_curran', 'Sam Curran', 'CSK', ROLES.AR, true, 76, 80, 84, 81, 'Left-arm medium-fast'],
    ['rahul_tripathi', 'Rahul Tripathi', 'CSK', ROLES.TOP_BAT, false, 79, 24, 80, 78, 'None'],
    ['deepak_hooda', 'Deepak Hooda', 'CSK', ROLES.MID_BAT, false, 76, 62, 77, 75, 'Right-arm offbreak'],
    ['anshul_kamboj', 'Anshul Kamboj', 'CSK', ROLES.PACE, false, 36, 76, 76, 75, 'Right-arm medium-fast'],
    ['shreyas_gopal', 'Shreyas Gopal', 'CSK', ROLES.SPIN, false, 45, 76, 76, 75, 'Right-arm legbreak'],
    ['mukesh_choudhary', 'Mukesh Choudhary', 'CSK', ROLES.PACE, false, 22, 75, 75, 74, 'Left-arm medium-fast'],
    ['vansh_bedi', 'Vansh Bedi', 'CSK', ROLES.WK, false, 72, 22, 74, 71, 'None'],
    ['nathan_ellis', 'Nathan Ellis', 'CSK', ROLES.PACE, true, 32, 81, 82, 80, 'Right-arm fast-medium'],

    // ================= RCB (18 players, 6 OS, 12 IND) =================
    ['virat_kohli', 'Virat Kohli', 'RCB', ROLES.TOP_BAT, false, 96, 26, 94, 95, 'None'],
    ['josh_hazlewood', 'Josh Hazlewood', 'RCB', ROLES.PACE, true, 26, 90, 88, 89, 'Right-arm fast-medium'],
    ['phil_salt', 'Phil Salt', 'RCB', ROLES.WK, true, 86, 22, 89, 86, 'None'],
    ['rajat_patidar', 'Rajat Patidar', 'RCB', ROLES.MID_BAT, false, 85, 25, 86, 84, 'None'],
    ['bhuvneshwar_kumar', 'Bhuvneshwar Kumar', 'RCB', ROLES.PACE, false, 42, 84, 83, 83, 'Right-arm medium-fast'],
    ['liam_livingstone', 'Liam Livingstone', 'RCB', ROLES.AR, true, 81, 74, 87, 81, 'Right-arm legbreak'],
    ['jitesh_sharma', 'Jitesh Sharma', 'RCB', ROLES.WK, false, 79, 22, 83, 79, 'None'],
    ['krunal_pandya', 'Krunal Pandya', 'RCB', ROLES.AR, false, 72, 79, 80, 79, 'Slow left-arm orthodox'],
    ['yash_dayal', 'Yash Dayal', 'RCB', ROLES.PACE, false, 22, 79, 79, 78, 'Left-arm fast-medium'],
    ['suyash_sharma', 'Suyash Sharma', 'RCB', ROLES.SPIN, false, 22, 78, 80, 77, 'Right-arm legbreak'],
    ['tim_david', 'Tim David', 'RCB', ROLES.FINISHER, true, 83, 36, 89, 82, 'None'],
    ['romario_shepherd', 'Romario Shepherd', 'RCB', ROLES.AR, true, 74, 76, 84, 78, 'Right-arm fast-medium'],
    ['devdutt_padikkal', 'Devdutt Padikkal', 'RCB', ROLES.TOP_BAT, false, 78, 22, 77, 77, 'None', 'Left-hand bat'],
    ['rasikh_salam', 'Rasikh Salam', 'RCB', ROLES.PACE, false, 28, 76, 77, 75, 'Right-arm fast-medium'],
    ['swapnil_singh', 'Swapnil Singh', 'RCB', ROLES.SPIN, false, 52, 75, 76, 74, 'Slow left-arm orthodox'],
    ['manoj_bhandage', 'Manoj Bhandage', 'RCB', ROLES.AR, false, 68, 72, 75, 72, 'Right-arm medium'],
    ['nuwan_pradeep_rcb', 'Mohit Rathee', 'RCB', ROLES.SPIN, false, 35, 73, 73, 72, 'Right-arm legbreak'],
    ['jacob_bethell', 'Jacob Bethell', 'RCB', ROLES.AR, true, 78, 69, 80, 76, 'Slow left-arm orthodox'],

    // ================= KKR (18 players, 6 OS, 12 IND) =================
    ['andre_russell', 'Andre Russell', 'KKR', ROLES.AR, true, 87, 81, 95, 88, 'Right-arm fast'],
    ['sunil_narine', 'Sunil Narine', 'KKR', ROLES.AR, true, 79, 90, 94, 89, 'Right-arm offbreak'],
    ['varun_chakravarthy', 'Varun Chakravarthy', 'KKR', ROLES.SPIN, false, 24, 89, 89, 88, 'Right-arm legbreak'],
    ['rinku_singh', 'Rinku Singh', 'KKR', ROLES.FINISHER, false, 86, 24, 91, 85, 'None', 'Left-hand bat'],
    ['shreyas_iyer_kkr', 'Venkatesh Iyer', 'KKR', ROLES.TOP_BAT, false, 84, 62, 85, 83, 'Right-arm medium', 'Left-hand bat'],
    ['harshit_rana', 'Harshit Rana', 'KKR', ROLES.PACE, false, 35, 83, 84, 82, 'Right-arm fast'],
    ['quinton_de_kock', 'Quinton de Kock', 'KKR', ROLES.WK, true, 85, 22, 85, 84, 'None', 'Left-hand bat'],
    ['rahmanullah_gurbaz', 'Rahmanullah Gurbaz', 'KKR', ROLES.WK, true, 80, 22, 82, 79, 'None'],
    ['ramandeep_singh', 'Ramandeep Singh', 'KKR', ROLES.FINISHER, false, 78, 68, 84, 78, 'Right-arm medium'],
    ['vaibhav_arora', 'Vaibhav Arora', 'KKR', ROLES.PACE, false, 24, 79, 79, 78, 'Right-arm fast-medium'],
    ['angkrish_raghuvanshi', 'Angkrish Raghuvanshi', 'KKR', ROLES.TOP_BAT, false, 79, 24, 80, 78, 'None'],
    ['ajinkya_rahane', 'Ajinkya Rahane', 'KKR', ROLES.TOP_BAT, false, 80, 22, 79, 79, 'None'],
    ['anrich_nortje', 'Anrich Nortje', 'KKR', ROLES.PACE, true, 24, 85, 84, 83, 'Right-arm fast'],
    ['spencer_johnson', 'Spencer Johnson', 'KKR', ROLES.PACE, true, 25, 80, 81, 79, 'Left-arm fast'],
    ['suyash_prabhudessai', 'Manish Pandey', 'KKR', ROLES.MID_BAT, false, 76, 22, 75, 75, 'None'],
    ['luv_sisodia', 'Luvnith Sisodia', 'KKR', ROLES.WK, false, 73, 22, 74, 72, 'None'],
    ['mayank_markande', 'Mayank Markande', 'KKR', ROLES.SPIN, false, 28, 76, 77, 75, 'Right-arm legbreak'],
    ['anukul_roy', 'Anukul Roy', 'KKR', ROLES.SPIN, false, 58, 75, 77, 74, 'Slow left-arm orthodox'],

    // ================= SRH (18 players, 6 OS, 12 IND) =================
    ['pat_cummins', 'Pat Cummins', 'SRH', ROLES.PACE, true, 64, 89, 89, 88, 'Right-arm fast'],
    ['heinrich_klaasen', 'Heinrich Klaasen', 'SRH', ROLES.WK, true, 92, 22, 94, 91, 'None'],
    ['travis_head', 'Travis Head', 'SRH', ROLES.TOP_BAT, true, 90, 52, 93, 89, 'Right-arm offbreak', 'Left-hand bat'],
    ['abhishek_sharma', 'Abhishek Sharma', 'SRH', ROLES.AR, false, 86, 68, 91, 85, 'Slow left-arm orthodox', 'Left-hand bat'],
    ['nitish_kumar_reddy', 'Nitish Kumar Reddy', 'SRH', ROLES.AR, false, 81, 74, 84, 81, 'Right-arm medium-fast'],
    ['mohammed_shami', 'Mohammed Shami', 'SRH', ROLES.PACE, false, 30, 88, 86, 87, 'Right-arm fast'],
    ['ishan_kishan_srh', 'Abhinav Manohar', 'SRH', ROLES.FINISHER, false, 78, 26, 81, 77, 'None'],
    ['harshal_patel', 'Harshal Patel', 'SRH', ROLES.PACE, false, 44, 84, 84, 83, 'Right-arm medium'],
    ['rahul_chahar', 'Rahul Chahar', 'SRH', ROLES.SPIN, false, 32, 79, 79, 78, 'Right-arm legbreak'],
    ['adam_zampa', 'Adam Zampa', 'SRH', ROLES.SPIN, true, 26, 84, 83, 82, 'Right-arm legbreak'],
    ['simarjeet_singh', 'Simarjeet Singh', 'SRH', ROLES.PACE, false, 24, 77, 78, 76, 'Right-arm fast-medium'],
    ['jaydev_unadkat', 'Jaydev Unadkat', 'SRH', ROLES.PACE, false, 36, 77, 76, 76, 'Left-arm medium-fast'],
    ['kamindu_mendis', 'Kamindu Mendis', 'SRH', ROLES.AR, true, 78, 71, 79, 77, 'Right-arm offbreak'],
    ['brydon_carse', 'Brydon Carse', 'SRH', ROLES.PACE, true, 54, 79, 79, 78, 'Right-arm fast'],
    ['atharva_taide', 'Atharva Taide', 'SRH', ROLES.TOP_BAT, false, 75, 24, 76, 74, 'None'],
    ['sachin_baby', 'Sachin Baby', 'SRH', ROLES.MID_BAT, false, 74, 24, 74, 73, 'None'],
    ['zeeshan_ansari', 'Zeeshan Ansari', 'SRH', ROLES.SPIN, false, 24, 75, 76, 74, 'Right-arm legbreak'],
    ['srikar_bharat', 'KS Bharat', 'SRH', ROLES.WK, false, 74, 22, 74, 73, 'None'],

    // ================= RR (18 players, 6 OS, 12 IND) =================
    ['yashasvi_jaiswal', 'Yashasvi Jaiswal', 'RR', ROLES.TOP_BAT, false, 90, 32, 91, 89, 'None', 'Left-hand bat'],
    ['sanju_samson', 'Sanju Samson', 'RR', ROLES.WK, false, 88, 22, 88, 87, 'None'],
    ['riyan_parag', 'Riyan Parag', 'RR', ROLES.AR, false, 83, 66, 85, 81, 'Right-arm legbreak'],
    ['jofra_archer', 'Jofra Archer', 'RR', ROLES.PACE, true, 44, 88, 88, 87, 'Right-arm fast'],
    ['shimron_hetmyer', 'Shimron Hetmyer', 'RR', ROLES.FINISHER, true, 83, 22, 88, 82, 'None', 'Left-hand bat'],
    ['dhruv_jurel', 'Dhruv Jurel', 'RR', ROLES.WK, false, 80, 22, 82, 79, 'None'],
    ['wanindu_hasaranga', 'Wanindu Hasaranga', 'RR', ROLES.SPIN, true, 62, 86, 87, 85, 'Right-arm legbreak'],
    ['maheesh_theekshana', 'Maheesh Theekshana', 'RR', ROLES.SPIN, true, 30, 83, 82, 82, 'Right-arm offbreak'],
    ['sandeep_sharma', 'Sandeep Sharma', 'RR', ROLES.PACE, false, 26, 83, 83, 82, 'Right-arm medium'],
    ['tushar_deshpande', 'Tushar Deshpande', 'RR', ROLES.PACE, false, 28, 80, 80, 79, 'Right-arm fast-medium'],
    ['nitish_rana', 'Nitish Rana', 'RR', ROLES.MID_BAT, false, 80, 56, 81, 79, 'Right-arm offbreak', 'Left-hand bat'],
    ['fazalhaq_farooqi', 'Fazalhaq Farooqi', 'RR', ROLES.PACE, true, 22, 81, 81, 80, 'Left-arm fast-medium'],
    ['akash_madhwal_rr', 'Akash Deep', 'RR', ROLES.PACE, false, 30, 78, 78, 77, 'Right-arm fast-medium'],
    ['shubham_dubey', 'Shubham Dubey', 'RR', ROLES.FINISHER, false, 76, 24, 81, 75, 'None'],
    ['vaibhav_suryavanshi', 'Vaibhav Suryavanshi', 'RR', ROLES.TOP_BAT, false, 77, 22, 82, 76, 'None'],
    ['kumar_kartikeya', 'Kumar Kartikeya', 'RR', ROLES.SPIN, false, 26, 76, 76, 75, 'Slow left-arm orthodox'],
    ['kwena_maphaka', 'Kwena Maphaka', 'RR', ROLES.PACE, true, 22, 77, 78, 76, 'Left-arm fast'],
    ['yudhvir_singh', 'Yudhvir Singh', 'RR', ROLES.PACE, false, 36, 74, 75, 73, 'Right-arm fast-medium'],

    // ================= DC (18 players, 6 OS, 12 IND) =================
    ['kuldeep_yadav', 'Kuldeep Yadav', 'DC', ROLES.SPIN, false, 34, 90, 90, 89, 'Left-arm wrist-spin'],
    ['axar_patel', 'Axar Patel', 'DC', ROLES.AR, false, 80, 86, 89, 87, 'Slow left-arm orthodox'],
    ['kl_rahul', 'KL Rahul', 'DC', ROLES.WK, false, 88, 22, 86, 87, 'None'],
    ['mitchell_starc', 'Mitchell Starc', 'DC', ROLES.PACE, true, 42, 88, 89, 87, 'Left-arm fast'],
    ['tristan_stubbs', 'Tristan Stubbs', 'DC', ROLES.FINISHER, true, 84, 54, 88, 83, 'Right-arm offbreak'],
    ['jake_fraser_mcgurk', 'Jake Fraser-McGurk', 'DC', ROLES.TOP_BAT, true, 83, 24, 89, 82, 'None'],
    ['t_natarajan', 'T Natarajan', 'DC', ROLES.PACE, false, 22, 83, 83, 82, 'Left-arm fast-medium'],
    ['mukesh_kumar', 'Mukesh Kumar', 'DC', ROLES.PACE, false, 24, 81, 80, 80, 'Right-arm fast-medium'],
    ['abishek_porel', 'Abishek Porel', 'DC', ROLES.WK, false, 78, 22, 80, 77, 'None', 'Left-hand bat'],
    ['ashutosh_sharma', 'Ashutosh Sharma', 'DC', ROLES.FINISHER, false, 79, 26, 86, 78, 'None'],
    ['faf_du_plessis', 'Faf du Plessis', 'DC', ROLES.TOP_BAT, true, 83, 24, 82, 82, 'None'],
    ['mohit_sharma', 'Mohit Sharma', 'DC', ROLES.PACE, false, 26, 80, 80, 79, 'Right-arm medium'],
    ['sameer_rizvi', 'Sameer Rizvi', 'DC', ROLES.MID_BAT, false, 76, 30, 78, 75, 'None'],
    ['karun_nair', 'Karun Nair', 'DC', ROLES.MID_BAT, false, 78, 26, 78, 77, 'None'],
    ['dushmantha_chameera', 'Dushmantha Chameera', 'DC', ROLES.PACE, true, 24, 79, 78, 78, 'Right-arm fast'],
    ['donovan_ferreira', 'Donovan Ferreira', 'DC', ROLES.WK, true, 76, 52, 80, 75, 'Right-arm offbreak'],
    ['vipraj_nigam', 'Vipraj Nigam', 'DC', ROLES.SPIN, false, 58, 77, 81, 76, 'Right-arm legbreak'],
    ['darshan_nalkande', 'Darshan Nalkande', 'DC', ROLES.PACE, false, 30, 75, 75, 74, 'Right-arm fast-medium'],

    // ================= PBKS (18 players, 6 OS, 12 IND) =================
    ['arshdeep_singh', 'Arshdeep Singh', 'PBKS', ROLES.PACE, false, 26, 88, 88, 87, 'Left-arm fast-medium'],
    ['shreyas_iyer', 'Shreyas Iyer', 'PBKS', ROLES.MID_BAT, false, 88, 24, 87, 87, 'None'],
    ['yuzvendra_chahal', 'Yuzvendra Chahal', 'PBKS', ROLES.SPIN, false, 22, 87, 87, 86, 'Right-arm legbreak'],
    ['marcus_stoinis', 'Marcus Stoinis', 'PBKS', ROLES.AR, true, 82, 76, 86, 82, 'Right-arm medium'],
    ['glenn_maxwell', 'Glenn Maxwell', 'PBKS', ROLES.AR, true, 82, 76, 88, 82, 'Right-arm offbreak'],
    ['marco_jansen', 'Marco Jansen', 'PBKS', ROLES.AR, true, 66, 84, 84, 82, 'Left-arm fast'],
    ['prabhsimran_singh', 'Prabhsimran Singh', 'PBKS', ROLES.WK, false, 81, 22, 83, 80, 'None'],
    ['shashank_singh', 'Shashank Singh', 'PBKS', ROLES.FINISHER, false, 81, 44, 85, 80, 'None'],
    ['josh_inglis', 'Josh Inglis', 'PBKS', ROLES.WK, true, 82, 22, 83, 81, 'None'],
    ['lockie_ferguson', 'Lockie Ferguson', 'PBKS', ROLES.PACE, true, 28, 83, 83, 82, 'Right-arm fast'],
    ['harpreet_brar', 'Harpreet Brar', 'PBKS', ROLES.SPIN, false, 56, 79, 80, 78, 'Slow left-arm orthodox'],
    ['vyshak_vijaykumar', 'Vijaykumar Vyshak', 'PBKS', ROLES.PACE, false, 28, 78, 78, 77, 'Right-arm medium-fast'],
    ['priyansh_arya', 'Priyansh Arya', 'PBKS', ROLES.TOP_BAT, false, 79, 24, 83, 78, 'None'],
    ['nehala_wadhera_pbks', 'Suryansh Shedge', 'PBKS', ROLES.AR, false, 72, 70, 77, 73, 'Right-arm medium'],
    ['yash_thakur', 'Yash Thakur', 'PBKS', ROLES.PACE, false, 24, 77, 77, 76, 'Right-arm fast-medium'],
    ['vishnu_vinod', 'Vishnu Vinod', 'PBKS', ROLES.WK, false, 74, 22, 75, 73, 'None'],
    ['azmatullah_omarzai', 'Azmatullah Omarzai', 'PBKS', ROLES.AR, true, 73, 77, 78, 76, 'Right-arm medium-fast'],
    ['kuldeep_sen', 'Kuldeep Sen', 'PBKS', ROLES.PACE, false, 22, 76, 76, 75, 'Right-arm fast'],

    // ================= GT (18 players, 6 OS, 12 IND) =================
    ['rashid_khan', 'Rashid Khan', 'GT', ROLES.SPIN, true, 64, 94, 95, 93, 'Right-arm legbreak'],
    ['jos_buttler', 'Jos Buttler', 'GT', ROLES.WK, true, 91, 22, 92, 90, 'None'],
    ['shubman_gill', 'Shubman Gill', 'GT', ROLES.TOP_BAT, false, 91, 24, 89, 90, 'None'],
    ['kagiso_rabada', 'Kagiso Rabada', 'GT', ROLES.PACE, true, 36, 88, 87, 87, 'Right-arm fast'],
    ['mohammed_siraj', 'Mohammed Siraj', 'GT', ROLES.PACE, false, 24, 85, 84, 84, 'Right-arm fast'],
    ['sai_sudharsan', 'Sai Sudharsan', 'GT', ROLES.TOP_BAT, false, 86, 24, 84, 85, 'None', 'Left-hand bat'],
    ['prasidh_krishna', 'Prasidh Krishna', 'GT', ROLES.PACE, false, 24, 83, 83, 82, 'Right-arm fast'],
    ['rahul_tewatia', 'Rahul Tewatia', 'GT', ROLES.FINISHER, false, 79, 64, 87, 78, 'Right-arm legbreak'],
    ['shahrukh_khan', 'Shahrukh Khan', 'GT', ROLES.FINISHER, false, 77, 54, 82, 76, 'Right-arm offbreak'],
    ['washington_sundar', 'Washington Sundar', 'GT', ROLES.AR, false, 72, 80, 81, 79, 'Right-arm offbreak'],
    ['glenn_phillips', 'Glenn Phillips', 'GT', ROLES.AR, true, 80, 68, 85, 79, 'Right-arm offbreak'],
    ['gerald_coetzee', 'Gerald Coetzee', 'GT', ROLES.PACE, true, 38, 82, 83, 81, 'Right-arm fast'],
    ['sai_kishore', 'R Sai Kishore', 'GT', ROLES.SPIN, false, 44, 81, 82, 80, 'Slow left-arm orthodox'],
    ['ishant_sharma', 'Ishant Sharma', 'GT', ROLES.PACE, false, 24, 78, 77, 77, 'Right-arm fast-medium'],
    ['anuj_rawat', 'Anuj Rawat', 'GT', ROLES.WK, false, 75, 22, 76, 74, 'None'],
    ['mahipal_lomror', 'Mahipal Lomror', 'GT', ROLES.MID_BAT, false, 76, 54, 78, 75, 'Slow left-arm orthodox'],
    ['sherfane_rutherford', 'Sherfane Rutherford', 'GT', ROLES.FINISHER, true, 79, 32, 83, 78, 'None'],
    ['manav_suthar', 'Manav Suthar', 'GT', ROLES.SPIN, false, 46, 75, 76, 74, 'Slow left-arm orthodox'],

    // ================= LSG (18 players, 6 OS, 12 IND) =================
    ['nicholas_pooran', 'Nicholas Pooran', 'LSG', ROLES.WK, true, 90, 22, 93, 89, 'None', 'Left-hand bat'],
    ['rishabh_pant', 'Rishabh Pant', 'LSG', ROLES.WK, false, 88, 22, 90, 87, 'None', 'Left-hand bat'],
    ['ravi_bishnoi', 'Ravi Bishnoi', 'LSG', ROLES.SPIN, false, 26, 85, 85, 84, 'Right-arm legbreak'],
    ['mayank_yadav', 'Mayank Yadav', 'LSG', ROLES.PACE, false, 22, 86, 89, 85, 'Right-arm fast'],
    ['david_miller', 'David Miller', 'LSG', ROLES.FINISHER, true, 84, 22, 87, 83, 'None', 'Left-hand bat'],
    ['mitchell_marsh', 'Mitchell Marsh', 'LSG', ROLES.AR, true, 83, 73, 85, 81, 'Right-arm medium-fast'],
    ['aiden_markram', 'Aiden Markram', 'LSG', ROLES.MID_BAT, true, 82, 64, 82, 80, 'Right-arm offbreak'],
    ['avesh_khan', 'Avesh Khan', 'LSG', ROLES.PACE, false, 24, 81, 80, 80, 'Right-arm fast-medium'],
    ['mohsin_khan', 'Mohsin Khan', 'LSG', ROLES.PACE, false, 26, 81, 81, 80, 'Left-arm fast-medium'],
    ['ayush_badoni', 'Ayush Badoni', 'LSG', ROLES.FINISHER, false, 79, 55, 82, 78, 'Right-arm offbreak'],
    ['abdul_samad', 'Abdul Samad', 'LSG', ROLES.FINISHER, false, 78, 34, 83, 77, 'None'],
    ['shahbaz_ahmed', 'Shahbaz Ahmed', 'LSG', ROLES.AR, false, 68, 77, 79, 76, 'Slow left-arm orthodox'],
    ['shamar_joseph', 'Shamar Joseph', 'LSG', ROLES.PACE, true, 28, 81, 82, 80, 'Right-arm fast'],
    ['william_orourke', 'Matt Henry', 'LSG', ROLES.PACE, true, 34, 82, 81, 81, 'Right-arm fast-medium'],
    ['m_siddharth', 'M Siddharth', 'LSG', ROLES.SPIN, false, 24, 76, 77, 75, 'Slow left-arm orthodox'],
    ['himmat_singh', 'Himmat Singh', 'LSG', ROLES.MID_BAT, false, 74, 24, 74, 73, 'None'],
    ['aryan_juyal', 'Aryan Juyal', 'LSG', ROLES.WK, false, 74, 22, 75, 73, 'None'],
    ['akash_singh_lsg', 'Akash Singh', 'LSG', ROLES.PACE, false, 22, 75, 76, 74, 'Left-arm medium-fast'],

    // ================= AUCTION / REPLACEMENT POOL (36 domestic + 10 overseas) =================
    ['prithvi_shaw', 'Prithvi Shaw', 'POOL', ROLES.TOP_BAT, false, 78, 22, 82, 77, 'None'],
    ['mayank_agarwal', 'Mayank Agarwal', 'POOL', ROLES.TOP_BAT, false, 77, 22, 77, 76, 'None'],
    ['shikhar_dhawan', 'Shikhar Dhawan', 'POOL', ROLES.TOP_BAT, false, 81, 22, 80, 80, 'None', 'Left-hand bat'],
    ['dinesh_karthik', 'Dinesh Karthik', 'POOL', ROLES.WK, false, 79, 22, 85, 78, 'None'],
    ['wriddhiman_saha', 'Wriddhiman Saha', 'POOL', ROLES.WK, false, 76, 22, 76, 75, 'None'],
    ['umesh_yadav', 'Umesh Yadav', 'POOL', ROLES.PACE, false, 34, 78, 77, 77, 'Right-arm fast'],
    ['amit_mishra', 'Amit Mishra', 'POOL', ROLES.SPIN, false, 30, 78, 78, 77, 'Right-arm legbreak'],
    ['umran_malik', 'Umran Malik', 'POOL', ROLES.PACE, false, 22, 78, 82, 77, 'Right-arm fast'],
    ['kartik_tyagi', 'Kartik Tyagi', 'POOL', ROLES.PACE, false, 24, 76, 78, 75, 'Right-arm fast'],
    ['shivam_mavi', 'Shivam Mavi', 'POOL', ROLES.PACE, false, 36, 77, 77, 76, 'Right-arm fast-medium'],
    ['chetan_sakariya', 'Chetan Sakariya', 'POOL', ROLES.PACE, false, 26, 76, 76, 75, 'Left-arm medium-fast'],
    ['vijay_shankar', 'Vijay Shankar', 'POOL', ROLES.AR, false, 75, 65, 76, 74, 'Right-arm medium'],
    ['sarfaraz_khan', 'Sarfaraz Khan', 'POOL', ROLES.MID_BAT, false, 77, 22, 79, 76, 'None'],
    ['n_jagadeesan', 'N Jagadeesan', 'POOL', ROLES.WK, false, 74, 22, 74, 73, 'None'],
    ['sai_kiran', 'K Gowtham', 'POOL', ROLES.SPIN, false, 58, 75, 77, 74, 'Right-arm offbreak'],
    ['lalit_yadav', 'Lalit Yadav', 'POOL', ROLES.AR, false, 68, 70, 73, 71, 'Right-arm offbreak'],
    ['navdeep_saini', 'Navdeep Saini', 'POOL', ROLES.PACE, false, 26, 76, 76, 75, 'Right-arm fast'],
    ['siddarth_kaul', 'Siddarth Kaul', 'POOL', ROLES.PACE, false, 24, 75, 75, 74, 'Right-arm fast-medium'],
    ['harvik_desai', 'Harvik Desai', 'POOL', ROLES.WK, false, 72, 22, 73, 71, 'None'],
    ['yash_dhull', 'Yash Dhull', 'POOL', ROLES.TOP_BAT, false, 74, 24, 75, 73, 'None'],
    ['rajvardhan_hangargekar', 'Rajvardhan Hangargekar', 'POOL', ROLES.PACE, false, 42, 76, 78, 75, 'Right-arm fast-medium'],
    ['ripal_patel', 'Ripal Patel', 'POOL', ROLES.FINISHER, false, 74, 48, 76, 73, 'None'],
    ['murugan_ashwin', 'Murugan Ashwin', 'POOL', ROLES.SPIN, false, 24, 76, 76, 75, 'Right-arm legbreak'],
    ['rishi_dhawan', 'Rishi Dhawan', 'POOL', ROLES.AR, false, 66, 74, 74, 73, 'Right-arm medium'],
    ['shivalik_sharma', 'Shivalik Sharma', 'POOL', ROLES.MID_BAT, false, 73, 30, 74, 72, 'None'],
    ['kuldip_yadav_pace', 'Kuldip Yadav', 'POOL', ROLES.PACE, false, 24, 74, 74, 73, 'Left-arm medium-fast'],
    ['upendra_yadav', 'Upendra Yadav', 'POOL', ROLES.WK, false, 73, 22, 74, 72, 'None'],
    ['rohan_kunnummal', 'Rohan Kunnummal', 'POOL', ROLES.TOP_BAT, false, 75, 22, 76, 74, 'None'],
    ['tanush_kotian', 'Tanush Kotian', 'POOL', ROLES.SPIN, false, 60, 75, 76, 74, 'Right-arm offbreak'],
    ['sanvir_singh', 'Sanvir Singh', 'POOL', ROLES.FINISHER, false, 74, 52, 76, 73, 'None'],
    ['david_warner', 'David Warner', 'POOL', ROLES.TOP_BAT, true, 84, 22, 85, 84, 'None', 'Left-hand bat'],
    ['kane_williamson', 'Kane Williamson', 'POOL', ROLES.MID_BAT, true, 83, 28, 80, 82, 'None'],
    ['jonny_bairstow', 'Jonny Bairstow', 'POOL', ROLES.WK, true, 82, 22, 84, 81, 'None'],
    ['jason_holder', 'Jason Holder', 'POOL', ROLES.AR, true, 68, 80, 80, 78, 'Right-arm fast-medium'],
    ['sikandar_raza', 'Sikandar Raza', 'POOL', ROLES.AR, true, 78, 76, 83, 79, 'Right-arm offbreak'],
    ['adam_milne', 'Adam Milne', 'POOL', ROLES.PACE, true, 24, 80, 79, 79, 'Right-arm fast'],
    ['kyle_mayers', 'Kyle Mayers', 'POOL', ROLES.AR, true, 78, 70, 82, 77, 'Right-arm medium', 'Left-hand bat'],
    ['finn_allen', 'Finn Allen', 'POOL', ROLES.TOP_BAT, true, 79, 22, 83, 78, 'None'],
  ];

  return specs.map(
    ([
      canonicalId,
      name,
      franchise,
      role,
      isOverseas,
      bat,
      bowl,
      imp,
      ovr,
      bowlingStyle,
      battingStyle,
    ]) =>
      makePoolPlayer({
        canonicalId,
        name,
        franchise,
        role,
        isOverseas,
        bat,
        bowl,
        imp,
        ovr,
        bowlingStyle,
        battingStyle,
      })
  );
}

function makeSyntheticUniqueReserve(franchise, role, index, usedCanonicalIds) {
  let n = index;
  let cid = `${String(franchise).toLowerCase()}_reserve_${n}`;
  while (usedCanonicalIds.has(cid)) {
    n += 1;
    cid = `${String(franchise).toLowerCase()}_reserve_${n}`;
  }
  const bat = role === ROLES.PACE || role === ROLES.SPIN || role === ROLES.BOWL ? 32 : 73;
  const bowl = role === ROLES.WK || role === ROLES.TOP_BAT || role === ROLES.MID_BAT || role === ROLES.FINISHER || role === ROLES.BAT ? 24 : 74;
  return makePoolPlayer({
    canonicalId: cid,
    name: `${franchise} Domestic ${n}`,
    franchise,
    role,
    isOverseas: false,
    bat,
    bowl,
    imp: 74,
    ovr: 73,
  });
}

/**
 * Score a player for Starting XI inclusion under specific pitch conditions.
 * Pitch multipliers materially shift pace vs spin and batter-type priority.
 */
function scorePlayerForPitchXI(player, pitch, rng) {
  const normPitch = normalizePitchType(pitch);
  const bat = getPlayerBat(player);
  const bowl = getPlayerBowl(player);
  const imp = getPlayerImp(player);
  const ovr = getPlayerOvr(player);
  const kind = classifyBowlerKind(player);
  const role = String(player.role ?? '').toUpperCase();

  let score = ovr * 1.0 + imp * 0.14;

  if (normPitch === PITCH_TYPES.SPIN_FRIENDLY) {
    if (kind === 'SPIN') score += 16 + (bowl - 70) * 0.25;
    if (kind === 'PACE') score -= 7;
    if (player.spinSkill) score += (player.spinSkill - 75) * 0.35;
    if (role === ROLES.MID_BAT || role === ROLES.AR) score += 3;
  } else if (normPitch === PITCH_TYPES.PACE_AND_BOUNCE) {
    if (kind === 'PACE') score += 16 + (bowl - 70) * 0.25;
    if (kind === 'SPIN') score -= 7;
    if (player.paceSkill) score += (player.paceSkill - 75) * 0.35;
    if (role === ROLES.TOP_BAT) score += 3;
  } else if (normPitch === PITCH_TYPES.SWINGING) {
    if (kind === 'PACE') score += 14;
    if (kind === 'SPIN') score -= 5;
    if (player.powerplay) score += (player.powerplay - 75) * 0.25;
  } else if (normPitch === PITCH_TYPES.SLOW_AND_LOW) {
    if (kind === 'SPIN') score += 12;
    if (role === ROLES.MID_BAT || role === ROLES.AR) score += 5;
    if (role === ROLES.FINISHER) score -= 3;
  } else if (normPitch === PITCH_TYPES.BATTING_PARADISE) {
    score += (bat - 65) * 0.25;
    if (role === ROLES.FINISHER || role === ROLES.TOP_BAT) score += 6;
    if (kind === 'PACE' && player.death) score += (player.death - 75) * 0.2;
  }

  // Tiny deterministic jitter for tie-breaking without destabilizing strong picks
  score += (rng() - 0.5) * 0.4;
  return score;
}

/**
 * Selects a legal, pitch-adapted Starting XI (11 players) and tactical 4-man Impact Bench.
 * Guarantees:
 * - >= 1 Wicketkeeper in XI
 * - >= 5 Eligible Bowlers in XI (adapted to pitch: spin vs pace emphasis)
 * - <= 4 Overseas players in XI
 * - Deliberately reserves at least 1 high-impact tactical Impact weapon on the bench
 *   when squad depth permits, rather than blindly picking top-11 OVR.
 */
export function selectMatchXIAndBench(squad, options = {}) {
  const pitch = normalizePitchType(options.pitch);
  const seed = options.seed ?? 1;
  const rng = createRng(seed);
  const list = [...(squad || [])];

  if (list.length <= SQUAD_RULES.STARTING_XI_SIZE) {
    const wk = list.find(isWicketkeeper) ?? list[0] ?? null;
    const cap = [...list].sort((a, b) => getPlayerOvr(b) - getPlayerOvr(a))[0] ?? null;
    return {
      startingXI: list,
      impactBench: [],
      captainId: cap ? getCanonicalPlayerId(cap) : null,
      wicketkeeperId: wk ? getCanonicalPlayerId(wk) : null,
      pitch,
    };
  }

  const scored = list.map((p) => ({
    player: p,
    cid: getCanonicalPlayerId(p),
    score: scorePlayerForPitchXI(p, pitch, rng),
    ovr: getPlayerOvr(p),
    imp: getPlayerImp(p),
    isWK: isWicketkeeper(p),
    isBowler: isEligibleBowler(p),
    kind: classifyBowlerKind(p),
    isOS: Boolean(p.isOverseas),
  }));

  const selected = [];
  const selectedIds = new Set();
  let osCount = 0;

  const canAdd = (entry) => {
    if (selected.length >= SQUAD_RULES.STARTING_XI_SIZE) return false;
    if (selectedIds.has(entry.cid)) return false;
    if (entry.isOS && osCount >= SQUAD_RULES.MAX_OVERSEAS_XI) return false;
    return true;
  };

  const addEntry = (entry) => {
    selected.push(entry);
    selectedIds.add(entry.cid);
    if (entry.isOS) osCount += 1;
  };

  // Determine top-11 OVR set so we can ensure tactical bench depth when viable
  const top11OvrIds = new Set(
    [...scored]
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, SQUAD_RULES.STARTING_XI_SIZE)
      .map((e) => e.cid)
  );

  // Reserve 1 high-IMP specialist from outside pure core XI roles (if squad has >=13 players)
  // so AI teams hold a genuine live Impact Player weapon instead of blindly picking top-11 OVR.
  let reservedImpactId = null;
  const domesticWKs = scored.filter((e) => e.isWK && !e.isOS);
  const allWKs = scored.filter((e) => e.isWK);
  const allBowlers = scored.filter((e) => e.isBowler);

  const impactCandidates = [...scored]
    .filter((e) => {
      // Never reserve the only WK or leave <5 bowlers available
      if (e.isWK && allWKs.length <= 1) return false;
      if (e.isBowler && allBowlers.length <= 5) return false;
      // Prefer an overseas impact weapon when squad has >=5 OS, or a specialist finisher/spinner/pacer
      const isSpecialistWeapon =
        e.player.role === ROLES.FINISHER ||
        e.player.role === ROLES.SPIN ||
        e.player.role === ROLES.PACE ||
        e.imp >= e.ovr;
      return isSpecialistWeapon;
    })
    .sort((a, b) => {
      const aPitchMismatch =
        (pitch === PITCH_TYPES.SPIN_FRIENDLY && a.kind === 'PACE' ? 6 : 0) +
        ((pitch === PITCH_TYPES.PACE_AND_BOUNCE || pitch === PITCH_TYPES.SWINGING) && a.kind === 'SPIN' ? 6 : 0);
      const bPitchMismatch =
        (pitch === PITCH_TYPES.SPIN_FRIENDLY && b.kind === 'PACE' ? 6 : 0) +
        ((pitch === PITCH_TYPES.PACE_AND_BOUNCE || pitch === PITCH_TYPES.SWINGING) && b.kind === 'SPIN' ? 6 : 0);
      // Prefer players with high Impact rating (especially someone who would otherwise be top-11 OVR)
      const aScore = a.imp + (top11OvrIds.has(a.cid) ? 8 : 0) + aPitchMismatch - (a.ovr - 75) * 0.25;
      const bScore = b.imp + (top11OvrIds.has(b.cid) ? 8 : 0) + bPitchMismatch - (b.ovr - 75) * 0.25;
      return bScore - aScore;
    });

  if (impactCandidates.length > 0 && scored.length >= 14) {
    // Pick a viable tactical Impact sub (8th-12th ranked or mismatch specialist) so XI stays strong
    const candidate =
      impactCandidates.find((c) => top11OvrIds.has(c.cid) && c.ovr <= 89) ??
      impactCandidates[0];
    if (candidate) {
      reservedImpactId = candidate.cid;
    }
  }

  // 1. Guarantee >= 1 Wicketkeeper (prefer domestic WK if overseas depth is tight)
  const wkPool = [...scored]
    .filter((e) => e.isWK && e.cid !== reservedImpactId)
    .sort((a, b) => {
      const aDomBonus = !a.isOS && domesticWKs.length > 0 ? 4 : 0;
      const bDomBonus = !b.isOS && domesticWKs.length > 0 ? 4 : 0;
      return b.score + bDomBonus - (a.score + aDomBonus);
    });
  if (wkPool.length > 0 && canAdd(wkPool[0])) {
    addEntry(wkPool[0]);
  } else {
    const fallbackWk = scored.find((e) => e.isWK && canAdd(e));
    if (fallbackWk) addEntry(fallbackWk);
  }

  // 2. Guarantee >= 5 Eligible Bowlers, prioritizing pitch-matched specialists (spin vs pace)
  const targetSpinners =
    pitch === PITCH_TYPES.SPIN_FRIENDLY || pitch === PITCH_TYPES.SLOW_AND_LOW ? 2 : 1;
  const targetPacers =
    pitch === PITCH_TYPES.PACE_AND_BOUNCE || pitch === PITCH_TYPES.SWINGING ? 3 : 2;

  const spinPool = [...scored]
    .filter((e) => e.isBowler && e.kind === 'SPIN' && e.cid !== reservedImpactId)
    .sort((a, b) => b.score - a.score);
  const pacePool = [...scored]
    .filter((e) => e.isBowler && e.kind === 'PACE' && e.cid !== reservedImpactId)
    .sort((a, b) => b.score - a.score);

  let spinnersPicked = selected.filter((e) => e.kind === 'SPIN').length;
  for (const sp of spinPool) {
    if (spinnersPicked >= targetSpinners) break;
    if (canAdd(sp)) {
      addEntry(sp);
      spinnersPicked += 1;
    }
  }

  let pacersPicked = selected.filter((e) => e.kind === 'PACE').length;
  for (const pc of pacePool) {
    if (pacersPicked >= targetPacers) break;
    if (canAdd(pc)) {
      addEntry(pc);
      pacersPicked += 1;
    }
  }

  const remainingBowlers = [...scored]
    .filter((e) => e.isBowler && e.cid !== reservedImpactId)
    .sort((a, b) => b.score - a.score);
  for (const bw of remainingBowlers) {
    if (selected.filter((e) => e.isBowler).length >= SQUAD_RULES.MIN_BOWLERS_XI) break;
    if (canAdd(bw)) addEntry(bw);
  }

  // Fallback for bowlers if reservedImpactId blocked reaching 5
  if (selected.filter((e) => e.isBowler).length < SQUAD_RULES.MIN_BOWLERS_XI) {
    for (const bw of [...scored].filter((e) => e.isBowler).sort((a, b) => b.score - a.score)) {
      if (selected.filter((e) => e.isBowler).length >= SQUAD_RULES.MIN_BOWLERS_XI) break;
      if (canAdd(bw)) addEntry(bw);
    }
  }

  // 3. Fill remaining XI slots up to 11 with best pitch-scored batters/all-rounders (keeping reservedImpactId for bench if possible)
  const restCandidates = [...scored]
    .filter((e) => e.cid !== reservedImpactId)
    .sort((a, b) => b.score - a.score);

  for (const cand of restCandidates) {
    if (selected.length >= SQUAD_RULES.STARTING_XI_SIZE) break;
    if (canAdd(cand)) addEntry(cand);
  }

  // Emergency fallback if reservedImpactId is still needed to complete 11 legal players
  if (selected.length < SQUAD_RULES.STARTING_XI_SIZE) {
    for (const cand of [...scored].sort((a, b) => b.score - a.score)) {
      if (selected.length >= SQUAD_RULES.STARTING_XI_SIZE) break;
      if (canAdd(cand)) addEntry(cand);
    }
  }

  // Sort XI into sensible T20 batting order: TOP_BAT -> WK/MID_BAT -> FINISHER/AR -> SPIN/PACE
  const orderWeight = (p) => {
    const role = String(p.role ?? '').toUpperCase();
    if (role === ROLES.TOP_BAT) return 1;
    if (role === ROLES.WK && getPlayerBat(p) >= 75) return 2;
    if (role === ROLES.MID_BAT || role === ROLES.BAT) return 3;
    if (role === ROLES.WK) return 4;
    if (role === ROLES.FINISHER) return 5;
    if (role === ROLES.AR) return 6;
    if (role === ROLES.SPIN) return 7;
    return 8;
  };

  const startingXI = selected
    .map((e) => e.player)
    .sort((a, b) => {
      const diff = orderWeight(a) - orderWeight(b);
      if (diff !== 0) return diff;
      return getPlayerBat(b) - getPlayerBat(a);
    });

  const xiSet = new Set(startingXI.map(getCanonicalPlayerId));
  const impactBench = list
    .filter((p) => !xiSet.has(getCanonicalPlayerId(p)))
    .slice(0, SQUAD_RULES.IMPACT_BENCH_SIZE);

  const captain = [...startingXI].sort((a, b) => getPlayerOvr(b) - getPlayerOvr(a))[0] ?? null;
  const keeper = startingXI.find(isWicketkeeper) ?? null;

  return {
    startingXI,
    impactBench,
    captainId: captain ? getCanonicalPlayerId(captain) : null,
    wicketkeeperId: keeper ? getCanonicalPlayerId(keeper) : null,
    pitch,
  };
}

function buildValidAISquadFromPool(
  franchiseCode,
  poolByCanonical,
  claimedCanonicalIds,
  seed
) {
  const rng = createRng(seed);
  const chosen = [];
  const chosenIds = new Set();
  let osCount = 0;

  const canTake = (p) => {
    const cid = getCanonicalPlayerId(p);
    if (!cid || claimedCanonicalIds.has(cid) || chosenIds.has(cid)) return false;
    if (p.isOverseas && osCount >= SQUAD_RULES.MAX_OVERSEAS_SQUAD) return false;
    return true;
  };

  const take = (p) => {
    const cid = getCanonicalPlayerId(p);
    chosen.push({ ...p, canonicalId: cid });
    chosenIds.add(cid);
    claimedCanonicalIds.add(cid);
    if (p.isOverseas) osCount += 1;
  };

  const allUnused = [...poolByCanonical.values()].filter(
    (p) => !claimedCanonicalIds.has(getCanonicalPlayerId(p))
  );

  // Prefer players from this franchise first, then surplus POOL/other unclaimed players
  const native = allUnused
    .filter((p) => p.franchise === franchiseCode)
    .sort((a, b) => getPlayerOvr(b) - getPlayerOvr(a) + (rng() - 0.5) * 2);

  const external = allUnused
    .filter((p) => p.franchise !== franchiseCode)
    .sort((a, b) => {
      const aPoolBonus = pFranchiseBonus(a);
      const bPoolBonus = pFranchiseBonus(b);
      return getPlayerOvr(b) + bPoolBonus - (getPlayerOvr(a) + aPoolBonus);
    });

  function pFranchiseBonus(p) {
    return p.franchise === 'POOL' ? 8 : 0;
  }

  const orderedCandidates = [...native, ...external];

  // Ensure minimum structural needs in 15-player squad:
  // >= 2 WKs (or >=1 domestic WK), >= 6 eligible bowlers (mix of spin + pace)
  const domWKs = orderedCandidates.filter((p) => isWicketkeeper(p) && !p.isOverseas);
  const anyWKs = orderedCandidates.filter(isWicketkeeper);
  const wkFirst = domWKs[0] ?? anyWKs[0];
  if (wkFirst && canTake(wkFirst)) take(wkFirst);

  // Take 2 spinners + 3 pacers/ARs to guarantee pitch adaptability & >=5 bowlers
  const spinners = orderedCandidates.filter((p) => isEligibleBowler(p) && classifyBowlerKind(p) === 'SPIN');
  for (const sp of spinners.slice(0, 2)) {
    if (chosen.length < SQUAD_RULES.SQUAD_SIZE && canTake(sp)) take(sp);
  }

  const pacers = orderedCandidates.filter((p) => isEligibleBowler(p) && classifyBowlerKind(p) === 'PACE');
  for (const pc of pacers.slice(0, 3)) {
    if (chosen.length < SQUAD_RULES.SQUAD_SIZE && canTake(pc)) take(pc);
  }

  // Take best remaining native players first, then external pool
  for (const cand of native) {
    if (chosen.length >= SQUAD_RULES.SQUAD_SIZE) break;
    if (canTake(cand)) take(cand);
  }
  for (const cand of external) {
    if (chosen.length >= SQUAD_RULES.SQUAD_SIZE) break;
    // Guarantee at least 1 WK and 5 bowlers before filling pure batters
    const needWK = chosen.filter(isWicketkeeper).length < 1;
    const needBowlers = chosen.filter(isEligibleBowler).length < 5;
    const slotsLeft = SQUAD_RULES.SQUAD_SIZE - chosen.length;
    if (needWK && slotsLeft <= 2 && !isWicketkeeper(cand)) continue;
    if (needBowlers && slotsLeft <= 5 - chosen.filter(isEligibleBowler).length && !isEligibleBowler(cand)) continue;
    if (canTake(cand)) take(cand);
  }

  // Final synthetic safety net if a small test pool ran out
  let synthIdx = 1;
  while (chosen.length < SQUAD_RULES.SQUAD_SIZE) {
    const needWK = chosen.filter(isWicketkeeper).length < 1;
    const needBowlers = chosen.filter(isEligibleBowler).length < 5;
    const role = needWK ? ROLES.WK : needBowlers ? ROLES.PACE : ROLES.MID_BAT;
    const synth = makeSyntheticUniqueReserve(franchiseCode, role, synthIdx++, claimedCanonicalIds);
    take(synth);
  }

  return chosen;
}

/**
 * Builds the 11-team league state after the user completes their 15-player draft.
 * User squad owns its players unconditionally; AI franchises replace any displaced
 * stars cleanly and generate informational Transfer Impact notices.
 * @param {{ userFranchise?: { id?: string; name?: string }; userSquad: any[]; playerPool?: any[]; seasonSeed?: number }} params
 */
export function buildLeagueAfterUserDraft({
  userFranchise = { id: 'USER', name: 'User Franchise' },
  userSquad = [],
  playerPool = [],
  seasonSeed = 1,
}) {
  const claimedCanonicalIds = new Set();
  const normalizedUserSquad = userSquad.map((p) => {
    const cid = getCanonicalPlayerId(p);
    claimedCanonicalIds.add(cid);
    return { ...p, canonicalId: cid };
  });

  // Deduplicate playerPool by canonicalId, keeping highest OVR/season entry
  const poolByCanonical = new Map();
  for (const p of playerPool) {
    const cid = getCanonicalPlayerId(p);
    if (!cid) continue;
    const existing = poolByCanonical.get(cid);
    if (!existing || getPlayerOvr(p) > getPlayerOvr(existing)) {
      poolByCanonical.set(cid, { ...p, canonicalId: cid });
    }
  }

  // Generate informational Transfer Impact notices whenever a user drafted an AI franchise player
  const transferImpactNotices = [];
  for (const p of normalizedUserSquad) {
    const origFranchise = p.franchise;
    if (origFranchise && AI_FRANCHISES.includes(origFranchise)) {
      transferImpactNotices.push({
        playerCanonicalId: p.canonicalId,
        playerName: p.name ?? p.playerName,
        originalFranchise: origFranchise,
        draftedByFranchise: userFranchise.id ?? 'USER',
        draftedByName: userFranchise.name ?? 'User Franchise',
        isInformationalOnly: true,
        message: `${p.name ?? p.playerName} drafted from ${origFranchise}. ${origFranchise} signed a replacement to retain a 15-player squad.`,
      });
    }
  }

  const userSelection = selectMatchXIAndBench(normalizedUserSquad, {
    pitch: PITCH_TYPES.BALANCED,
    seed: seasonSeed,
  });

  const userTeam = {
    id: userFranchise.id ?? 'USER',
    name: userFranchise.name ?? 'User Franchise',
    isUser: true,
    homePitch: PITCH_TYPES.BALANCED,
    squad: normalizedUserSquad,
    startingXI: userSelection.startingXI,
    impactBench: userSelection.impactBench,
    captainId: userSelection.captainId,
    wicketkeeperId: userSelection.wicketkeeperId,
  };

  const opponentTeams = AI_FRANCHISES.map((code, idx) => {
    const meta = FRANCHISE_META[code];
    const teamSeed = (Number(seasonSeed) || 1) + (idx + 1) * 97;
    const squad = buildValidAISquadFromPool(code, poolByCanonical, claimedCanonicalIds, teamSeed);
    const matchSelection = selectMatchXIAndBench(squad, {
      pitch: meta.homePitch,
      seed: teamSeed,
    });

    return {
      id: code,
      name: meta.name,
      isUser: false,
      homePitch: meta.homePitch,
      squad,
      startingXI: matchSelection.startingXI,
      impactBench: matchSelection.impactBench,
      captainId: matchSelection.captainId,
      wicketkeeperId: matchSelection.wicketkeeperId,
    };
  });

  return {
    simulationVersion: '1.0.0',
    seasonSeed,
    userTeam,
    opponentTeams,
    transferImpactNotices,
  };
}

/**
 * Validates global league ownership, squad sizes, overseas caps, Starting XIs, and Impact Benches.
 */
export function validateLeagueOwnership(league) {
  const allTeams = [league?.userTeam, ...(league?.opponentTeams ?? [])].filter(Boolean);
  const seenCanonical = new Map();
  const duplicatePlayerIds = [];
  const invalidSquadSizes = [];
  const invalidOverseasCounts = [];
  const invalidXIs = [];
  const invalidImpactBenches = [];

  for (const team of allTeams) {
    const squad = team.squad ?? [];
    const xi = team.startingXI ?? [];
    const bench = team.impactBench ?? [];

    if (squad.length !== SQUAD_RULES.SQUAD_SIZE) {
      invalidSquadSizes.push(team.id);
    }

    const squadOS = squad.filter((p) => p.isOverseas).length;
    const xiOS = xi.filter((p) => p.isOverseas).length;
    if (squadOS > SQUAD_RULES.MAX_OVERSEAS_SQUAD || xiOS > SQUAD_RULES.MAX_OVERSEAS_XI) {
      invalidOverseasCounts.push(team.id);
    }

    const squadIdSet = new Set();
    for (const p of squad) {
      const cid = getCanonicalPlayerId(p);
      squadIdSet.add(cid);
      const count = (seenCanonical.get(cid) ?? 0) + 1;
      seenCanonical.set(cid, count);
      if (count === 2) {
        duplicatePlayerIds.push(cid);
      }
    }

    const xiIdSet = new Set(xi.map(getCanonicalPlayerId));
    const xiWKs = xi.filter(isWicketkeeper).length;
    const xiBowlers = xi.filter(isEligibleBowler).length;
    const xiInSquad = xi.every((p) => squadIdSet.has(getCanonicalPlayerId(p)));
    if (
      xi.length !== SQUAD_RULES.STARTING_XI_SIZE ||
      xiIdSet.size !== SQUAD_RULES.STARTING_XI_SIZE ||
      xiWKs < SQUAD_RULES.MIN_WICKETKEEPERS_XI ||
      xiBowlers < SQUAD_RULES.MIN_BOWLERS_XI ||
      !xiInSquad
    ) {
      invalidXIs.push(team.id);
    }

    const benchIdSet = new Set(bench.map(getCanonicalPlayerId));
    const benchInSquad = bench.every((p) => squadIdSet.has(getCanonicalPlayerId(p)));
    const benchDisjointFromXI = bench.every((p) => !xiIdSet.has(getCanonicalPlayerId(p)));
    if (
      bench.length !== SQUAD_RULES.IMPACT_BENCH_SIZE ||
      benchIdSet.size !== SQUAD_RULES.IMPACT_BENCH_SIZE ||
      !benchInSquad ||
      !benchDisjointFromXI
    ) {
      invalidImpactBenches.push(team.id);
    }
  }

  const isValid =
    allTeams.length === 11 &&
    duplicatePlayerIds.length === 0 &&
    invalidSquadSizes.length === 0 &&
    invalidOverseasCounts.length === 0 &&
    invalidXIs.length === 0 &&
    invalidImpactBenches.length === 0;

  return {
    isValid,
    teamsCount: allTeams.length,
    uniqueCanonicalPlayers: seenCanonical.size,
    duplicatePlayerIds,
    invalidSquadSizes,
    invalidOverseasCounts,
    invalidXIs,
    invalidImpactBenches,
  };
}

/**
 * Evaluates whether an AI team should activate its Impact Player right now,
 * obeying single-use, wicketkeeper protection, and overseas match limit (<= 5 total).
 * @param {any} context
 * @param {any[]} [startingXI]
 * @param {any[]} [impactBench]
 */
export function decideAIImpactSubstitution(context, startingXI = [], impactBench = []) {
  if (!context || context.impactSubUsed) return null;
  if (!Array.isArray(impactBench) || impactBench.length === 0) return null;
  if (!Array.isArray(startingXI) || startingXI.length === 0) return null;

  const overseasUsed = Number(
    context.overseasUsedInMatch ?? startingXI.filter((p) => p.isOverseas).length
  );
  const phase = String(context.phase ?? 'Middle').toUpperCase();
  const pitch = normalizePitchType(context.pitch);
  const isBatting = Boolean(context.isBatting);
  const wickets = Number(context.wickets ?? 0);
  const requiredRate = Number(context.requiredRate ?? 0);

  const legalIncoming = impactBench.filter((cand) => {
    const candCid = getCanonicalPlayerId(cand);
    if (startingXI.some((p) => getCanonicalPlayerId(p) === candCid)) return false;
    const osDelta = cand.isOverseas ? 1 : 0;
    return overseasUsed + osDelta <= SQUAD_RULES.MAX_OVERSEAS_MATCH_WITH_IMPACT;
  });

  if (legalIncoming.length === 0) return null;

  const xiWKs = startingXI.filter(isWicketkeeper);
  const xiBowlers = startingXI.filter(isEligibleBowler);

  if (isBatting) {
    // Batting side looks for a batter/finisher in collapse or high RRR chase/death
    const urgentBatNeed = wickets >= 3 || requiredRate >= 9.5 || phase.includes('DEATH') || phase.includes('MIDDLE');
    if (!urgentBatNeed) return null;

    const scoredIn = legalIncoming
      .filter((p) => !isBowlerOnly(p))
      .map((p) => ({
        player: p,
        score:
          getPlayerBat(p) +
          getPlayerImp(p) * 0.25 +
          (phase.includes('DEATH') && p.role === ROLES.FINISHER ? 12 : 0) +
          (pitch === PITCH_TYPES.SPIN_FRIENDLY && p.spinSkill ? (p.spinSkill - 75) * 0.3 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    if (scoredIn.length === 0) return null;

    // Sub out a pure bowler with lowest batting rating (who isn't sole WK)
    const eligibleOut = startingXI
      .filter((p) => !(isWicketkeeper(p) && xiWKs.length <= 1))
      .sort((a, b) => {
        const aPureBowl = !isBowlerOnly(a) ? 40 : 0;
        const bPureBowl = !isBowlerOnly(b) ? 40 : 0;
        return getPlayerBat(a) + aPureBowl - (getPlayerBat(b) + bPureBowl);
      });

    const outPlayer = eligibleOut[0];
    const inPlayer = scoredIn[0].player;
    if (!outPlayer || getPlayerBat(inPlayer) <= getPlayerBat(outPlayer) + 8) return null;

    return {
      incomingPlayer: inPlayer,
      outgoingPlayer: outPlayer,
      incomingCanonicalId: getCanonicalPlayerId(inPlayer),
      outgoingCanonicalId: getCanonicalPlayerId(outPlayer),
      reason: `Tactical batting Impact sub: ${inPlayer.name ?? inPlayer.playerName} replaces ${outPlayer.name ?? outPlayer.playerName}`,
    };
  }

  // Bowling / defending side looks for an extra phase/pitch bowler
  const urgentBowlNeed =
    phase.includes('DEATH') ||
    phase.includes('MIDDLE') ||
    requiredRate >= 8.5 ||
    wickets <= 5;
  if (!urgentBowlNeed) return null;

  const scoredIn = legalIncoming
    .filter((p) => isEligibleBowler(p))
    .map((p) => {
      const kind = classifyBowlerKind(p);
      let pitchBonus = 0;
      if (pitch === PITCH_TYPES.SPIN_FRIENDLY && kind === 'SPIN') pitchBonus += 10;
      if ((pitch === PITCH_TYPES.PACE_AND_BOUNCE || pitch === PITCH_TYPES.SWINGING) && kind === 'PACE') pitchBonus += 10;
      if (phase.includes('DEATH') && kind === 'PACE') pitchBonus += 6;
      return {
        player: p,
        score: getPlayerBowl(p) + getPlayerImp(p) * 0.25 + pitchBonus,
      };
    })
    .sort((a, b) => b.score - a.score);

  if (scoredIn.length === 0) return null;

  // Sub out a non-bowler (or weakest bowler only if >= 6 bowlers remain) without removing sole WK
  const eligibleOut = startingXI
    .filter((p) => {
      if (isWicketkeeper(p) && xiWKs.length <= 1) return false;
      if (isEligibleBowler(p) && xiBowlers.length <= SQUAD_RULES.MIN_BOWLERS_XI) return false;
      return true;
    })
    .sort((a, b) => {
      const aBowlPenalty = isEligibleBowler(a) ? 50 : 0;
      const bBowlPenalty = isEligibleBowler(b) ? 50 : 0;
      return getPlayerBowl(a) + aBowlPenalty - (getPlayerBowl(b) + bBowlPenalty);
    });

  const outPlayer = eligibleOut[0];
  const inPlayer = scoredIn[0].player;
  if (!outPlayer || getPlayerBowl(inPlayer) <= getPlayerBowl(outPlayer) + 8) return null;

  return {
    incomingPlayer: inPlayer,
    outgoingPlayer: outPlayer,
    incomingCanonicalId: getCanonicalPlayerId(inPlayer),
    outgoingCanonicalId: getCanonicalPlayerId(outPlayer),
    reason: `Tactical bowling Impact sub: ${inPlayer.name ?? inPlayer.playerName} replaces ${outPlayer.name ?? outPlayer.playerName}`,
  };
}

function isBowlerOnly(p) {
  const role = String(p?.role ?? '').toUpperCase();
  return role === ROLES.PACE || role === ROLES.SPIN || role === ROLES.BOWL;
}

export function serializeLeagueState(league) {
  return JSON.stringify(league);
}

export function restoreLeagueState(serialized) {
  const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : structuredClone(serialized);
  if (!parsed || !parsed.userTeam || !Array.isArray(parsed.opponentTeams)) {
    throw new Error('Invalid serialized league state.');
  }
  return parsed;
}

/**
 * Repairs any canonical duplicates or overseas/squad violations on AI teams
 * while keeping league.userTeam completely untouched.
 * @param {any} league
 * @param {any[]} [playerPool]
 * @param {number} [seed]
 */
export function repairAIDuplicates(league, playerPool = [], seed = 1) {
  const next = restoreLeagueState(serializeLeagueState(league));
  const claimed = new Set();

  // User team owns its squad unconditionally
  for (const p of next.userTeam.squad ?? []) {
    claimed.add(getCanonicalPlayerId(p));
  }

  const poolByCanonical = new Map();
  for (const p of playerPool) {
    const cid = getCanonicalPlayerId(p);
    if (!cid) continue;
    const prev = poolByCanonical.get(cid);
    if (!prev || getPlayerOvr(p) > getPlayerOvr(prev)) {
      poolByCanonical.set(cid, { ...p, canonicalId: cid });
    }
  }

  next.opponentTeams = next.opponentTeams.map((team, idx) => {
    const teamSeed = (Number(seed) || 1) + (idx + 1) * 131;
    const squad = [];
    const seenLocal = new Set();
    let osCount = 0;
    let changed = false;

    for (const p of team.squad ?? []) {
      const cid = getCanonicalPlayerId(p);
      const osOverflow = Boolean(p.isOverseas) && osCount >= SQUAD_RULES.MAX_OVERSEAS_SQUAD;
      if (!claimed.has(cid) && !seenLocal.has(cid) && !osOverflow) {
        claimed.add(cid);
        seenLocal.add(cid);
        if (p.isOverseas) osCount += 1;
        squad.push(p);
      } else {
        changed = true;
      }
    }

    if (squad.length < SQUAD_RULES.SQUAD_SIZE) {
      changed = true;
      const candidates = [...poolByCanonical.values()]
        .filter((c) => !claimed.has(getCanonicalPlayerId(c)) && !seenLocal.has(getCanonicalPlayerId(c)))
        .sort((a, b) => {
          const aNative = a.franchise === team.id ? 12 : a.franchise === 'POOL' ? 6 : 0;
          const bNative = b.franchise === team.id ? 12 : b.franchise === 'POOL' ? 6 : 0;
          return getPlayerOvr(b) + bNative - (getPlayerOvr(a) + aNative);
        });

      for (const cand of candidates) {
        if (squad.length >= SQUAD_RULES.SQUAD_SIZE) break;
        if (cand.isOverseas && osCount >= SQUAD_RULES.MAX_OVERSEAS_SQUAD) continue;
        const needWK = squad.filter(isWicketkeeper).length < 1;
        const needBowlers = squad.filter(isEligibleBowler).length < 5;
        const slotsLeft = SQUAD_RULES.SQUAD_SIZE - squad.length;
        if (needWK && slotsLeft <= 1 && !isWicketkeeper(cand)) continue;
        if (needBowlers && slotsLeft <= 5 - squad.filter(isEligibleBowler).length && !isEligibleBowler(cand)) continue;
        const cid = getCanonicalPlayerId(cand);
        claimed.add(cid);
        seenLocal.add(cid);
        if (cand.isOverseas) osCount += 1;
        squad.push(cand);
      }

      let synthIdx = 1;
      while (squad.length < SQUAD_RULES.SQUAD_SIZE) {
        const needWK = squad.filter(isWicketkeeper).length < 1;
        const needBowlers = squad.filter(isEligibleBowler).length < 5;
        const role = needWK ? ROLES.WK : needBowlers ? ROLES.PACE : ROLES.MID_BAT;
        const synth = makeSyntheticUniqueReserve(team.id, role, synthIdx++, claimed);
        claimed.add(synth.canonicalId);
        seenLocal.add(synth.canonicalId);
        squad.push(synth);
      }
    }

    if (!changed) return team;

    const sel = selectMatchXIAndBench(squad, {
      pitch: team.homePitch ?? PITCH_TYPES.BALANCED,
      seed: teamSeed,
    });

    return {
      ...team,
      squad,
      startingXI: sel.startingXI,
      impactBench: sel.impactBench,
      captainId: sel.captainId,
      wicketkeeperId: sel.wicketkeeperId,
    };
  });

  return next;
}
