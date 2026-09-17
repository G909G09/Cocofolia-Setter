// deleteHistoryItem()/clearHistory()는 openHistoryDB()가 돌려준 IndexedDB 트랜잭션의
// tx.oncomplete에서만 resolve했고, tx.onerror/tx.onabort를 듣지 않았다. 트랜잭션이
// 실패(저장 공간 부족, 쓰기 도중 브라우저가 저장소 접근을 거둬가는 등)하면 그 Promise가
// 영영 settle되지 않아, 호출한 쪽(결과물 보관함의 "삭제"/"전체 삭제" 버튼)이 아무 반응도
// 보이지 못한 채 멈춰버렸다. 이 테스트는 트랜잭션이 실패하면 반드시 reject됨을 검증한다
// (실제 코드는 Cocofolia_Setter.html에서 그대로 추출해서 실행).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFunctionsFromHtml } = require('../scripts/extract-inline-fn');

const HTML_PATH = path.join(__dirname, '..', 'Cocofolia_Setter.html');

// deleteHistoryItem/clearHistory가 참조하는 openHistoryDB()와 HISTORY_STORE를 스텁으로
// 대체해, 실제 IndexedDB 없이도 트랜잭션 성공/실패 두 경로를 모두 재현한다.
function makeSandbox(shouldSucceed) {
  function fakeTx() {
    const tx = {};
    tx.objectStore = function () { return { delete: function () {}, clear: function () {} }; };
    Promise.resolve().then(function () {
      if (shouldSucceed) { if (tx.oncomplete) tx.oncomplete(); }
      else { tx.error = new Error('boom'); if (tx.onerror) tx.onerror(); }
    });
    return tx;
  }
  const fakeDb = { transaction: function () { return fakeTx(); } };
  return loadFunctionsFromHtml(HTML_PATH, ['deleteHistoryItem', 'clearHistory'], {
    HISTORY_STORE: 'results',
    openHistoryDB: function () { return Promise.resolve(fakeDb); },
  });
}

test('deleteHistoryItem: 트랜잭션이 성공하면 resolve된다', async () => {
  const sandbox = makeSandbox(true);
  await assert.doesNotReject(sandbox.deleteHistoryItem(1));
});

test('deleteHistoryItem: 트랜잭션이 실패(오류/중단)하면 영영 멈추지 않고 reject된다', async () => {
  const sandbox = makeSandbox(false);
  await assert.rejects(sandbox.deleteHistoryItem(1));
});

test('clearHistory: 트랜잭션이 성공하면 resolve된다', async () => {
  const sandbox = makeSandbox(true);
  await assert.doesNotReject(sandbox.clearHistory());
});

test('clearHistory: 트랜잭션이 실패(오류/중단)하면 영영 멈추지 않고 reject된다', async () => {
  const sandbox = makeSandbox(false);
  await assert.rejects(sandbox.clearHistory());
});
