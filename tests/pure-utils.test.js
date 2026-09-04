// Cocofolia_Setter.html 안에 정의된 순수 유틸 함수들(DOM에 의존하지 않는 것들)이
// 실제로 배포되는 파일 그대로 의도한 대로 동작하는지 확인한다. 별도 모듈로 복제하지
// 않고 배포 파일에서 소스를 직접 추출해 실행하므로, 이 파일을 고치지 않고 앱 코드만
// 고쳐도(혹은 그 반대여도) 테스트가 실제 동작 변화를 그대로 감지한다.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFunctionsFromHtml } = require('../scripts/extract-inline-fn');

const HTML_PATH = path.join(__dirname, '..', 'Cocofolia_Setter.html');

const sandbox = loadFunctionsFromHtml(HTML_PATH, [
  'clampInt',
  'baseName',
  'fmtSec',
  'escHtml',
  'escapeRegExp',
  'sanitizeFilename',
  'ensureExtension',
  'uniqueZipName',
  // guessGmName은 최상위 상수 GM_NAME_ALIASES를 참조하므로 그 선언도 함께 로드한다.
  { type: 'var', name: 'GM_NAME_ALIASES' },
  'guessGmName',
]);

test('clampInt: 범위 안/밖 값을 올바르게 자른다', () => {
  assert.equal(sandbox.clampInt(5, 0, 10), 5);
  assert.equal(sandbox.clampInt(-1, 0, 10), 0);
  assert.equal(sandbox.clampInt(11, 0, 10), 10);
});

test('baseName: 확장자를 제거하고, 확장자가 없으면 그대로 돌려준다', () => {
  assert.equal(sandbox.baseName('저주받은 저택[all].html'), '저주받은 저택[all]');
  assert.equal(sandbox.baseName('archive.tar.gz'), 'archive.tar');
  assert.equal(sandbox.baseName('노확장자'), '노확장자');
});

test('fmtSec: 밀리초를 초 단위 문자열로 바꾼다', () => {
  assert.equal(sandbox.fmtSec(1500), '1.50초');
  assert.equal(sandbox.fmtSec(0), '0.00초');
});

