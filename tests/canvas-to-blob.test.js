// canvas.toBlob()은 캔버스가 너무 크거나 오염된 경우 콜백에 null을 넘길 수 있다.
// canvasToBlob()은 이 경우 cb를 아예 호출하지 않고 alert만 띄운다 — 파일 한 장을 바로
// 다운로드하는 곳에서는 문제없지만, 배치 처리에서
//   new Promise(function(res){ canvasToBlob(canvas, function(blob){ ...; res(); }); })
// 형태로 감싸면 실패한 한 장 때문에 그 Promise가 영영 settle되지 않아 Promise.all()
// 전체가 멈춰버린다(이미 성공한 나머지 이미지까지 함께 사라짐). canvasToBlobOrNull()은
// blob이 null이어도 항상 콜백을 호출해 이 문제를 피한다 — 이 테스트는 그 계약을
// 직접 검증한다(실제 코드는 Cocofolia_Setter.html에서 그대로 추출해서 실행).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFunctionsFromHtml } = require('../scripts/extract-inline-fn');

const HTML_PATH = path.join(__dirname, '..', 'Cocofolia_Setter.html');

function fakeCanvas(shouldSucceed) {
  return {
    toBlob(cb) {
      // 실제 canvas.toBlob처럼 비동기(마이크로태스크)로 콜백을 호출한다.
      Promise.resolve().then(() => cb(shouldSucceed ? { size: 123, fake: true } : null));
    },
  };
}

test('canvasToBlob: 실패 시(blob===null) alert만 띄우고 콜백은 호출하지 않는다', async () => {
  const alerts = [];
  const sandbox = loadFunctionsFromHtml(HTML_PATH, ['canvasToBlob'], { alert: (msg) => alerts.push(msg) });

  let called = false;
  sandbox.canvasToBlob(fakeCanvas(false), () => { called = true; });
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(called, false, 'blob이 null이면 콜백이 호출되면 안 된다(기존 계약)');
  assert.equal(alerts.length, 1);
});

test('canvasToBlobOrNull: 실패해도(blob===null) 반드시 콜백을 호출한다 (배치 처리용 계약)', async () => {
  const sandbox = loadFunctionsFromHtml(HTML_PATH, ['canvasToBlobOrNull'], {});

  let receivedArgs = null;
  sandbox.canvasToBlobOrNull(fakeCanvas(false), (blob) => { receivedArgs = blob; });
  await new Promise((r) => setTimeout(r, 0));

  // 콜백이 호출됐다는 사실 자체가 핵심 — canvasToBlob()이었다면 이 시점에도 여전히
  // receivedArgs는 null 대입 전 초기값(undefined 아님, null 자체 아님)인 채로 멈춰 있었을 것.
  assert.notEqual(receivedArgs, undefined);
  assert.equal(receivedArgs, null);
});

test('배치 패턴: canvasToBlobOrNull을 쓰면 일부 항목이 실패해도 Promise.all()이 멈추지 않는다', async () => {
  const sandbox = loadFunctionsFromHtml(HTML_PATH, ['canvasToBlobOrNull'], {});
  const canvases = [fakeCanvas(true), fakeCanvas(false), fakeCanvas(true), fakeCanvas(false)];
  const failed = [];

  const pending = canvases.map((canvas, i) => new Promise((res) => {
    sandbox.canvasToBlobOrNull(canvas, (blob) => {
      if (!blob) failed.push('item' + i);
      res(blob);
    });
  }));

  // Promise.race로 "일정 시간 안에 전부 resolve되지 않으면 타임아웃" 형태로 검증해,
  // 회귀가 생기면(다시 canvasToBlob으로 되돌아가면) 이 테스트 자체가 멈추는 대신
  // 명확히 실패하도록 한다.
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Promise.all timed out — 배치 처리가 멈췄습니다')), 500));
  const results = await Promise.race([Promise.all(pending), timeout]);

  assert.equal(results.length, 4);
  assert.deepEqual(failed, ['item1', 'item3']);
  assert.equal(results.filter(Boolean).length, 2, '성공한 2장은 blob을 그대로 받아야 한다');
});
