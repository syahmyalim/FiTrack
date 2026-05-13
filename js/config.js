// ─────────────────────────────────────────
// CONFIG  —  constants & shared lookups
// ─────────────────────────────────────────

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbykoClCGJJFOKKrUORkLzdaFwLsikZvXLftqQg3yDg_09psCyqCBALY1weZQqLcs7x8KA/exec';

const DEFAULT_EXERCISES = [
  'Squat','Bench press','Deadlift','Overhead press','Barbell row',
  'Pull-up','Dumbbell curl','Tricep dip','Leg press','Lat pulldown',
  'Romanian deadlift','Incline bench','Cable fly','Face pull','Hip thrust','Lunges'
];

const SPORT_COL = {
  gym:   '#2C4A8C',
  run:   '#E8A020',
  swim:  '#7B5EA7',
  cycle: '#E06830',
  walk:  '#5A9E6F',
  other: '#6B7A8D'
};

const SPORT_ABR = {
  gym:   'GYM',
  run:   'RUN',
  swim:  'SWM',
  cycle: 'CYC',
  walk:  'WLK',
  other: 'OTH'
};

const DEFAULT_PROFILE = {
  age: 28,
  gender: 'male',
  height_cm: 175,
  weight_kg: 70,
  activity: '1.2',
  body_fat_pct: '',
  target_weight_kg: '',
  target_weeks: '4'
};
