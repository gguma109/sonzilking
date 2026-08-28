(function attachItemParser(root) {
  const QUANTITY_UNITS = [
    ['kg', /(?:kg|키로|킬로)/i],
    ['마리', /마리/],
    ['미', /미/],
    ['개', /개/],
    ['박스', /(?:박스|상자)/],
    ['팩', /팩/],
    ['봉', /봉/],
    ['통', /통/],
    ['망', /망/]
  ];

  function parseNumber(value) {
    const match = String(value || '').trim().match(/-?\d[\d,]*(?:\.\d+)?/);
    if (!match) return null;
    const number = Number(match[0].replace(/,/g, ''));
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function getQuantityUnit(value) {
    const text = String(value || '');
    return QUANTITY_UNITS.find(([, pattern]) => pattern.test(text))?.[0] || '수량';
  }

  function normalizeName(value) {
    return String(value || '').trim().replace(/\s+/g, '').toLocaleLowerCase('ko');
  }

  function cleanName(value) {
    return String(value || '')
      .replace(/[\s*×]+$/g, '')
      .replace(/^[\s*×]+/g, '')
      .trim();
  }

  function stripWrittenAmount(value) {
    return String(value || '').replace(/\s*=\s*[\d,]+(?:\.\d+)?\s*원?\s*$/, '').trim();
  }

  function splitExpressions(text) {
    const expressions = [];
    String(text || '').split(/\r?\n/).forEach((line, lineIndex) => {
      line.split('+').map(part => part.trim()).filter(Boolean).forEach(part => {
        expressions.push({ expression: part, lineNumber: lineIndex + 1 });
      });
    });
    return expressions;
  }

  function parseItemExpression(rawExpression, lineNumber = 1) {
    const expression = stripWrittenAmount(rawExpression);
    const parts = expression.split(/[\*×]/).map(part => part.trim());
    let name = '';
    let quantityText = '';
    let unitPriceText = '';

    if (parts.length === 3) {
      [name, quantityText, unitPriceText] = parts;
    } else if (parts.length === 2) {
      const firstPart = parts[0];
      const numberMatches = [...firstPart.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)];
      const quantityMatch = numberMatches[numberMatches.length - 1];
      if (quantityMatch) {
        name = firstPart.slice(0, quantityMatch.index);
        quantityText = firstPart.slice(quantityMatch.index);
        unitPriceText = parts[1];
      }
    }

    name = cleanName(name);
    const quantity = parseNumber(quantityText);
    const unitPrice = parseNumber(unitPriceText);
    const error = !name
      ? '품목명이 없습니다.'
      : quantity === null
        ? '수량을 확인해주세요.'
        : unitPrice === null
          ? '단가를 확인해주세요.'
          : '';

    if (error) return { valid: false, lineNumber, expression: rawExpression, error };

    return {
      valid: true,
      lineNumber,
      name,
      key: normalizeName(name),
      quantity,
      quantityUnit: getQuantityUnit(quantityText),
      unitPrice,
      amount: Math.round(quantity * unitPrice),
      expression
    };
  }

  function parseItems(text) {
    const parsed = splitExpressions(text).map(({ expression, lineNumber }) =>
      parseItemExpression(expression, lineNumber)
    );
    const items = parsed.filter(item => item.valid);
    const errors = parsed.filter(item => !item.valid);
    return {
      items,
      errors,
      total: items.reduce((sum, item) => sum + item.amount, 0)
    };
  }

  function parseFirstItem(text) {
    return parseItems(text).items[0] || null;
  }

  root.ItemParser = { parseItems, parseFirstItem, parseItemExpression, normalizeName };
})(typeof window !== 'undefined' ? window : globalThis);
