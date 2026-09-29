/* 作品ごとの設定。 */
(typeof window !== 'undefined' ? window : globalThis).ADV_CONFIG = {

  // 作品ID（必須）。ブラウザに保存するものの名前の頭に付く。
  id: 'kaerimichi',

  title: 'かえりみち',
  subtitle: 'KAERIMICHI',

  // game/scenario/ から読み込むファイル（拡張子なし）。この順に読み込む
  files: [
    'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08',
    'ch09', 'ch10', 'ch11', 'ch12', 'ch13', 'ch14', 'ch15',
    'ed01', 'ed02', 'ed03', 'ed04', 'ed05', 'ed06', 'ed07', 'ed08'
  ],
  start: 'ch01',

  // パラメータ。init：初期値、min / max：範囲
  vars: {
    p1: { init: 0, min: 0, max: 40 },
    p2: { init: 0, min: 0, max: 40 },
    p3: { init: 0, min: 0, max: 40 },
    f1: { init: 0, min: 0, max: 1 }
  },

  endings: {
    main: {
      ed01: 'みちしるべ',
      ed02: '嘘の魔王',
      ed03: '語り部',
      ed04: '千秋楽',
      ed05: 'つづきの頁',
      ed06: '晴天'
    },
    extra: {
      ed07: 'とこよみち',
      ed08: '幕引き'
    },
    extraUnlock: 'all-main'
  },

  name: { ask: true, max: 10, default: '名無し', prompt: 'あなたの名前を入力してください。' },

  selfMark: '▷',

  saveSlots: 11,
  endMark: '終',

  bgm: { dir: 'assets/bgm/', ext: ['.mp3', '.ogg', '.wav'], fadeMs: 1500 },

  // 記録（画面での名前は label）
  records: { enabled: true, file: 'records', label: '記録帳', toast: '記録帳に一件、加わりました' },

  commands: [],

  tools: {
    targets: { main: 7000, ending: 3500, extra: 6000, tolerance: 0.15 },
    toneWords: ['敬語', '口調', '声で', '調子で'],
    similar: 0.5,
    maxStates: 200000
  }
};
