let itemStatisticsSales = [];
let itemStatisticsPurchases = [];

document.addEventListener('DOMContentLoaded', async () => {
  const today = getTodayDate();
  document.getElementById('item-statistics-start').value = `${today.slice(0, 8)}01`;
  document.getElementById('item-statistics-end').value = today;
  document.getElementById('item-statistics-form').addEventListener('submit', event => {
    event.preventDefault();
    renderItemStatistics();
  });
  await loadItemStatisticsData();
});

async function loadItemStatisticsData() {
  try {
    const [salesResponse, purchasesResponse] = await Promise.all([
      API.get('sales'),
      API.get('purchases')
    ]);
    itemStatisticsSales = salesResponse.data || [];
    itemStatisticsPurchases = purchasesResponse.data || [];
    populateItemOptions();
  } catch (error) {
    showToast('품목 데이터를 불러오지 못했습니다: ' + error.message, 'error');
  }
}

function getParsedItem(record) {
  return ItemParser.parseFirstItem(record.kilosText || '');
}

function populateItemOptions() {
  const names = new Map();
  [...itemStatisticsSales, ...itemStatisticsPurchases].forEach(record => {
    const item = getParsedItem(record);
    if (item && !names.has(item.key)) names.set(item.key, item.name);
  });
  const datalist = document.getElementById('item-statistics-options');
  datalist.replaceChildren();
  [...names.values()].sort((a, b) => a.localeCompare(b, 'ko')).forEach(name => {
    datalist.appendChild(new Option(name, name));
  });
}

function getRecordDate(record) {
  return String(record.date || record.createdAt || '').slice(0, 10);
}

function getMatchingEntries(records, type, itemKey, startDate, endDate) {
  return records.flatMap(record => {
    const date = getRecordDate(record);
    const item = getParsedItem(record);
    if (!item || item.key !== itemKey || !date || date < startDate || date > endDate) return [];
    return [{ type, record, item, date }];
  });
}

function summarizeEntries(entries) {
  const quantityByUnit = new Map();
  let amount = 0;
  let pricedAmount = 0;
  let pricedQuantity = 0;

  entries.forEach(({ item }) => {
    amount += item.amount;
    if (item.quantity > 0) {
      quantityByUnit.set(item.quantityUnit, (quantityByUnit.get(item.quantityUnit) || 0) + item.quantity);
    }
    if (item.unitPrice > 0) {
      pricedAmount += item.amount;
      pricedQuantity += item.quantity;
    }
  });

  return {
    count: entries.length,
    amount,
    averageUnitPrice: pricedQuantity ? Math.round(pricedAmount / pricedQuantity) : 0,
    quantityText: [...quantityByUnit.entries()]
      .map(([unit, quantity]) => `${formatDecimal(quantity)}${unit === '수량' ? '' : unit}`)
      .join(' · ') || '-'
  };
}

function formatDecimal(value) {
  return Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 3 });
}

function renderItemStatistics() {
  const inputName = document.getElementById('item-statistics-name').value.trim();
  const itemKey = ItemParser.normalizeName(inputName);
  const startDate = document.getElementById('item-statistics-start').value;
  const endDate = document.getElementById('item-statistics-end').value;

  if (!itemKey) return showToast('검색할 품목을 입력해주세요.', 'error');
  if (!startDate || !endDate) return showToast('조회 기간을 선택해주세요.', 'error');
  if (startDate > endDate) return showToast('시작일은 종료일보다 늦을 수 없습니다.', 'error');

  const salesEntries = getMatchingEntries(itemStatisticsSales, 'sale', itemKey, startDate, endDate);
  const purchaseEntries = getMatchingEntries(itemStatisticsPurchases, 'purchase', itemKey, startDate, endDate);
  const entries = [...salesEntries, ...purchaseEntries].sort((a, b) =>
    b.date.localeCompare(a.date) || String(b.record.createdAt || '').localeCompare(String(a.record.createdAt || ''))
  );
  const sales = summarizeEntries(salesEntries);
  const purchases = summarizeEntries(purchaseEntries);
  const displayName = entries[0]?.item.name || inputName;

  document.getElementById('item-statistics-intro').hidden = true;
  document.getElementById('item-statistics-result').hidden = false;
  document.getElementById('item-statistics-selected-name').textContent = displayName;
  document.getElementById('item-statistics-period').textContent = `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
  document.getElementById('item-statistics-total-count').textContent = `총 ${entries.length}건`;
  document.getElementById('item-statistics-sales-amount').textContent = formatNumber(sales.amount);
  document.getElementById('item-statistics-purchases-amount').textContent = formatNumber(purchases.amount);
  document.getElementById('item-statistics-net-amount').textContent = formatNumber(sales.amount - purchases.amount);
  document.getElementById('item-statistics-sales-meta').textContent = `${sales.count}건`;
  document.getElementById('item-statistics-purchases-meta').textContent = `${purchases.count}건`;
  document.getElementById('item-statistics-sales-quantity').textContent = sales.quantityText;
  document.getElementById('item-statistics-purchases-quantity').textContent = purchases.quantityText;
  document.getElementById('item-statistics-sales-average').textContent = `${formatNumber(sales.averageUnitPrice)}원`;
  document.getElementById('item-statistics-purchases-average').textContent = `${formatNumber(purchases.averageUnitPrice)}원`;
  document.getElementById('item-statistics-record-count').textContent = `${entries.length}건`;

  const netCard = document.querySelector('.item-statistics-summary-card.net');
  netCard.classList.toggle('negative', sales.amount - purchases.amount < 0);
  renderItemRecords(entries);
}

function renderItemRecords(entries) {
  const container = document.getElementById('item-statistics-record-list');
  if (!entries.length) {
    container.innerHTML = '<div class="item-statistics-empty"><span>📭</span><strong>해당 기간의 기록이 없습니다.</strong><p>품목명과 조회 기간을 다시 확인해주세요.</p></div>';
    return;
  }

  container.innerHTML = entries.map(({ type, record, item, date }) => `
    <article class="item-statistics-record">
      <div class="item-statistics-record-top">
        <div><span class="item-statistics-type ${type}">${type === 'sale' ? '판매' : '수매'}</span><strong>${escapeHtml(record.companyName || '거래처 미입력')}</strong></div>
        <time>${formatDate(date)}</time>
      </div>
      <div class="item-statistics-expression">${escapeHtml(item.expression)}</div>
      <div class="item-statistics-record-bottom">
        <span>${formatDecimal(item.quantity)}${item.quantityUnit === '수량' ? '' : item.quantityUnit} × ${formatNumber(item.unitPrice)}원</span>
        <strong>${formatNumber(item.amount)}원</strong>
      </div>
    </article>`).join('');
}
