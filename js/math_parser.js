// js/math_parser.js
// 텍스트에서 수학 기호와 숫자만 추출하여 계산

function parseAndCalculateMath(text) {
  if (!text.trim()) return 0;
  
  // 1. 숫자, 소수점, 덧셈(+), 뺄셈(-), 곱셈(*), 나눗셈(/), 괄호()만 남기고 모두 제거
  let mathStr = text.replace(/[^0-9+\-*/().]/g, '');
  
  // 2. 만약 수식이 비어있거나 올바르지 않으면 0 반환
  if (!mathStr) return 0;

  try {
    // 3. 안전하게 수식 계산 (eval 대신 Function 활용)
    // 연속된 기호(++, *+) 등의 오류 방지를 위해 시도
    let result = new Function('return ' + mathStr)();
    
    // 4. 결과가 정상적인 숫자인지 확인
    if (isNaN(result) || !isFinite(result)) return 0;
    
    return Math.max(0, result); // 음수 방지 (선택적)
  } catch (e) {
    // 수식이 불완전할 경우 (예: "10 * ") 무시하고 0 반환
    return 0;
  }
}
