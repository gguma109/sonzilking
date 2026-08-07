let statisticsSales = [];
let statisticsPurchases = [];

const GROUP_LABELS = {
  company: '거래처별',
  day: '일별',
  month: '월별',
  quarter: '분기별',
  year: '연도별'
};

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('statistics-group').addEventListener('change', () => {
    syncYearFilter();
    renderStatistics();
  });
  document.getElementById('statistics-year').addEventListener('change', renderStatistics);
  document.getElementById('statistics-company').addEventListener('change', renderStatistics);
  await loadStatistics();
});

async function loadStatistics() {
  try {
    const [salesResponse, purchasesResponse] = await Promise.all([
      API.get('sales'),
      API.get('purchases')
    ]);
    statisticsSales = salesResponse.data || [];
    statisticsPurchases = purchasesResponse.data || [];
    populateYearFilter();
    populateCompanyFilter();
    syncYearFilter();
    renderStatistics();
  } catch (error) {
    document.getElementById('statistics-body').innerHTML =
      `<tr><td colspan="4" class="statistics-empty">통계를 불러오지 못했습니다.<br>${escapeHtml(error.message)}</td></tr>`;
  }
}

function parseRecordDate(record) {
  const raw = String(record.date || record.createdAt || '');
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function populateYearFilter() {
  const years = [...statisticsSales, ...statisticsPurchases]
    .map(parseRecordDate)
    .filter(Boolean)
    .map(date => date.year);
  years.push(new Date().getFullYear());
  const uniqueYears = [...new Set(years)].sort((a, b) => b - a);
  const select = document.getElementById('statistics-year');
  select.innerHTML = `<option value="all">전체 연도</option>` +
    uniqueYears.map(year => `<option value="${year}">${year}년</option>`).join('');
  select.value = String(new Date().getFullYear());
}

function populateCompanyFilter() {
  const companies = [...statisticsSales, ...statisticsPurchases]
    .map(record => String(record.companyName || '거래처 미입력'))
    .filter(Boolean);
  const uniqueCompanies = [...new Set(companies)].sort((a, b) => a.localeCompare(b, 'ko'));
  const select = document.getElementById('statistics-company');
  select.innerHTML = '<option value="all">전체 거래처</option>' +
    uniqueCompanies.map(company => `<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join('');
}

function syncYearFilter() {
  const group = document.getElementById('statistics-group').value;
  const yearSelect = document.getElementById('statistics-year');
  const companyFilter = document.getElementById('statistics-company-filter');
  companyFilter.hidden = group !== 'company';
  if (group === 'year') {
    yearSelect.value = 'all';
    yearSelect.disabled = true;
  } else {
    yearSelect.disabled = false;
  }
}

function getGroupInfo(record, group) {
  const date = parseRecordDate(record);
  if (group === 'company') {
    const companyName = String(record.companyName || '거래처 미입력');
    return { key: companyName, label: companyName };
  }
  if (!date) return null;

  if (group === 'day') {
    const key = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    return { key, label: `${date.year}.${String(date.month).padStart(2, '0')}.${String(date.day).padStart(2, '0')}` };
  }
  if (group === 'month') {
    const key = `${date.year}-${String(date.month).padStart(2, '0')}`;
    return { key, label: `${date.year}년 ${date.month}월` };
  }
  if (group === 'quarter') {
    const quarter = Math.ceil(date.month / 3);
    return { key: `${date.year}-Q${quarter}`, label: `${date.year}년 ${quarter}분기` };
  }
  return { key: String(date.year), label: `${date.year}년` };
}

function recordMatchesYear(record, selectedYear) {
  if (selectedYear === 'all') return true;
  const date = parseRecordDate(record);
  return date && String(date.year) === selectedYear;
}

function renderStatistics() {
  const group = document.getElementById('statistics-group').value;
  const selectedYear = document.getElementById('statistics-year').value;
  const selectedCompany = document.getElementById('statistics-company').value;
  const rows = new Map();
  let salesTotal = 0;
  let purchaseTotal = 0;

  const addRecord = (record, field) => {
    if (!recordMatchesYear(record, selectedYear)) return;
    const companyName = String(record.companyName || '거래처 미입력');
    if (group === 'company' && selectedCompany !== 'all' && companyName !== selectedCompany) return;
    const groupInfo = getGroupInfo(record, group);
    if (!groupInfo) return;
    const amount = Number(record.total) || 0;
    const row = rows.get(groupInfo.key) || { key: groupInfo.key, label: groupInfo.label, sales: 0, purchases: 0 };
    row[field] += amount;
    rows.set(groupInfo.key, row);
    if (field === 'sales') salesTotal += amount;
    else purchaseTotal += amount;
  };

  statisticsSales.forEach(record => addRecord(record, 'sales'));
  statisticsPurchases.forEach(record => addRecord(record, 'purchases'));

  document.getElementById('statistics-sales-total').textContent = formatNumber(salesTotal);
  document.getElementById('statistics-purchase-total').textContent = formatNumber(purchaseTotal);
  const netTotal = salesTotal - purchaseTotal;
  const netElement = document.getElementById('statistics-net-total');
  netElement.textContent = formatNumber(netTotal);
  netElement.closest('.statistics-total-card').classList.toggle('negative', netTotal < 0);

  const list = [...rows.values()].sort((a, b) => {
    if (group === 'company') return a.label.localeCompare(b.label, 'ko');
    return b.key.localeCompare(a.key);
  });

  document.getElementById('statistics-list-title').textContent = `📊 ${GROUP_LABELS[group]} 통계`;
  document.getElementById('statistics-count').textContent = `${list.length}건`;
  const body = document.getElementById('statistics-body');

  if (!list.length) {
    body.innerHTML = '<tr><td colspan="4" class="statistics-empty">선택한 조건에 해당하는 기록이 없습니다.</td></tr>';
    return;
  }

  body.innerHTML = list.map(row => {
    const net = row.sales - row.purchases;
    return `
      <tr>
        <th scope="row">${escapeHtml(row.label)}</th>
        <td class="amount-sales">${formatNumber(row.sales)}원</td>
        <td class="amount-purchase">${formatNumber(row.purchases)}원</td>
        <td class="amount-net ${net < 0 ? 'negative' : ''}">${formatNumber(net)}원</td>
      </tr>`;
  }).join('');
}
