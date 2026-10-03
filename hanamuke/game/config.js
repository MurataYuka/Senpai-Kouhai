/* 作品ごとの設定。 */
(typeof window !== 'undefined' ? window : globalThis).ADV_CONFIG = {

  // 作品ID（必須）。ブラウザに保存するものの名前の頭に付く
  id: 'kadv14',

  title: 'はなむけ',
  subtitle: 'HANAMUKE',

  // game/scenario/ から読み込むファイル（拡張子なし）。この順に読み込む
  files: [
    'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08',
    'ch09', 'ch10', 'ch11', 'ch12', 'ch13', 'ch14', 'ch15',
    'ed01', 'ed02', 'ed03', 'ed04', 'ed05', 'ed06', 'ed07', 'ed08',
    'g01a', 'g01b', 'g02a', 'g02b', 'g03a', 'g03b', 'g04a', 'g04b',
    'g05a', 'g05b', 'g06a', 'g06b', 'g07a', 'g07b', 'g08a', 'g08b',
    'g09a', 'g09b', 'g10a', 'g10b', 'g11a', 'g11b', 'g12a', 'g12b',
    'g13a', 'g13b', 'g14a', 'g14b'
  ],
  start: 'ch01',

  // パラメータ（意味は docs/secret/notes.md）
  vars: {
    p1: { init: 0, min: 0 },
    p2: { init: 0, min: 0 },
    p3: { init: 0, min: 0 },
    p4: { init: 0, min: 0, max: 3 }
  },

  endings: {
    main: {
      ed01: 'なふだ',
      ed02: 'ふせん',
      ed03: 'とこはな',
      ed04: 'かいぞえ',
      ed05: 'みおくり',
      ed06: 'はなあかり'
    },
    extra: {
      ed07: 'はなふぶき',
      ed08: 'おひらき'
    },
    extraUnlock: 'all-main'
  },

  name: { ask: true, max: 10, default: '名無し', prompt: 'あなたの名前を入力してください。' },

  selfMark: '▷',

  saveSlots: 11,
  endMark: '終',

  bgm: { dir: 'assets/bgm/', ext: ['.mp3', '.ogg', '.wav'], fadeMs: 1500 },

  // 記録（画面上の名前は effects.js で「席札」に差し替える）
  records: { enabled: true, file: 'records', toast: '席札が一枚、手元に増えました' },

  gameovers: {
    enabled: true,
    label: '思い出のアルバム',
    screenText: '末永く、お幸せに',
    retryLabel: '直前の選択肢からやり直す',
    list: [
      { id: 'g01', a: 'g01a', b: 'g01b', title: '頭上にご注意ください' },
      { id: 'g02', a: 'g02a', b: 'g02b', title: 'ゴンドラでのご登場' },
      { id: 'g03', a: 'g03a', b: 'g03b', title: 'ともしび' },
      { id: 'g04', a: 'g04a', b: 'g04b', title: '白いけむり' },
      { id: 'g05', a: 'g05a', b: 'g05b', title: 'はい、チーズ' },
      { id: 'g06', a: 'g06a', b: 'g06b', title: 'はじめての共同作業' },
      { id: 'g07', a: 'g07a', b: 'g07b', title: 'お色直し' },
      { id: 'g08', a: 'g08a', b: 'g08b', title: '冷やしておきます' },
      { id: 'g09', a: 'g09a', b: 'g09b', title: 'バージンロード' },
      { id: 'g10', a: 'g10a', b: 'g10b', title: '乾杯' },
      { id: 'g11', a: 'g11a', b: 'g11b', title: 'ブーケトス' },
      { id: 'g12', a: 'g12a', b: 'g12b', title: 'テープカット' },
      { id: 'g13', a: 'g13a', b: 'g13b', title: 'クラッカー' },
      { id: 'g14', a: 'g14a', b: 'g14b', title: 'せり上がり' }
    ],
    alt: {
      enabled: true,
      toA: '現実逃避',
      toB: '現実を見る'
    }
  },

  commands: [],

  tools: {
    targets: { main: 7000, ending: 3500, extra: 6000, gameover: 1500, tolerance: 0.15 },
    toneWords: ['敬語', '口調', '声で', '調子で'],
    similar: 0.5,
    maxStates: 400000
  }
};
