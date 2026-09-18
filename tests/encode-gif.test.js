// gif.js.optimized는 'error' 이벤트를 내보내지 않고, render()가 spawnWorkers()로 만든
// Worker에도 onerror를 걸어두지 않는다 — CSP가 blob: Worker 생성을 막거나 워커 내부에서
// 예외가 나면 finished/abort 어느 쪽도 발생하지 않아 encodeGif()의 Promise가 영영
// settle되지 않았다(변환 버튼이 "변환 중..."에서 멈춤). 이 테스트는 render() 직후 생성된
// Worker에서 onerror가 발생하면 반드시 reject되고 워커가 정리됨을 검증한다
// (실제 코드는 Cocofolia_Setter.html에서 그대로 추출해서 실행).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFunctionsFromHtml } = require('../scripts/extract-inline-fn');

const HTML_PATH = path.join(__dirname, '..', 'Cocofolia_Setter.html');

// gif.js.optimized의 render()는 spawnWorkers()를 동기적으로 호출해 Worker들을
// freeWorkers 배열에 채운 뒤 돌아온다. 이 스텁도 같은 타이밍을 그대로 재현한다.
function makeSandbox(){
  const created = [];

  function FakeWorker(){
    this.terminated = false;
    this.onerror = null;
    this.terminate = () => { this.terminated = true; };
  }

  function FakeGif(options){
    this.options = options;
    this.freeWorkers = [];
    this.activeWorkers = [];
    this._handlers = {};
    this.addFrame = () => {};
    this.on = (evt, cb) => { this._handlers[evt] = cb; };
    this.render = () => { this.freeWorkers.push(new FakeWorker()); };
    created.push(this);
  }

  const sandbox = loadFunctionsFromHtml(HTML_PATH, ['encodeGif', 'terminateGifWorkers', { type: 'var', name: '_gifWorkerUrl' }, 'getGifWorkerUrl'], {
    window: { GIF: FakeGif },
    document: { getElementById: () => ({ textContent: '' }) },
    URL: { createObjectURL: () => 'blob:fake' },
    Blob: function(){},
  });
  sandbox.__created = created;
  return sandbox;
}

test('encodeGif: 워커에서 onerror가 발생하면 finished/abort 없이도 멈추지 않고 reject되며 워커가 정리된다', async () => {
  const sandbox = makeSandbox();
  const promise = sandbox.encodeGif([], [], 10, 10, false);
  const gif = sandbox.__created[sandbox.__created.length - 1];
  assert.equal(gif.freeWorkers.length, 1);

  gif.freeWorkers[0].onerror(new Error('worker crashed'));

  await assert.rejects(promise);
  assert.equal(gif.freeWorkers[0].terminated, true);
});

test('encodeGif: finished 이벤트가 오면 정상적으로 resolve되고 워커가 정리된다', async () => {
  const sandbox = makeSandbox();
  const promise = sandbox.encodeGif([], [], 10, 10, false);
  const gif = sandbox.__created[sandbox.__created.length - 1];

  gif._handlers.finished('blob-stub');

  assert.equal(await promise, 'blob-stub');
  assert.equal(gif.freeWorkers[0].terminated, true);
});

test('encodeGif: finished 이후에 워커 onerror가 뒤늦게 발생해도 이미 resolve된 결과를 뒤집지 않는다', async () => {
  const sandbox = makeSandbox();
  const promise = sandbox.encodeGif([], [], 10, 10, false);
  const gif = sandbox.__created[sandbox.__created.length - 1];

  gif._handlers.finished('blob-stub');
  gif.freeWorkers[0].onerror(new Error('late error'));

  assert.equal(await promise, 'blob-stub');
});