test('escHtml: HTML 특수문자를 이스케이프해 innerHTML 삽입 시 안전하게 만든다', () => {
  assert.equal(sandbox.escHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(sandbox.escHtml("a & b's <tag>"), 'a &amp; b&#39;s &lt;tag&gt;');
});

test('escapeRegExp: 정규식 특수문자를 리터럴로 이스케이프한다', () => {
  const escaped = sandbox.escapeRegExp('a.b*c?[d]');
  assert.equal(new RegExp('^' + escaped + '$').test('a.b*c?[d]'), true);
  assert.equal(new RegExp('^' + escaped + '$').test('aXbXcXXd'), false);
});

test('sanitizeFilename: 경로 구분자 등 위험한 문자를 밑줄로 바꾼다', () => {
  assert.equal(sandbox.sanitizeFilename('a/b\\c:d*e?f"g<h>i|j'), 'a_b_c_d_e_f_g_h_i_j');
  assert.equal(sandbox.sanitizeFilename('  '), 'download');
  assert.equal(sandbox.sanitizeFilename(''), 'download');
  assert.equal(sandbox.sanitizeFilename('정상파일명.png'), '정상파일명.png');
});

test('ensureExtension: 확장자가 없거나 다르면 붙이고, 이미 있으면 그대로 둔다', () => {
  assert.equal(sandbox.ensureExtension('cutin', 'mp3'), 'cutin.mp3');
  assert.equal(sandbox.ensureExtension('cutin.mp3', 'mp3'), 'cutin.mp3');
  assert.equal(sandbox.ensureExtension('cutin.MP3', 'mp3'), 'cutin.MP3');
  assert.equal(sandbox.ensureExtension('cutin.wav', 'mp3'), 'cutin.wav.mp3');
  // 확장자에 정규식 특수문자가 섞여 있어도(예: 이론상 'c++') 안전하게 매칭돼야 한다.
  assert.equal(sandbox.ensureExtension('name', ''), 'name');
});

test('uniqueZipName: ZIP 안에서 파일명이 겹치면 (2), (3)... 을 붙여 구분한다', () => {
  const used = new Set();
  assert.equal(sandbox.uniqueZipName(used, 'a.png'), 'a.png');
  assert.equal(sandbox.uniqueZipName(used, 'a.png'), 'a (2).png');
  assert.equal(sandbox.uniqueZipName(used, 'a.png'), 'a (3).png');
  assert.equal(sandbox.uniqueZipName(used, 'b.png'), 'b.png');
});

test('guessGmName: GM 지칭 표기가 있으면 그 이름을, 없으면 빈도 1위를 고른다', () => {
  assert.equal(sandbox.guessGmName(['플레이어A', '키퍼', '플레이어B']), '키퍼');
  assert.equal(sandbox.guessGmName(['플레이어A', '플레이어B']), '플레이어A');
  assert.equal(sandbox.guessGmName([]), null);
});

const sandbox2 = loadFunctionsFromHtml(HTML_PATH, [
  'deriveLogBaseName',
  'officialDbBuild',
  'powerSetIndices',
  'isJPChar',
  // splitRuns는 같은 스코프의 isJPChar를 호출하므로 함께 로드한다.
  'splitRuns',
  'uniqueCfLabel',
]);

test('deriveLogBaseName: 확장자와 [all]/[main]/_main 표시를 떼어내고, 빈 값은 "로그"로 대체한다', () => {
  assert.equal(sandbox2.deriveLogBaseName('저주받은 저택[all].html'), '저주받은 저택');
  assert.equal(sandbox2.deriveLogBaseName('제목_main.html'), '제목');
  assert.equal(sandbox2.deriveLogBaseName('제목[main].html'), '제목');
  assert.equal(sandbox2.deriveLogBaseName(''), '로그');
  assert.equal(sandbox2.deriveLogBaseName(undefined), '로그');
});

// sandbox2는 별도의 vm 컨텍스트(realm)라서 그 안에서 만든 객체/배열은 Object/Array
// 프로토타입이 이 파일의 것과 달라 assert.deepEqual(strict)이 "구조는 같지만 참조가
// 다르다"며 실패한다. JSON 왕복으로 이 파일의 realm에 속한 순수 객체로 옮긴 뒤 비교한다.
const toHostRealm = (v) => JSON.parse(JSON.stringify(v));

test('officialDbBuild: CoC 7판 공식 Damage Bonus/Build 표 경계값을 정확히 찾는다', () => {
  assert.deepEqual(toHostRealm(sandbox2.officialDbBuild(64)), {db:'-2', build:'-2'});
  assert.deepEqual(toHostRealm(sandbox2.officialDbBuild(65)), {db:'-1', build:'-1'});
  assert.deepEqual(toHostRealm(sandbox2.officialDbBuild(124)), {db:'0', build:'0'});
  assert.deepEqual(toHostRealm(sandbox2.officialDbBuild(125)), {db:'+1D4', build:'1'});
  assert.deepEqual(toHostRealm(sandbox2.officialDbBuild(444)), {db:'+4D6', build:'5'});
  // 표 범위(~444)를 넘어서면 80씩 늘어날 때마다 주사위 개수/체구가 1씩 오른다
  assert.deepEqual(toHostRealm(sandbox2.officialDbBuild(445)), {db:'+5D6', build:'6'});
  assert.deepEqual(toHostRealm(sandbox2.officialDbBuild(524)), {db:'+5D6', build:'6'});
  assert.deepEqual(toHostRealm(sandbox2.officialDbBuild(525)), {db:'+6D6', build:'7'});
});

test('powerSetIndices: n개 인덱스의 부분집합을 중복/누락 없이 2^n개 만든다', () => {
  const setOf = (subsets) => toHostRealm(subsets).map((s) => s.slice().sort().join(',')).sort();
  assert.deepEqual(setOf(sandbox2.powerSetIndices(0)), ['']);
  assert.deepEqual(setOf(sandbox2.powerSetIndices(2)), ['', '0', '0,1', '1']);
  assert.equal(sandbox2.powerSetIndices(3).length, 8);
});

test('isJPChar/splitRuns: 가나(히라가나/가타카나)·한자는 일본어, 한글·영문은 아니다로 판별하고 구간을 나눈다', () => {
  assert.equal(sandbox2.isJPChar('가'), false);
  assert.equal(sandbox2.isJPChar('あ'), true);
  assert.equal(sandbox2.isJPChar('ア'), true);
  assert.equal(sandbox2.isJPChar('a'), false);
  assert.deepEqual(toHostRealm(sandbox2.splitRuns('한글あ한글')), [
    {text:'한글', jp:false},
    {text:'あ', jp:true},
    {text:'한글', jp:false},
  ]);
  assert.deepEqual(toHostRealm(sandbox2.splitRuns('')), []);
});

test('uniqueCfLabel: 라벨이 겹치면 _2, _3...을 붙여 구분한다', () => {
  const used = [];
  assert.equal(sandbox2.uniqueCfLabel('face', used), 'face');
  assert.equal(sandbox2.uniqueCfLabel('face', used), 'face_2');
  assert.equal(sandbox2.uniqueCfLabel('face', used), 'face_3');
  assert.equal(sandbox2.uniqueCfLabel('other', used), 'other');
});

const sandbox3 = loadFunctionsFromHtml(HTML_PATH, [
  'clampInt',
  'computeCrop',
  'sampleCorner',
  'detectBackground',
  'detectBBox',
]);

test('computeCrop: 가로가 더 넓은 이미지는 좌우를, 세로가 더 긴 이미지는 상하를 offsetFrac 비율로 잘라낸다', () => {
  // 가로가 긴 이미지(가로:세로 2:1)를 정사각형(1:1)으로: 세로는 그대로, 가로만 잘라낸다.
  const wideImg = { width: 200, height: 100 };
  assert.deepEqual(toHostRealm(sandbox3.computeCrop(wideImg, 1, 1, 0)), { sx: 0, sy: 0, sw: 100, sh: 100 });
  assert.deepEqual(toHostRealm(sandbox3.computeCrop(wideImg, 1, 1, 1)), { sx: 100, sy: 0, sw: 100, sh: 100 });
  assert.deepEqual(toHostRealm(sandbox3.computeCrop(wideImg, 1, 1, 0.5)), { sx: 50, sy: 0, sw: 100, sh: 100 });

  // 세로가 긴 이미지(가로:세로 1:2)를 정사각형으로: 가로는 그대로, 세로만 잘라낸다.
  const tallImg = { width: 100, height: 200 };
  assert.deepEqual(toHostRealm(sandbox3.computeCrop(tallImg, 1, 1, 0)), { sx: 0, sy: 0, sw: 100, sh: 100 });
  assert.deepEqual(toHostRealm(sandbox3.computeCrop(tallImg, 1, 1, 1)), { sx: 0, sy: 100, sw: 100, sh: 100 });

  // offsetFrac이 범위를 벗어나도(음수/1 초과) 잘라낼 위치가 이미지 밖으로 나가지 않게 클램프된다.
  assert.deepEqual(toHostRealm(sandbox3.computeCrop(wideImg, 1, 1, -1)), { sx: 0, sy: 0, sw: 100, sh: 100 });
  assert.deepEqual(toHostRealm(sandbox3.computeCrop(wideImg, 1, 1, 2)), { sx: 100, sy: 0, sw: 100, sh: 100 });
});

// 픽셀 (x,y)에 RGBA를 쓰는 4x4 RGBA 버퍼를 만든다. 지정하지 않은 픽셀은 흰 배경(255,255,255,255).
function makeRgba4x4(pixels) {
  const w = 4, h = 4;
  const data = new Array(w * h * 4).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b, a] = (pixels && pixels[y] && pixels[y][x]) || [255, 255, 255, 255];
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
    }
  }
  return data;
}

