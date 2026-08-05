// js/math_parser.js
// 텍스트에서 수학 기호와 숫자만 추출하여 계산

function parseAndCalculateMath(text) {
  if (!text.trim()) return 0;
  
  const lines = text.split('\n');
  let totalSum = 0;

  for (let line of lines) {
    // 1. 각 줄마다 수학 기호와 숫자만 추출
    let mathStr = line.replace(/[^0-9+\-*/().]/g, '');
    if (!mathStr) continue;

    try {
      // 2. 해당 줄 수식 계산
      let result = new Function('return ' + mathStr)();
      
      if (!isNaN(result) && isFinite(result)) {
        totalSum += Math.max(0, result); // 음수 방지 및 합산
      }
    } catch (e) {
      // 수식이 불완전한 줄은 무시 (예: "10 * ")
    }
  }

  return totalSum;
}
