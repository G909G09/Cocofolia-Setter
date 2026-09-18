// extractMp4FramesFast의 onFrame은 브라우저가 requestVideoFrameCallback으로 직접 호출하는
// 콜백이라, 감싸는 async 함수의 호출 스택(과 그 바깥의 try/catch) 밖에서 실행된다.
// captureAt() 안의 캔버스 작업(getImageData 등)이 예외를 던지면 잡아줄 곳이 없어 이
// Promise가 영영 settle되지 않고 변환 버튼이 "변환 중..."에서 멈췄다. 이 테스트는 그
// 예외가 나면 반드시 reject됨을 검증한다(실제 코드는 Cocofolia_Setter.html에서 그대로
// 추출해서 실행).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFunctionsFromHtml } = require('../scripts/extract-inline-fn');

const HTML_PATH = path.join(__dirname, '..', 'Cocofolia_Setter.html');

function makeVideo(duration){
  const listeners = {};
  return {
    duration: duration,
    ended: false,
    playbackRate: 1,
    frameCb: null,
    paused: false,
    addEventListener(evt, cb){ listeners[evt] = cb; },
    removeEventListener(evt, cb){ if(listeners[evt] === cb) delete listeners[evt]; },
    set currentTime(_t){ if(listeners.seeked) listeners.seeked(); },
    get currentTime(){ return 0; },
    requestVideoFrameCallback(cb){ this.frameCb = cb; },
    play(){ return Promise.resolve(); },
    pause(){ this.paused = true; },
  };
}

function makeSandbox(getImageDataImpl){
  return loadFunctionsFromHtml(HTML_PATH, ['extractMp4FramesFast', 'seekVideo', 'applyChromaKeyG2A', 'clampInt'], {
    document: {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({
          clearRect(){},
          drawImage(){},
          getImageData: getImageDataImpl,
        }),
      }),
    },
  });
}

// extractMp4FramesFast는 seekVideo()의 await를 거친 뒤에야 requestVideoFrameCallback으로
// frameCb를 등록한다 — 그 등록은 await로 미뤄진 마이크로태스크 안에서 일어나므로, 함수를
// 호출한 직후 곧바로 video.frameCb를 부르면 아직 설정되어 있지 않다. 매크로태스크
// 경계(setImmediate)로 넘어가며 기다려 등록될 때까지 폴링한다.
function waitForFrameCallback(video){
  return new Promise((resolve) => {
    (function poll(){
      if (video.frameCb) return resolve();
      setImmediate(poll);
    })();
  });
}

test('extractMp4FramesFast: onFrame 콜백 안에서 캔버스 작업이 예외를 던지면 멈추지 않고 reject된다', async () => {
  const sandbox = makeSandbox(() => { throw new Error('getImageData boom'); });
  const video = makeVideo(10);

  const promise = sandbox.extractMp4FramesFast(video, 4, 4, 0, 1, [0], null, null, null);
  await waitForFrameCallback(video);
  video.frameCb(0, { mediaTime: 0 });

  await assert.rejects(promise, /getImageData boom/);
  assert.equal(video.paused, true);
});

test('extractMp4FramesFast: 정상적으로 프레임을 캡처하면 resolve된다', async () => {
  const sandbox = makeSandbox(() => ({ data: new Uint8ClampedArray(4 * 4 * 4) }));
  const video = makeVideo(10);

  const promise = sandbox.extractMp4FramesFast(video, 4, 4, 0, 1, [0], null, null, null);
  await waitForFrameCallback(video);
  video.frameCb(0, { mediaTime: 5 });

  const frames = await promise;
  assert.equal(frames.length, 1);
});