test('detectBackground: 모서리 4개 중 절반 이상이 거의 투명하면 투명 배경으로, 아니면 모서리 평균 색으로 판정한다', () => {
  const whiteData = makeRgba4x4();
  assert.deepEqual(toHostRealm(sandbox3.detectBackground(whiteData, 4, 4)), { transparent: false, r: 255, g: 255, b: 255, a: 255 });

  // 모서리 4개 중 절반(경계값 2개)이 거의 투명하면, 나머지 모서리가 불투명해도 투명 배경으로 판정한다.
  const transparentCorners = makeRgba4x4({
    0: { 0: [10, 20, 30, 0] },
    3: { 3: [10, 20, 30, 8] },
  });
  assert.deepEqual(toHostRealm(sandbox3.detectBackground(transparentCorners, 4, 4)), { transparent: true, r: 0, g: 0, b: 0, a: 0 });
});

test('detectBBox: 배경과 다른 픽셀들을 감싸는 최소 사각형을 찾고, 배경뿐이면 null을 돌려준다', () => {
  const bg = { transparent: false, r: 255, g: 255, b: 255, a: 255 };

  // 배경만 있는 4x4 이미지: 전경이 없으므로 null.
  assert.equal(sandbox3.detectBBox(makeRgba4x4(), 4, 4, bg, 5), null);

  // (1,1)~(2,2) 2x2 검은 사각형이 흰 배경 위에 있는 경우.
  const withBox = makeRgba4x4({
    1: { 1: [0, 0, 0, 255], 2: [0, 0, 0, 255] },
    2: { 1: [0, 0, 0, 255], 2: [0, 0, 0, 255] },
  });
  assert.deepEqual(toHostRealm(sandbox3.detectBBox(withBox, 4, 4, bg, 5)), { x: 1, y: 1, w: 2, h: 2 });

  // 투명 배경(bg.transparent=true)일 때는 알파값만으로 전경을 판별한다.
  const transparentBg = { transparent: true, r: 0, g: 0, b: 0, a: 0 };
  const opaqueDot = new Array(4 * 4 * 4).fill(0);
  opaqueDot[(0 * 4 + 3) * 4 + 3] = 255; // (3,0) 픽셀만 불투명
  assert.deepEqual(toHostRealm(sandbox3.detectBBox(opaqueDot, 4, 4, transparentBg, 5)), { x: 3, y: 0, w: 1, h: 1 });
});
