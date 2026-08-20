// Cocofolia_Setter.html은 빌드 과정 없이 단일 파일로 배포되는 도구라, 그 안의 로직을
// 별도 모듈로 분리해 테스트하면 "실제로 배포되는 코드"와 "테스트하는 코드"가 갈라져
// 버그가 한쪽에만 고쳐지는 문제가 생긴다. 대신 이 헬퍼는 배포되는 HTML 파일 안의
// 순수 함수 정의를 이름으로 찾아 소스 텍스트 그대로 추출한다 — 테스트는 실제로 그
// 파일 안에 있는 코드를 그대로 실행해서 검증한다.
//
// 문자열/정규식 리터럴 안의 중괄호까지 정확히 파싱하지는 않는 단순 중괄호 카운터이므로,
// 그런 문자열이 없는 단순한 유틸 함수 추출에만 써야 한다(이 레포에서 테스트 대상으로
// 삼는 함수들은 모두 해당).
'use strict';

const fs = require('fs');

function extractFunctionSource(src, name) {
  const marker = 'function ' + name + '(';
  const start = src.indexOf(marker);
  if (start === -1) {
    throw new Error('function not found in source: ' + name);
  }
  const braceStart = src.indexOf('{', start);
  if (braceStart === -1) {
    throw new Error('no function body found for: ' + name);
  }
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) {
    throw new Error('unbalanced braces while extracting: ' + name);
  }
  return src.slice(start, end);
}

// "var NAME = ...;" 형태의 최상위 변수 선언 하나를 그대로 추출한다(예: 함수가 참조하는
// 상수 배열). 대괄호/중괄호/괄호 깊이를 추적해, 그 안에 세미콜론이 있어도(이 레포에서
// 테스트 대상으로 삼는 선언들은 문자열 리터럴 안에 세미콜론이 없음) 잘못 잘리지 않게 한다.
function extractVarStatementSource(src, name) {
  const marker = 'var ' + name + ' =';
  const start = src.indexOf(marker);
  if (start === -1) {
    throw new Error('var declaration not found in source: ' + name);
  }
  let depth = 0;
  let end = -1;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[' || ch === '(' || ch === '{') depth++;
    else if (ch === ']' || ch === ')' || ch === '}') depth--;
    else if (ch === ';' && depth === 0) { end = i + 1; break; }
  }
  if (end === -1) {
    throw new Error('no terminating ";" found while extracting: ' + name);
  }
  return src.slice(start, end);
}

// 이름으로 지정한 함수/변수 선언들을 실제 배포 파일에서 추출해 하나의 vm 컨텍스트에서
// 그대로 실행한 뒤, 그 컨텍스트의 sandbox 객체를 돌려준다 (sandbox.<이름>으로 접근).
// decls는 문자열 배열(전부 함수로 취급)이거나 {type:'function'|'var', name} 객체 배열.
// extraGlobals로 alert/document 같은 최소한의 스텁을 넘겨줄 수 있다.
function loadFunctionsFromHtml(htmlPath, decls, extraGlobals) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const vm = require('vm');
  const sources = decls.map((decl) => {
    if (typeof decl === 'string') return extractFunctionSource(html, decl);
    if (decl.type === 'var') return extractVarStatementSource(html, decl.name);
    return extractFunctionSource(html, decl.name);
  });
  const sandbox = Object.assign({}, extraGlobals || {});
  vm.createContext(sandbox);
  new vm.Script(sources.join('\n\n'), { filename: htmlPath + '#extracted' }).runInContext(sandbox);
  return sandbox;
}

module.exports = { extractFunctionSource, extractVarStatementSource, loadFunctionsFromHtml };
