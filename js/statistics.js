let statisticsSales = [];
let statisticsPurchases = [];
let statisticsCompanies = [];

const GROUP_LABELS = {
  company: '거래처별',
  day: '일별',
  month: '월별',
  quarter: '분기별',
  year: '연도별'
};

document.addEventListener('DOMContentLoaded', async () => {
  const today = getTodayDate();
  document.getElementById('statistics-month').value = today.slice(0, 7);
  document.getElementById('statistics-day').value = today;
  document.getElementById('statistics-quarter').value = String(Math.ceil(Number(today.slice(5, 7)) / 3));

  document.getElementById('statistics-group').addEventListener('change', () => {
    syncStatisticsFilters();
    renderStatistics();
  });
  document.getElementById('statistics-company-period').addEventListener('change', () => {
    syncStatisticsFilters();
    renderStatistics();
  });
  document.getElementById('statistics-year').addEventListener('change', renderStatistics);
  document.getElementById('statistics-quarter').addEventListener('change', renderStatistics);
  document.getElementById('statistics-month').addEventListener('change', renderStatistics);
  document.getElementById('statistics-day').addEventListener('change', renderStatistics);
  document.getElementById('statistics-company').addEventListener('change', () => {
    syncComparisonCompanyOptions();
    renderStatistics();
  });
  document.getElementById('statistics-comparison-company').addEventListener('change', renderStatistics);
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
    populateCompanyFilters();
    syncStatisticsFilters();
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
  select.replaceChildren(new Option('전체 연도', 'all'));
  uniqueYears.forEach(year => select.add(new Option(`${year}년`, String(year))));
  select.value = String(new Date().getFullYear());
}

function populateCompanyFilters() {
  statisticsCompanies = [...new Set([...statisticsSales, ...statisticsPurchases]
    .map(record => String(record.companyName || '거래처 미입력'))
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko'));
  const select = document.getElementById('statistics-company');
  select.replaceChildren(new Option('전체 거래처', 'all'));
  statisticsCompanies.forEach(company => select.add(new Option(company, company)));
  syncComparisonCompanyOptions();
}

function syncComparisonCompanyOptions() {
  const primary = document.getElementById('statistics-company').value;
  const comparisonSelect = document.getElementById('statistics-comparison-company');
  const previous = comparisonSelect.value;
  comparisonSelect.replaceChildren(new Option('비교 안 함', 'none'));
  statisticsCompanies
    .filter(company => company !== primary)
    .forEach(company => comparisonSelect.add(new Option(company, company)));
  const canCompare = primary && primary !== 'all';
  comparisonSelect.disabled = !canCompare;
  comparisonSelect.value = canCompare && statisticsCompanies.includes(previous) && previous !== primary ? previous : 'none';
}

function syncStatisticsFilters() {
  const group = document.getElementById('statistics-group').value;
  const isCompany = group === 'company';
  const companyPeriod = document.getElementById('statistics-company-period').value;
  const usesYear = !isCompany ? group !== 'year' : companyPeriod === 'year' || companyPeriod === 'quarter';

  document.getElementById('statistics-company-period-filter').hidden = !isCompany;
  document.getElementById('statistics-company-filter').hidden = !isCompany;
  document.getElementById('statistics-comparison-filter').hidden = !isCompany;
  document.getElementById('statistics-year-filter').hidden = !usesYear;
  document.getElementById('statistics-quarter-filter').hidden = !(isCompany && companyPeriod === 'quarter');
  document.getElementById('statistics-month-filter').hidden = !(isCompany && companyPeriod === 'month');
  document.getElementById('statistics-day-filter').hidden = !(isCompany && companyPeriod === 'day');

  const yearSelect = document.getElementById('statistics-year');
  yearSelect.disabled = group === 'year';
  if (group === 'year') yearSelect.value = 'all';
  if (isCompany && companyPeriod === 'quarter' && yearSelect.value === 'all') {
    const currentYear = String(new Date().getFullYear());
    yearSelect.value = [...yearSelect.options].some(option => option.value === currentYear)
      ? currentYear
      : yearSelect.options[1]?.value || 'all';
  }
  if (!isCompany) {
    document.getElementById('statistics-comparison-company').value = 'none';
    document.getElementById('statistics-comparison').hidden = true;
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

function recordMatchesCompanyPeriod(record, period, selectedYear, selectedQuarter, selectedMonth, selectedDay) {
  const date = parseRecordDate(record);
  if (!date) return false;
  if (period === 'year') return selectedYear === 'all' || String(date.year) === selectedYear;
  if (period === 'quarter') {
    const yearMatches = selectedYear === 'all' || String(date.year) === selectedYear;
    return yearMatches && String(Math.ceil(date.month / 3)) === selectedQuarter;
  }
  const monthKey = `${date.year}-${String(date.month).padStart(2, '0')}`;
  if (period === 'month') return monthKey === selectedMonth;
  return `${monthKey}-${String(date.day).padStart(2, '0')}` === selectedDay;
}

function getCompanyPeriodLabel(period, selectedYear, selectedQuarter, selectedMonth, selectedDay) {
  if (period === 'year') return selectedYear === 'all' ? '전체 연도' : `${selectedYear}년`;
  if (period === 'quarter') return `${selectedYear === 'all' ? '전체 연도' : `${selectedYear}년`} ${selectedQuarter}분기`;
  if (period === 'month') {
    const [year, month] = selectedMonth.split('-');
    return year && month ? `${year}년 ${Number(month)}월` : '월 미선택';
  }
  return selectedDay ? formatDate(selectedDay) : '날짜 미선택';
}

function renderCompanyComparison(rows, primaryCompany, comparisonCompany, periodLabel) {
  const section = document.getElementById('statistics-comparison');
  if (!primaryCompany || primaryCompany === 'all' || !comparisonCompany || comparisonCompany === 'none') {
    section.hidden = true;
    return;
  }

  const emptyStats = company => ({ label: company, sales: 0, purchases: 0, salesCount: 0, purchaseCount: 0 });
  const primary = rows.get(primaryCompany) || emptyStats(primaryCompany);
  const comparison = rows.get(comparisonCompany) || emptyStats(comparisonCompany);
  const cards = [primary, comparison].map(item => {
    const net = item.sales - item.purchases;
    return `<article class="statistics-compare-card">
      <div class="statistics-compare-name">${escapeHtml(item.label)}</div>
      <div class="statistics-compare-metrics">
        <div class="statistics-compare-metric"><span>매출</span><strong class="amount-sales">${formatNumber(item.sales)}원</strong></div>
        <div class="statistics-compare-metric"><span>지출</span><strong class="amount-purchase">${formatNumber(item.purchases)}원</strong></div>
        <div class="statistics-compare-metric"><span>차액</span><strong class="amount-net ${net < 0 ? 'negative' : ''}">${formatNumber(net)}원</strong></div>
        <div class="statistics-compare-metric"><span>거래 건수</span><strong>판매 ${item.salesCount}건 · 수매 ${item.purchaseCount}건</strong></div>
      </div>
    </article>`;
  }).join('');

  const primaryNet = primary.sales - primary.purchases;
  const comparisonNet = comparison.sales - comparison.purchases;
  const difference = primaryNet - comparisonNet;
  const resultText = difference === 0
    ? '두 거래처의 차액이 같습니다.'
    : `${difference > 0 ? primaryCompany : comparisonCompany}의 차액이 ${formatNumber(Math.abs(difference))}원 더 높습니다.`;
  document.getElementById('statistics-comparison-period').textContent = periodLabel;
  document.getElementById('statistics-comparison-cards').innerHTML = cards;
  document.getElementById('statistics-comparison-result').textContent = resultText;
  section.hidden = false;
}

function renderStatistics() {
  const group = document.getElementById('statistics-group').value;
  const selectedYear = document.getElementById('statistics-year').value;
  const selectedCompany = document.getElementById('statistics-company').value;
  const comparisonCompany = document.getElementById('statistics-comparison-company').value;
  const companyPeriod = document.getElementById('statistics-company-period').value;
  const selectedQuarter = document.getElementById('statistics-quarter').value;
  const selectedMonth = document.getElementById('statistics-month').value;
  const selectedDay = document.getElementById('statistics-day').value;
  const rows = new Map();
  let salesTotal = 0;
  let purchaseTotal = 0;

  const comparedCompanies = group === 'company' && selectedCompany !== 'all'
    ? new Set([selectedCompany, ...(comparisonCompany !== 'none' ? [comparisonCompany] : [])])
    : null;

  const addRecord = (record, field) => {
    const companyName = String(record.companyName || '거래처 미입력');
    if (group === 'company') {
      if (!recordMatchesCompanyPeriod(record, companyPeriod, selectedYear, selectedQuarter, selectedMonth, selectedDay)) return;
      if (comparedCompanies && !comparedCompanies.has(companyName)) return;
    } else if (!recordMatchesYear(record, selectedYear)) {
      return;
    }

    const groupInfo = getGroupInfo(record, group);
    if (!groupInfo) return;
    const amount = Number(record.total) || 0;
    const row = rows.get(groupInfo.key) || {
      key: groupInfo.key,
      label: groupInfo.label,
      sales: 0,
      purchases: 0,
      salesCount: 0,
      purchaseCount: 0
    };
    row[field] += amount;
    if (field === 'sales') row.salesCount += 1;
    else row.purchaseCount += 1;
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
    if (group === 'company' && comparedCompanies) {
      const order = [selectedCompany, comparisonCompany];
      return order.indexOf(a.key) - order.indexOf(b.key);
    }
    if (group === 'company') return a.label.localeCompare(b.label, 'ko');
    return b.key.localeCompare(a.key);
  });

  const periodLabel = getCompanyPeriodLabel(companyPeriod, selectedYear, selectedQuarter, selectedMonth, selectedDay);
  const title = group === 'company' ? `${GROUP_LABELS[group]} 통계 · ${periodLabel}` : `${GROUP_LABELS[group]} 통계`;
  document.getElementById('statistics-list-title').textContent = `📊 ${title}`;
  document.getElementById('statistics-count').textContent = `${list.length}${group === 'company' ? '곳' : '건'}`;
  renderCompanyComparison(rows, selectedCompany, comparisonCompany, periodLabel);

  const body = document.getElementById('statistics-body');
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="4" class="statistics-empty">선택한 조건에 해당하는 기록이 없습니다.</td></tr>';
    return;
  }

  body.innerHTML = list.map(row => {
    const net = row.sales - row.purchases;
    return `<tr>
      <th scope="row">${escapeHtml(row.label)}</th>
      <td class="amount-sales">${formatNumber(row.sales)}원</td>
      <td class="amount-purchase">${formatNumber(row.purchases)}원</td>
      <td class="amount-net ${net < 0 ? 'negative' : ''}">${formatNumber(net)}원</td>
    </tr>`;
  }).join('');
}
