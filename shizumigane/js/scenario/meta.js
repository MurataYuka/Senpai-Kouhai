/* meta.js — 共通の表示データ（名簿・回収一覧） */
(function (SZ) {
  'use strict';
  SZ.meta.start = 'ch01_s1';
  SZ.meta.defName = '真澄';

  // 状態欄の名簿。m_01 は主人公（入力した名前）
  SZ.meta.members = [
    { id: 'm_01', full: null, short: null },
    { id: 'm_02', full: '水無瀬 透', short: '水無瀬' },
    { id: 'm_03', full: '榊 修一', short: '榊' },
    { id: 'm_04', full: '小野寺 千景', short: '小野寺' },
    { id: 'm_05', full: '森岡 大吾', short: '森岡' },
    { id: 'm_06', full: '日比野 あゆみ', short: '日比野' },
    { id: 'm_07', full: '宇津木 源治', short: '宇津木' }
  ];

  // 回収一覧。名前は回収済みのときだけ画面に出す
  SZ.meta.ends = [
    ['end_01', 'みつけた'],
    ['end_02', '湛水'],
    ['end_03', '呼ばれた子'],
    ['end_04', '返事'],
    ['end_05', '居残り'],
    ['end_06', 'ずっといっしょ']
  ];
  SZ.meta.xs = ['x_01', 'x_02', 'x_03', 'x_04', 'x_05'];
})(SZ);
