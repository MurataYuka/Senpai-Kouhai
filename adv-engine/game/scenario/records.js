/* 任意機能「記録」の中身。config.records.enabled が true のときだけ読み込まれる。
   識別子は r01, r02 … の記号にする。本文の @record r01 で解放される。 */
ADV.addRecords({
  r01: {
    title: 'サンプル記録',
    body: '記録の本文です。\n改行で段落を分けられます。'
  }
});
