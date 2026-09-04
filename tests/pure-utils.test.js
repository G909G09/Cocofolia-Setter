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
