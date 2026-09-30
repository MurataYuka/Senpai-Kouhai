/* 作品ごとの設定。 */
(typeof window !== 'undefined' ? window : globalThis).ADV_CONFIG = {

  // 作品ID（必須）。ブラウザに保存するものの名前の頭に付く
  id: 'kadv09',

  title: 'むこうぎし',
  subtitle: 'MUKOUGISHI',

  // game/scenario/ から読み込むファイル（拡張子なし）。この順に読み込む
  files: [
    'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08',
    'ch09', 'ch10', 'ch11', 'ch12', 'ch13', 'ch14', 'ch15',
    'ed01', 'ed02', 'ed03', 'ed04', 'ed05', 'ed06', 'ed07', 'ed08'
  ],
  start: 'ch01',

  // パラメータ。init：初期値、min / max：範囲
  vars: {
    p1: { init: 0, min: 0, max: 12 },
    p2: { init: 0, min: 0, max: 12 },
    p3: { init: 0, min: 0, max: 12 },
    f1: { init: 0, min: 0, max: 1 }
  },

  endings: {
    main: {
      ed01: 'あかいれ',
      ed02: 'つぎほ',
      ed03: 'はなぐるい',
      ed04: 'しゅうげん',
      ed05: 'おあずけ',
      ed06: 'かわむこう'
    },
    extra: {
      ed07: 'あけぼの',
      ed08: 'かりじし'
    },
    extraUnlock: 'all-main'
  },

  name: { ask: true, max: 10, default: '千景', prompt: '御堂の一人娘の名前を入力してください。' },

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
