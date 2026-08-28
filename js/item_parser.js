(function attachItemParser(root) {
  function parseNumber(value) {
    const match = String(value || '').match(/-?\d[\d,]*(?:\.\d+)?/);
    if (!match) return 0;
    const number = Number(match[0].replace(/,/g, ''));
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  function getQuantityUnit(value) {
    const text = String(value || '');
    if (/마리/.test(text)) return '마리';
    if (/(?:kg|키로|킬로)/i.test(text)) return 'kg';
    return '수량';
  }

  function normalizeName(value) {
    return String(value || '').trim().replace(/\s+/g, '').toLocaleLowerCase('ko');
  }

  function cleanName(value) {
    return String(value || '')
      .replace(/[\s*×xX]+$/g, '')
      .replace(/^[\s*×xX]+/g, '')
      .trim();
  }

  function getFirstExpression(text) {
    const firstLine = String(text || '').split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
    return firstLine.split('+')[0].trim();
  }

  function parseFirstItem(text) {
    const expression = getFirstExpression(text);
    if (!expression) return null;

    const parts = expression.split(/[\*×]/).map(part => part.trim()).filter(Boolean);
    let name = '';
    let quantityText = '';
    let unitPriceText = '';

    if (parts.length >= 3) {
      name = cleanName(parts[0]);
      quantityText = parts[1];
      unitPriceText = parts[2];
    } else if (parts.length >= 2) {
      const firstPart = parts[0];
      const numberMatches = [...firstPart.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)];
      const quantityMatch = numberMatches[numberMatches.length - 1];
      if (quantityMatch) {
        name = cleanName(firstPart.slice(0, quantityMatch.index));
        quantityText = firstPart.slice(quantityMatch.index);
      } else {
        name = cleanName(firstPart);
      }
      unitPriceText = parts[1];
    } else {
      const firstNumber = expression.search(/\d/);
      name = cleanName(firstNumber >= 0 ? expression.slice(0, firstNumber) : expression);
    }

    if (!name) return null;
    const quantity = parseNumber(quantityText);
    const unitPrice = parseNumber(unitPriceText);
    return {
      name,
      key: normalizeName(name),
      quantity,
      quantityUnit: getQuantityUnit(quantityText),
      unitPrice,
      amount: Math.round(quantity * unitPrice),
      expression
    };
  }

  root.ItemParser = { parseFirstItem, normalizeName };
})(typeof window !== 'undefined' ? window : globalThis);
