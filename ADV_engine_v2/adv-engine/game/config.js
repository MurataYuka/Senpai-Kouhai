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

  // 任意機能「ゲームオーバー」。enabled: true で有効（タイトル画面とメニューに一覧が出る）。
  // list の各ファイル（a / b）は files にも並べる。本文では @gameover g01（版A）／ @gameover g01 b（版B）で入り、ファイルの最後は @over で終える
  gameovers: {
    enabled: false,
    label: 'ゲームオーバー一覧',      // タイトル画面・メニューに出る一覧の名前
    screenText: 'GAME OVER',          // ゲームオーバー画面に出す文字
    retryLabel: '直前の選択肢からやり直す',
    list: [
      // id：識別子（g01, g02 …）／ a：版Aのファイル名 ／ b：版Bのファイル名（省略可。無ければ版Aを使う）／ title：一覧に出す名前
      { id: 'g01', a: 'g01a', b: 'g01b', title: '見出し' }
    ],
    // 版の切り替え：@altopen に到達すると、一覧での再生が版Bに切り替わり、一覧に切り替えボタンが出る
    alt: {
      enabled: false,
      toA: '版Aを見る',               // 版Bを見ているときのボタンの文言
      toB: '版Bを見る'                // 版Aを見ているときのボタンの文言
    }
  },

  // 作品独自の @命令 の名前（処理は game/effects.js の commands に書く）
  commands: ['glow'],

  // 点検スクリプトの設定
  tools: {
    targets: { main: 7000, ending: 3500, extra: 6000, gameover: 1500, tolerance: 0.15 },
    toneWords: ['敬語', '口調', '声で', '調子で'],
    similar: 0.5,          // 選択肢の似ている度合い（0〜1）。これ以上を一覧に出す
    maxStates: 200000      // 到達確認で調べる状態数の上限
  }
};

// ---- ここからダミー専用（作品ではこの行から下を消す） ----
// gameovers.enabled を true にしたときだけ、ダミーのゲームオーバー（g01a / g01b）を files に足す。
// ダミーの ch01 / ch02 も同じ設定を見て、ゲームオーバーの選択肢と @altopen を出し入れしている。
(function (c) { if (c.gameovers.enabled) c.files.push('g01a', 'g01b'); })((typeof window !== 'undefined' ? window : globalThis).ADV_CONFIG);
