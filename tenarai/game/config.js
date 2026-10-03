/* 作品ごとの設定。記号の対応は docs/secret/notes.md（非公開）。 */
(typeof window !== 'undefined' ? window : globalThis).ADV_CONFIG = {

  id: 'kadv15',

  title: 'てならい',
  subtitle: 'TENARAI',

  files: [
    'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08',
    'ch09', 'ch10', 'ch11', 'ch12', 'ch13', 'ch14', 'ch15',
    'ed01', 'ed02', 'ed03', 'ed04', 'ed05', 'ed06', 'ed07', 'ed08'
  ],
  start: 'ch01',

  vars: {
    p1: { init: 0, min: 0, max: 30 },
    p2: { init: 0, min: 0, max: 30 },
    p3: { init: 0, min: 0, max: 30 }
  },

  endings: {
    main: {
      ed01: 'むすびめ',
      ed02: 'てほどき',
      ed03: 'はつのあさ',
      ed04: 'かざりもの',
      ed05: 'こづつみ',
      ed06: 'おやすみ'
    },
    extra: {
      ed07: 'あいのゆめ',
      ed08: 'かいしゅう'
    },
    extraUnlock: 'all-main'
  },

  name: { ask: true, max: 10, default: '名無し', prompt: 'あなたの名前を入力してください。' },

  selfMark: '▷',

  saveSlots: 11,
  endMark: '終',

  bgm: { dir: 'assets/bgm/', ext: ['.mp3', '.ogg', '.wav'], fadeMs: 1500 },

  // 記録。画面での名前は effects.js で「帳面」に差し替える
  records: { enabled: true, file: 'records', toast: '帳面の頁が一枚、増えました' },

  gameovers: {
    enabled: false,
    label: 'ゲームオーバー一覧',
    screenText: 'GAME OVER',
    retryLabel: '直前の選択肢からやり直す',
    list: [],
    alt: { enabled: false, toA: '版Aを見る', toB: '版Bを見る' }
  },

  commands: [],

  tools: {
    targets: { main: 7000, ending: 3500, extra: 6000, gameover: 1500, tolerance: 0.15 },
    toneWords: ['敬語', '口調', '声で', '調子で'],
    similar: 0.5,
    maxStates: 400000
  }
};
