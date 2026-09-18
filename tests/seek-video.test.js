// seekVideo()는 MP4→APNG 변환의 requestVideoFrameCallback 미지원 브라우저(사파리 등)
// 폴백 경로(extractMp4FramesSeek)에서 프레임마다 video.currentTime을 옮기고 'seeked'
// 이벤트를 기다리는 데 쓰인다. 기존 구현은 'seeked'만 기다렸기 때문에, 탐색 도중
// 디코더가 깨져 'error' 이벤트가 발생하면 Promise가 영영 settle되지 않아
// extractMp4FramesSeek의 for 루프 안 await가 무한히 멈추고, 이를 감싸는 변환 버튼
// 핸들러(try/catch + alert)까지도 실행되지 못해 "변환 중..." 상태로 굳어버렸다.
// 이 테스트는 'error' 이벤트가 rejection으로 이어지는지, 그리고 두 리스너가 모두
// 정리되는지를 검증한다.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFunctionsFromHtml } = require('../scripts/extract-inline-fn');

const HTML_PATH = path.join(__dirname, '..', 'Cocofolia_Setter.html');

function fakeVideo() {
  const listeners = { seeked: [], error: [] };
  return {
    currentTime: 0,
    addEventListener(evt, fn) { listeners[evt].push(fn); },
    removeEventListener(evt, fn) {
      listeners[evt] = listeners[evt].filter((f) => f !== fn);
    },
    _fire(evt) { listeners[evt].slice().forEach((fn) => fn()); },
    _listenerCount(evt) { return listeners[evt].length; },
  };
}

test('seekVideo: seeked 이벤트가 오면 정상적으로 resolve된다', async () => {
  const sandbox = loadFunctionsFromHtml(HTML_PATH, ['seekVideo'], {});
  const video = fakeVideo();

  const p = sandbox.seekVideo(video, 1.5);
  assert.equal(video.currentTime, 1.5);
  video._fire('seeked');
  await assert.doesNotReject(p);

  assert.equal(video._listenerCount('seeked'), 0, 'resolve 후 seeked 리스너가 정리되어야 한다');
  assert.equal(video._listenerCount('error'), 0, 'resolve 후 error 리스너도 정리되어야 한다');
});

test('seekVideo: error 이벤트가 오면 hang되지 않고 reject된다', async () => {
  const sandbox = loadFunctionsFromHtml(HTML_PATH, ['seekVideo'], {});
  const video = fakeVideo();

  const p = sandbox.seekVideo(video, 2.0);
  video._fire('error');

  await assert.rejects(p, /영상 탐색 중 오류/);
  assert.equal(video._listenerCount('seeked'), 0, 'reject 후 seeked 리스너가 정리되어야 한다');
  assert.equal(video._listenerCount('error'), 0, 'reject 후 error 리스너도 정리되어야 한다');
});
