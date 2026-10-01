/* 作品ごとの設定。 */
(typeof window !== 'undefined' ? window : globalThis).ADV_CONFIG = {

  // 作品ID（必須）。ブラウザに保存するものの名前の頭に付く。
  id: 'kadv13',

  title: 'まきもどし',
  subtitle: 'MAKIMODOSHI',

  // game/scenario/ から読み込むファイル（拡張子なし）。この順に読み込む
  files: [
    'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08',
    'ch09', 'ch10', 'ch11', 'ch12', 'ch13', 'ch14', 'ch15',
    'ed01', 'ed02', 'ed03', 'ed04', 'ed05', 'ed06', 'ed07', 'ed08'
  ],
  start: 'ch01',

  // パラメータ（対応表は非公開メモ）
  vars: {
    p1: { init: 0, min: 0 },
    p2: { init: 0, min: 0 },
    p3: { init: 0, min: 0 },
    f1: { init: 0, min: 0, max: 1 }
  },

  endings: {
    main: {
      ed01: 'くりかえし',
      ed02: 'かさねどり',
      ed03: 'つめおり',
      ed04: 'あしたのてんき',
      ed05: 'ひとまき',
      ed06: 'ゆけむり'
    },
    extra: {
      ed07: 'ふゆげしき',
      ed08: 'ちょうじり'
    },
    extraUnlock: 'all-main'
  },

  name: { ask: true, max: 10, default: '名無し', prompt: 'あなたの名前を入力してください。' },

  selfMark: '▷',

  saveSlots: 11,
  endMark: '終',

  bgm: { dir: 'assets/bgm/', ext: ['.mp3', '.ogg', '.wav'], fadeMs: 1500 },

  records: { enabled: true, file: 'records', toast: '記録が追加されました' },

  commands: [],

  tools: {
    targets: { main: 7000, ending: 3500, extra: 6000, tolerance: 0.15 },
    toneWords: ['敬語', '口調', '声で', '調子で'],
    similar: 0.5,
    maxStates: 200000
  }
};
