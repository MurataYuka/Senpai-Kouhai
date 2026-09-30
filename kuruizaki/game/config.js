/* 作品ごとの設定。新しい作品を始めたら、まず id を書き換える。 */
(typeof window !== 'undefined' ? window : globalThis).ADV_CONFIG = {

  // 作品ID（必須）。ブラウザに保存するものの名前の頭に付く（例：adv-sample.save01）。
  // 英数字・ハイフン・下線だけ。作品ごとに必ず別の値にする。空のままだと起動時にエラーになる。
  id: 'adv-sample',

  title: 'サンプル',
  subtitle: 'SAMPLE',

  // game/scenario/ から読み込むファイル（拡張子なし）。この順に読み込む
  files: ['ch01', 'ch02', 'ed01', 'ed02'],
  start: 'ch01',

  // パラメータ。init：初期値、min / max：範囲（省略可。範囲外は丸める）
  vars: {
    p1: { init: 0 },
    p2: { init: 0 }
  },

  endings: {
    // 本編エンディング：一覧に並ぶ。未回収は「？？？」
    main: {
      ed01: 'サンプル終幕一',
      ed02: 'サンプル終幕二'
    },
    // 追加エンディング：解放条件を満たすと一覧に出る（通常プレイでは到達しない）
    extra: {},
    // 解放条件：'all-main'（本編を全回収）／ ['ed01', 'ed02'] のような配列／ function (got) { return ...; }
    extraUnlock: 'all-main'
  },

  // 名前入力。ask: false にすると入力画面を出さず default を使う
  name: { ask: true, max: 10, default: '名無し', prompt: 'あなたの名前を入力してください。' },

  // この文字で始まる行を主人公の発言として表示する（色が変わる）。使わないなら ''
  selfMark: '▷',

  saveSlots: 11,
  endMark: '終',

  // 曲：@bgm 名前 で dir + 名前 + ext を順に試す。ファイルが無ければ無音で続ける
  bgm: { dir: 'assets/bgm/', ext: ['.mp3', '.ogg', '.wav'], fadeMs: 1500 },

  // 任意機能「記録」。enabled: true で有効（game/scenario/records.js を読み込み、メニューに「記録」が出る）
  records: { enabled: false, file: 'records', toast: '記録が追加されました' },

  // 作品独自の @命令 の名前（処理は game/effects.js の commands に書く）
  commands: ['glow'],

  // 点検スクリプトの設定
  tools: {
    targets: { main: 7000, ending: 3500, extra: 6000, tolerance: 0.15 },
    toneWords: ['敬語', '口調', '声で', '調子で'],
    similar: 0.5,          // 選択肢の似ている度合い（0〜1）。これ以上を一覧に出す
    maxStates: 200000      // 到達確認で調べる状態数の上限
  }
};
