/* 作品ごとの設定。 */
(typeof window !== 'undefined' ? window : globalThis).ADV_CONFIG = {

  // 作品ID（必須）。ブラウザに保存するものの名前の頭に付く
  id: 'kadv12',

  title: 'くびったけ',
  subtitle: 'KUBITTAKE',

  // game/scenario/ から読み込むファイル（拡張子なし）。この順に読み込む
  files: [
    'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08',
    'ch09', 'ch10', 'ch11', 'ch12', 'ch13', 'ch14', 'ch15',
    'ed01', 'ed02', 'ed03', 'ed04', 'ed05', 'ed06', 'ed07', 'ed08'
  ],
  start: 'ch01',

  // パラメータ。init：初期値、min / max：範囲
  vars: {
    p1: { init: 0, min: 0, max: 30 },
    p2: { init: 0, min: 0, max: 30 },
    p3: { init: 0, min: 0, max: 30 }
  },

  endings: {
    main: {
      ed01: 'あいのり',
      ed02: 'たづな',
      ed03: 'わだち',
      ed04: 'ちりん',
      ed05: 'しおまち',
      ed06: 'しおどき'
    },
    extra: {
      ed07: 'うみなり',
      ed08: 'あいかぎ'
    },
    extraUnlock: 'all-main'
  },

  name: { ask: true, max: 10, default: '澪', prompt: '先輩の名前を入力してください。' },

  selfMark: '▷',

  saveSlots: 11,
  endMark: '終',

  bgm: { dir: 'assets/bgm/', ext: ['.mp3', '.ogg', '.wav'], fadeMs: 1500 },

  // 記録（メニュー名は effects.js で差し替える）
  records: { enabled: true, file: 'records', toast: '運行日誌に一枚、加わりました' },

  commands: [],

  tools: {
    targets: { main: 7000, ending: 3500, extra: 6000, tolerance: 0.15 },
    toneWords: ['敬語', '口調', '声で', '調子で'],
    similar: 0.5,
    maxStates: 200000
  }
};
