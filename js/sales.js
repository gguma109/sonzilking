// ===================================================
// sales.js - 판매 페이지 로직 (판매/미수금 탭)
// ===================================================

let allSalesRecords = [];
let allUnpaidRecords = [];
let renderedUnpaidRecords = [];
let editSalesId = null; // 현재 편집 중인 레코드 ID;
let statementSalesRecord = null;
let statementProfile = null;
let salesCompanyPicker = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 기본 날짜
  document.getElementById('sale-date').value = getTodayDate();
  document.getElementById('sales-summary-month').value = getTodayDate().slice(0, 7);
  document.getElementById('sales-summary-day').value = getTodayDate();
  document.getElementById('sales-summary-period').addEventListener('change', syncSalesSummaryPeriod);
  document.getElementById('sales-summary-month').addEventListener('change', updateMonthlySalesSummary);
  document.getElementById('sales-summary-day').addEventListener('change', updateMonthlySalesSummary);

  // 계산기 텍스트 에어리어 이벤트
  ['calc-kilos', 'calc-add', 'commission-rate'].forEach(id => {
    document.getElementById(id).addEventListener('input', calculateSales);
  });

  // 미수금 실시간 체크용 (모달 내)
  let debounceTimer;
  document.getElementById('company-name').addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkUnpaidBalance, 600);
  });

  // 버튼들
  document.getElementById('btn-save-sales').addEventListener('click', saveSale);
  document.getElementById('records-search').addEventListener('input', filterSalesRecords);
  document.getElementById('records-search-unpaid').addEventListener('input', filterUnpaidRecords);
  document.getElementById('btn-close-statement').addEventListener('click', closeSalesStatement);
  document.getElementById('btn-close-statement-bottom').addEventListener('click', closeSalesStatement);
  document.getElementById('btn-save-statement-image').addEventListener('click', saveSalesStatementImage);
  document.getElementById('statement-modal').addEventListener('click', event => {
    if (event.target.id === 'statement-modal') closeSalesStatement();
  });

  // 모달 제어
  const modal = document.getElementById('form-modal');
  document.getElementById('btn-open-modal').addEventListener('click', () => {
    resetSalesForm(); // 새 작성 시 폼 비우기
    modal.classList.add('active');
  });
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    resetSalesForm();
    modal.classList.remove('active');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // 초기 데이터 로드
  try { statementProfile = (await API.get('profile')).user; } catch {}
  salesCompanyPicker = createCompanyPicker({
    type: 'sales',
    inputId: 'company-name',
    containerId: 'sales-company-picker',
    onRename: async () => {
      await loadSalesRecords();
      await loadUnpaidRecords();
    }
  });
  await loadCompanies();
  await loadSalesRecords();
  await loadUnpaidRecords();
});

// ---- 계산 (텍스트 파서 적용) ----
function calculateSales() {
  const kilosText = document.getElementById('calc-kilos').value;
  const addText = document.getElementById('calc-add').value;
  const commissionRate = parseFloat(document.getElementById('commission-rate').value) || 0;

  const kilosTotal = parseAndCalculateMath(kilosText);
  const addTotal = parseAndCalculateMath(addText);
  // 수수료 및 총액 계산
  let commissionAmount = 0;
  const subtotal = kilosTotal + addTotal;

  if (commissionRate > 0) {
    commissionAmount = Math.round(subtotal * (commissionRate / 100));
  }

  // 수수료를 판매대금에 더해 최종 청구 금액에 포함한다.
  const grandTotal = subtotal + commissionAmount;

  // 화면 업데이트
  document.getElementById('preview-kilos').textContent = formatNumber(kilosTotal) + '원';
  document.getElementById('preview-add').textContent = formatNumber(addTotal) + '원';
  
  if (commissionRate > 0) {
    document.getElementById('commission-amount').textContent = `${formatNumber(commissionAmount)}원`;
  } else {
    document.getElementById('commission-amount').textContent = '0원';
  }

  document.getElementById('grand-total').textContent = formatNumber(grandTotal);

  // 과거 API 호환을 위해 텍스트 수식 자체도 kilos 등에 남기거나 1로 처리
  // DB 스키마가 키로수 단가를 나눠받으므로, 텍스트 계산기 사용 시 kilos=1, unitPrice=kilosTotal 로 대체 저장
  return { 
    kilos: 1, 
    unitPrice: kilosTotal, 
    kilosTotal, 
    addQty: 1, 
    addPrice: addTotal, 
    addTotal, 
    commissionRate, 
    commissionAmount, 
    grandTotal 
  };
}

// ---- 미수금 조회 (모달 폼 내) ----
async function checkUnpaidBalance() {
  const company = document.getElementById('company-name').value.trim();
  const alertEl = document.getElementById('alert-unpaid');

  if (!company) {
    alertEl.style.display = 'none';
    return;
  }

  const found = allUnpaidRecords.find(r => r.companyName === company);
  if (found && found.balance > 0) {
    document.getElementById('unpaid-amount-display').textContent = formatNumber(found.balance) + '원';
    alertEl.style.display = 'flex';
  } else {
    alertEl.style.display = 'none';
  }
}

// ---- 판매 업체 목록 ----
async function loadCompanies() {
  if (salesCompanyPicker) await salesCompanyPicker.load();
}

// ---- 저장 ----
async function saveSale() {
  const btn = document.getElementById('btn-save-sales');
  const companyName = document.getElementById('company-name').value.trim();

  if (!companyName) {
    showToast('❗ 업체명을 입력해주세요', 'error');
    document.getElementById('company-name').focus();
    return;
  }

  const values = calculateSales();

  const record = {
    companyName,
    date: document.getElementById('sale-date').value || getTodayDate(),
    kilos: values.kilos,
    unitPrice: values.unitPrice,
    kilosTotal: values.kilosTotal,
    kilosText: document.getElementById('calc-kilos').value,
    addQty: values.addQty,
    addPrice: values.addPrice,
    addTotal: values.addTotal,
    addText: document.getElementById('calc-add').value,
    commissionRate: values.commissionRate,
    commissionAmount: values.commissionAmount,
    total: values.grandTotal,
    unpaid: 1, // 장부 기록을 위해 기본적으로 미수금에 합산되게 설정
    memo: document.getElementById('sale-memo').value.trim()
  };

  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    let savedId = editSalesId;
    if (editSalesId) {
      await API.put(`sales/${editSalesId}`, record);
      showToast('✅ 판매 기록이 수정되었습니다');
    } else {
      const response = await API.post('sales', record);
      savedId = response.data?.id;
      showToast('✅ 판매 기록이 저장되었습니다');
    }
    if (savedId) await saveStatementSnapshot({ ...record, id: savedId });
    
    resetSalesForm();
    await loadCompanies();
    await loadSalesRecords();
    await loadUnpaidRecords();
  } catch (e) {
    showToast('❌ 저장 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 저장하기';
  }
}

function resetSalesForm() {
  ['company-name', 'calc-kilos', 'calc-add', 'commission-rate', 'sale-memo'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('sale-date').value = getTodayDate();
  document.getElementById('alert-unpaid').style.display = 'none';
  calculateSales();
  editSalesId = null; // 편집 모드 초기화
  document.querySelector('#form-modal .section-title').textContent = '📝 판매 입력';
  document.getElementById('form-modal').classList.remove('active');
}

// ---- 편집(수정) 기능 ----
function editSaleRecord(id) {
  const record = allSalesRecords.find(r => r.id === id);
  if (!record) return;

  editSalesId = id;
  document.querySelector('#form-modal .section-title').textContent = '✏️ 판매 기록 수정';

  document.getElementById('company-name').value = record.companyName;
  document.getElementById('calc-kilos').value = record.kilosText || '';
  document.getElementById('calc-add').value = record.addText || '';
  document.getElementById('commission-rate').value = record.commissionRate || '';
  document.getElementById('sale-date').value = (record.date || record.createdAt).split('T')[0];
  document.getElementById('sale-memo').value = record.memo || '';

  calculateSales();
  checkUnpaidBalance();
  document.getElementById('form-modal').classList.add('active');
}

// ---- 판매 기록 로드/렌더링 ----
async function loadSalesRecords() {
  const container = document.getElementById('records-list');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await API.get('sales');
    allSalesRecords = data.data || [];
    updateMonthlySalesSummary();
  } catch {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">기록을 불러올 수 없습니다</div></div>`;
  }
}

function getSalesRecordsForSelectedPeriod() {
  const period = document.getElementById('sales-summary-period').value;
  const selected = document.getElementById(period === 'day' ? 'sales-summary-day' : 'sales-summary-month').value;
  const dateLength = period === 'day' ? 10 : 7;
  return allSalesRecords.filter(record =>
    String(record.date || record.createdAt || '').slice(0, dateLength) === selected
  );
}

function updateMonthlySalesSummary() {
  const period = document.getElementById('sales-summary-period').value;
  const selected = document.getElementById(period === 'day' ? 'sales-summary-day' : 'sales-summary-month').value;
  const records = getSalesRecordsForSelectedPeriod();
  const total = records.reduce((sum, record) => sum + (Number(record.total) || 0), 0);
  const [year, monthNumber, day] = selected.split('-');
  document.getElementById('sales-summary-label').textContent = period === 'day'
    ? `${year}년 ${Number(monthNumber)}월 ${Number(day)}일 총 매출`
    : `${year}년 ${Number(monthNumber)}월 총 매출`;
  document.getElementById('sales-summary-amount').textContent = formatNumber(total);
  document.getElementById('sales-summary-count').textContent = `${records.length}건`;
  filterSalesRecords();
}

function syncSalesSummaryPeriod() {
  const isDay = document.getElementById('sales-summary-period').value === 'day';
  const monthInput = document.getElementById('sales-summary-month');
  const dayInput = document.getElementById('sales-summary-day');
  monthInput.hidden = isDay;
  dayInput.hidden = !isDay;
  const label = document.getElementById('sales-summary-date-label');
  label.textContent = isDay ? '조회 날짜' : '조회 월';
  label.htmlFor = isDay ? 'sales-summary-day' : 'sales-summary-month';
  updateMonthlySalesSummary();
}

function renderSalesRecords(records) {
  const container = document.getElementById('records-list');
  document.getElementById('records-count').textContent = `${records.length}건`;

  if (!records.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">저장된 판매 기록이 없습니다</div></div>`;
    return;
  }

  container.innerHTML = records.map(r => {
    // 이전 버전(계산된 결과만 있는) 기록 호환성 유지
    const isOldRecord = !r.kilosText && !r.addText && r.kilosTotal > 0;
    
    let detailHTML = '';
    if (isOldRecord) {
      detailHTML = `판매액: ${formatNumber(r.kilosTotal)}원
        ${r.addTotal > 0 ? `<br>부대비용: ${formatNumber(r.addTotal)}원` : ''}
        ${r.commissionRate > 0 ? `<br>수수료 ${r.commissionRate}% (+${formatNumber(r.commissionAmount)}원)` : ''}`;
    } else {
      detailHTML = `
        <div style="font-size:0.8rem; color:#555; background:#f5f6f8; padding:8px; border-radius:6px; margin-bottom:6px;">
          ${r.kilosText ? `<div>🐟 <b>품목:</b> ${escapeHtml(r.kilosText)} = ${formatNumber(r.kilosTotal)}원</div>` : ''}
          ${r.addText ? `<div>📦 <b>부대비용:</b> ${escapeHtml(r.addText)} = ${formatNumber(r.addTotal)}원</div>` : ''}
          ${r.commissionRate > 0 ? `<div>🧾 <b>수수료:</b> ${r.commissionRate}% = ${formatNumber(r.commissionAmount)}원</div>` : ''}
        </div>
      `;
    }

    return `
    <div class="record-item" id="sale-rec-${r.id}">
      <div class="record-header">
        <div class="record-company">${escapeHtml(r.companyName)}</div>
        <div class="record-date">${formatDate(r.date || r.createdAt)}</div>
      </div>
      <div class="record-body">
        <div class="record-detail" style="width: 100%;">
          ${detailHTML}
        </div>
        <div class="record-total" style="text-align: right; width: 100%; margin-top: 4px;">총 ${formatNumber(r.total)}원</div>
      </div>
      ${r.memo ? `<div class="record-memo">📝 ${escapeHtml(r.memo)}</div>` : ''}
      <div class="record-actions">
        <button class="btn-pay" style="padding: 4px 12px; font-size: 0.72rem; margin-right:4px;" onclick="openSalesStatement('${r.id}')">거래명세서</button>
        <button class="btn-pay" style="padding: 4px 12px; font-size: 0.72rem; margin-right:4px;" onclick="copySaleRecord('${r.id}')">복사</button>
        <button class="btn-pay" style="padding: 4px 12px; font-size: 0.72rem; margin-right:4px;" onclick="editSaleRecord('${r.id}')">편집</button>
        <button class="btn-delete" onclick="deleteSaleRecord('${r.id}')">삭제</button>
      </div>
    </div>
  `}).join('');
}

function getStatementItems(record) {
  const items = [];
  const salesLines = String(record.kilosText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (salesLines.length) {
    salesLines.forEach((line, index) => items.push({
      name: salesLines.length > 1 ? `판매내역 ${index + 1}` : '판매내역',
      description: line,
      amount: parseAndCalculateMath(line)
    }));
  } else if (Number(record.kilosTotal) > 0) {
    items.push({ name: '판매금액', description: '', amount: Number(record.kilosTotal) });
  }

  const addLines = String(record.addText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (addLines.length) {
    addLines.forEach((line, index) => items.push({
      name: addLines.length > 1 ? `부대비용 ${index + 1}` : '부대비용',
      description: line,
      amount: parseAndCalculateMath(line)
    }));
  } else if (Number(record.addTotal) > 0) {
    items.push({ name: '부대비용', description: '', amount: Number(record.addTotal) });
  }
  if (Number(record.commissionAmount) > 0) {
    items.push({ name: `수수료 ${Number(record.commissionRate) || 0}%`, description: '', amount: Number(record.commissionAmount) });
  }
  return items.length ? items : [{ name: '판매금액', description: '', amount: Number(record.total) || 0 }];
}

function getStatementUserName() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.nickname || user.name || user.username || '손질왕';
  } catch {
    return '손질왕';
  }
}

function getStatementSupplier() {
  const profile = statementProfile || {};
  return {
    businessName: profile.businessName || '-',
    representativeName: profile.representativeName || getStatementUserName(),
    registrationNumber: profile.registrationNumber || '-',
    businessEmail: profile.businessEmail || '-',
    phone: profile.phone || '-',
    bankAccount: profile.bankAccount || '-'
  };
}

function formatStatementDate(rawDate) {
  const date = String(rawDate || getTodayDate()).slice(0, 10).split('-');
  return `${Number(date[0])}년 ${Number(date[1])}월 ${Number(date[2])}일`;
}

function openSalesStatement(id) {
  const record = allSalesRecords.find(item => item.id === id);
  if (!record) return;
  statementSalesRecord = record;
  saveStatementSnapshot(record);
  const items = getStatementItems(record);
  document.getElementById('statement-preview').innerHTML = `
    <div class="statement-title">거 래 명 세 서</div>
    <div class="statement-issued">발급일: ${formatStatementDate(record.date || record.createdAt)}</div>
    <table class="statement-party-table">
      <tr><th>공급<br>받는자</th><td>${escapeHtml(record.companyName)} 귀하</td></tr>
      <tr><th>공급자</th><td>${escapeHtml(getStatementUserName())}</td></tr>
    </table>
    <div class="statement-summary"><span>금일 합계</span><strong>${formatNumber(record.total)} 원</strong></div>
    <table class="statement-items-table">
      <thead><tr><th>No</th><th>품목</th><th>내역</th><th>금액</th></tr></thead>
      <tbody>${items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.description)}</td><td>${formatNumber(item.amount)}</td></tr>`).join('')}</tbody>
    </table>
    ${record.memo ? `<div class="statement-memo">메모: ${escapeHtml(record.memo)}</div>` : ''}
    <div class="statement-footer">총 ${items.length}개 품목 <span>위 금액을 청구합니다.</span></div>`;
  document.getElementById('statement-modal').classList.add('active');
}

function buildStatementText(record) {
  const items = getStatementItems(record);
  const lines = [
    '거 래 명 세 서',
    `발급일: ${formatStatementDate(record.date || record.createdAt)}`,
    `공급받는자: ${record.companyName} 귀하`,
    `공급자: ${getStatementUserName()}`,
    '',
    ...items.map((item, index) => `${index + 1}. ${item.name}${item.description ? ` | ${item.description}` : ''} | ${formatNumber(item.amount)}원`),
    '',
    `금일 합계: ${formatNumber(record.total)}원`
  ];
  if (record.memo) lines.push(`메모: ${record.memo}`);
  lines.push('위 금액을 청구합니다.');
  return lines.join('\n');
}

async function saveStatementSnapshot(record) {
  try {
    await API.post('statements', {
      saleId: record.id,
      companyName: record.companyName,
      saleDate: String(record.date || record.createdAt || getTodayDate()).slice(0, 10),
      total: Number(record.total) || 0,
      content: buildStatementText(record)
    });
  } catch (error) {
    console.warn('거래명세서 자동 저장 실패:', error);
  }
}

function closeSalesStatement() {
  document.getElementById('statement-modal').classList.remove('active');
}

function fitCanvasText(ctx, text, maxWidth) {
  const source = String(text || '');
  if (ctx.measureText(source).width <= maxWidth) return source;
  let result = source;
  while (result.length && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function saveSalesStatementImage() {
  const record = statementSalesRecord;
  if (!record) return;
  const items = getStatementItems(record);
  const width = 1200;
  const rowHeight = 82;
  const height = 700 + items.length * rowHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, width - 24, height - 24);
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center';
  ctx.font = '500 44px "Noto Sans KR", sans-serif';
  ctx.fillText('거 래 명 세 서', width / 2, 85);
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(42, 120); ctx.lineTo(width - 42, 120); ctx.stroke();
  ctx.textAlign = 'right';
  ctx.fillStyle = '#4b5563';
  ctx.font = '24px "Noto Sans KR", sans-serif';
  ctx.fillText(`발급일: ${formatStatementDate(record.date || record.createdAt)}`, width - 48, 165);

  const left = 42, right = width - 42, partyTop = 195, partyMid = 285, partyBottom = 375, labelRight = 170;
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 2;
  ctx.strokeRect(left, partyTop, right - left, partyBottom - partyTop);
  ctx.beginPath(); ctx.moveTo(labelRight, partyTop); ctx.lineTo(labelRight, partyBottom); ctx.moveTo(left, partyMid); ctx.lineTo(right, partyMid); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#111827'; ctx.font = '24px "Noto Sans KR", sans-serif';
  ctx.fillText('공급받는자', 105, 250); ctx.fillText('공급자', 105, 340);
  ctx.textAlign = 'left'; ctx.font = '28px "Noto Sans KR", sans-serif';
  ctx.fillText(fitCanvasText(ctx, `${record.companyName} 귀하`, 900), 190, 250);
  ctx.fillText(fitCanvasText(ctx, getStatementUserName(), 900), 190, 340);

  const summaryTop = 398, summaryBottom = 515;
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(left, summaryTop, right - left, summaryBottom - summaryTop);
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 4; ctx.strokeRect(left, summaryTop, right - left, summaryBottom - summaryTop);
  ctx.fillStyle = '#111827'; ctx.textAlign = 'left'; ctx.font = '700 28px "Noto Sans KR", sans-serif'; ctx.fillText('금일 합계', 72, 462);
  ctx.fillStyle = '#1769aa'; ctx.textAlign = 'right'; ctx.font = '700 36px "Noto Sans KR", sans-serif'; ctx.fillText(`${formatNumber(record.total)} 원`, right - 28, 464);

  const tableTop = 545, headerHeight = 60;
  const columns = [left, 105, 350, 900, right];
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(left, tableTop, right - left, headerHeight);
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.strokeRect(left, tableTop, right - left, headerHeight + items.length * rowHeight);
  columns.slice(1, -1).forEach(x => { ctx.beginPath(); ctx.moveTo(x, tableTop); ctx.lineTo(x, tableTop + headerHeight + items.length * rowHeight); ctx.stroke(); });
  ctx.textAlign = 'center'; ctx.fillStyle = '#4b5563'; ctx.font = '23px "Noto Sans KR", sans-serif';
  ['No', '품목', '내역', '금액'].forEach((label, index) => ctx.fillText(label, (columns[index] + columns[index + 1]) / 2, tableTop + 39));
  items.forEach((item, index) => {
    const top = tableTop + headerHeight + index * rowHeight;
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(right, top); ctx.stroke();
    ctx.fillStyle = '#111827'; ctx.font = '23px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center'; ctx.fillText(String(index + 1), (columns[0] + columns[1]) / 2, top + 50);
    ctx.textAlign = 'left'; ctx.fillText(fitCanvasText(ctx, item.name, 215), columns[1] + 16, top + 50);
    ctx.fillStyle = '#4b5563'; ctx.fillText(fitCanvasText(ctx, item.description, 515), columns[2] + 16, top + 50);
    ctx.fillStyle = '#111827'; ctx.textAlign = 'right'; ctx.fillText(formatNumber(item.amount), columns[4] - 16, top + 50);
  });
  const footerY = tableTop + headerHeight + items.length * rowHeight + 70;
  ctx.strokeStyle = '#9ca3af'; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(left, footerY - 30); ctx.lineTo(right, footerY - 30); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#4b5563'; ctx.font = '24px "Noto Sans KR", sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`총 ${items.length}개 품목`, left, footerY + 10);
  ctx.textAlign = 'right'; ctx.fillText('위 금액을 청구합니다.', right, footerY + 10);

  const link = document.createElement('a');
  const safeCompany = String(record.companyName || '거래처').replace(/[\\/:*?"<>|]/g, '_');
  link.download = `거래명세서_${safeCompany}_${String(record.date || record.createdAt).slice(0, 10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('📷 거래명세서를 사진으로 저장했습니다.');
}

let statementOutstandingBalance = null;
let statementRemainingBalance = null;

function parseStatementItemLine(line) {
  const raw = String(line || '').trim();
  const expression = raw.replace(/\s*=\s*[\d,]+(?:\.\d+)?\s*원?\s*$/, '').trim();
  const match = expression.match(/^(.*?)\s+([\d,]+(?:\.\d+)?\s*(?:kg|킬로|미|개|마리|박스|상자|팩|봉|통|망)?)\s*\*\s*([\d,]+(?:\.\d+)?)\s*원?\s*$/i);
  const amount = match
    ? Number(match[2].replace(/[^\d.]/g, '')) * Number(match[3].replace(/,/g, ''))
    : (Number(parseAndCalculateMath(expression)) || 0);
  if (!match) {
    return { name: expression || '판매품목', quantity: null, unitPrice: null, amount, raw: expression };
  }
  return {
    name: match[1].trim() || '판매품목',
    quantity: match[2].replace(/\s+/g, ''),
    unitPrice: Number(match[3].replace(/,/g, '')),
    amount,
    raw: expression
  };
}

function getStatementItems(record) {
  const lines = String(record.kilosText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length) return lines.map(parseStatementItemLine);
  return [{
    name: '판매품목', quantity: null, unitPrice: null,
    amount: Number(record.kilosTotal) || Number(record.total) || 0, raw: ''
  }];
}

function getStatementExtras(record) {
  return {
    addText: String(record.addText || '').trim(),
    addAmount: Number(record.addTotal) || 0,
    commissionRate: Number(record.commissionRate) || 0,
    commissionAmount: Number(record.commissionAmount) || 0
  };
}

function formatStatementValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return formatNumber(value);
  return String(value);
}

function getStatementGrandTotal(record, balance) {
  return (Number(record.total) || 0) + (balance === null ? 0 : (Number(balance) || 0));
}

async function getStatementBalance(record) {
  try {
    const saleDate = String(record.date || record.createdAt || getTodayDate()).slice(0, 10);
    const cutoff = String(record.createdAt || `${saleDate}T23:59:59.999Z`);
    const query = new URLSearchParams({ beforeDate: saleDate, beforeCreatedAt: cutoff, excludeSaleId: record.id || '' });
    const response = await API.get(`companies/${encodeURIComponent(record.companyName)}/balance?${query.toString()}`);
    return Math.max(0, Number(response.balance) || 0);
  } catch (error) {
    console.warn('미수금 조회 실패:', error);
    return null;
  }
}

async function getCurrentCompanyBalance(companyName) {
  try {
    const response = await API.get(`companies/${encodeURIComponent(companyName)}/balance`);
    return Math.max(0, Number(response.balance) || 0);
  } catch (error) {
    console.warn('현재 미수금 조회 실패:', error);
    return null;
  }
}

async function openSalesStatement(id) {
  const record = allSalesRecords.find(item => item.id === id);
  if (!record) return;
  statementSalesRecord = record;
  [statementOutstandingBalance, statementRemainingBalance] = await Promise.all([
    getStatementBalance(record),
    getCurrentCompanyBalance(record.companyName)
  ]);
  await saveStatementSnapshot(record, statementOutstandingBalance, statementRemainingBalance);
  const items = getStatementItems(record);
  const extras = getStatementExtras(record);
  const supplier = getStatementSupplier();
  const balanceText = statementRemainingBalance === null ? '확인 불가' : `${formatNumber(statementRemainingBalance)}원`;
  const grandTotal = getStatementGrandTotal(record, statementOutstandingBalance);
  document.getElementById('statement-preview').innerHTML = `
    <div class="statement-title">거 래 명 세 서</div>
    <div class="statement-issued">발급일: ${formatStatementDate(record.date || record.createdAt)}</div>
    <table class="statement-party-table">
      <tr><th>공급자</th><td><div class="statement-supplier-details">
        <span><b>상호</b> ${escapeHtml(supplier.businessName)}</span><span><b>성명</b> ${escapeHtml(supplier.representativeName)}</span>
        <span><b>등록번호</b> ${escapeHtml(supplier.registrationNumber)}</span><span><b>이메일</b> ${escapeHtml(supplier.businessEmail)}</span>
        <span><b>휴대번호</b> ${escapeHtml(supplier.phone)}</span><span><b>계좌번호</b> ${escapeHtml(supplier.bankAccount)}</span>
      </div></td></tr>
      <tr><th>공급<br>받는자</th><td>${escapeHtml(record.companyName)} 귀하</td></tr>
    </table>
    <table class="statement-items-table">
      <thead><tr><th>품목</th><th>KG / 수량</th><th>단가</th><th>금액</th></tr></thead>
      <tbody>${items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${formatStatementValue(item.quantity)}</td><td>${item.unitPrice === null ? '-' : `${formatNumber(item.unitPrice)}원`}</td><td>${formatNumber(item.amount)}원</td></tr>`).join('')}</tbody>
    </table>
    <div class="statement-breakdown">
      <div><span>부대비용</span><strong>${extras.addText ? `${escapeHtml(extras.addText)} = ` : ''}${formatNumber(extras.addAmount)}원</strong></div>
      <div><span>수수료</span><strong>${formatNumber(extras.commissionRate)}% = ${formatNumber(extras.commissionAmount)}원</strong></div>
      <div><span>기존 미수금</span><strong>${balanceText}</strong></div>
    </div>
    <div class="statement-grand-total"><span>청구 합계</span><strong>${formatNumber(grandTotal)}원</strong></div>
    ${record.memo ? `<div class="statement-memo">메모: ${escapeHtml(record.memo)}</div>` : ''}
    <div class="statement-footer"><small>위 금액을 청구합니다.</small></div>`;
  document.getElementById('statement-modal').classList.add('active');
}

function buildStatementText(record, balance = null, remainingBalance = null) {
  const items = getStatementItems(record);
  const extras = getStatementExtras(record);
  const supplier = getStatementSupplier();
  const grandTotal = getStatementGrandTotal(record, balance);
  const lines = [
    '거래명세서',
    `발급일: ${formatStatementDate(record.date || record.createdAt)}`,
    `공급자 상호: ${supplier.businessName}`,
    `공급자 성명: ${supplier.representativeName}`,
    `등록번호: ${supplier.registrationNumber}`,
    `이메일: ${supplier.businessEmail}`,
    `휴대번호: ${supplier.phone}`,
    `계좌번호: ${supplier.bankAccount}`,
    `공급받는자: ${record.companyName} 귀하`,
    '',
    '품목 | KG / 수량 | 단가 | 금액',
    ...items.map(item => `${item.name} | ${formatStatementValue(item.quantity)} | ${item.unitPrice === null ? '-' : `${formatNumber(item.unitPrice)}원`} | ${formatNumber(item.amount)}원`),
    '--------------------------------------------------',
    `부대비용: ${extras.addText ? `${extras.addText} = ` : ''}${formatNumber(extras.addAmount)}원`,
    `수수료: ${formatNumber(extras.commissionRate)}% = ${formatNumber(extras.commissionAmount)}원`,
    `기존 미수금: ${remainingBalance === null ? '확인 불가' : `${formatNumber(remainingBalance)}원`}`,
    '--------------------------------------------------',
    `청구 합계: ${formatNumber(grandTotal)}원`,
    '',
    '위 금액을 청구합니다.'
  ];
  if (record.memo) lines.splice(lines.length - 2, 0, `메모: ${record.memo}`);
  return lines.join('\n');
}

async function saveStatementSnapshot(record, suppliedBalance, suppliedRemainingBalance) {
  try {
    const [balance, remainingBalance] = await Promise.all([
      suppliedBalance === undefined ? getStatementBalance(record) : suppliedBalance,
      suppliedRemainingBalance === undefined ? getCurrentCompanyBalance(record.companyName) : suppliedRemainingBalance
    ]);
    const grandTotal = getStatementGrandTotal(record, balance);
    await API.post('statements', {
      saleId: record.id,
      companyName: record.companyName,
      saleDate: String(record.date || record.createdAt || getTodayDate()).slice(0, 10),
      total: grandTotal,
      content: buildStatementText(record, balance, remainingBalance)
    });
    return true;
  } catch (error) {
    console.warn('거래명세서 자동 저장 실패:', error);
    return false;
  }
}

async function refreshSalesStatementsForCompany(companyName) {
  const normalizedCompanyName = String(companyName || '').trim();
  if (!normalizedCompanyName) return;
  const companyRecords = allSalesRecords.filter(record =>
    String(record.companyName || '').trim() === normalizedCompanyName
  );
  const remainingBalance = await getCurrentCompanyBalance(normalizedCompanyName);
  await Promise.all(companyRecords.map(async record => {
    const balance = await getStatementBalance(record);
    await saveStatementSnapshot(record, balance, remainingBalance);
  }));
}

function saveSalesStatementImage() {
  const record = statementSalesRecord;
  if (!record) return;
  const items = getStatementItems(record);
  const extras = getStatementExtras(record);
  const supplier = getStatementSupplier();
  const grandTotal = getStatementGrandTotal(record, statementOutstandingBalance);
  const width = 1200, rowHeight = 82;
  const height = 1010 + items.length * rowHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const left = 42, right = width - 42;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 4; ctx.strokeRect(12, 12, width - 24, height - 24);
  ctx.fillStyle = '#111827'; ctx.textAlign = 'center'; ctx.font = '500 44px "Noto Sans KR", sans-serif';
  ctx.fillText('거 래 명 세 서', width / 2, 85);
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(left, 120); ctx.lineTo(right, 120); ctx.stroke();
  ctx.textAlign = 'right'; ctx.fillStyle = '#4b5563'; ctx.font = '24px "Noto Sans KR", sans-serif';
  ctx.fillText(`발급일: ${formatStatementDate(record.date || record.createdAt)}`, right, 165);
  const partyTop = 195, partyMid = 395, partyBottom = 485, labelRight = 170;
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.strokeRect(left, partyTop, right-left, partyBottom-partyTop);
  ctx.beginPath(); ctx.moveTo(labelRight, partyTop); ctx.lineTo(labelRight, partyBottom); ctx.moveTo(left, partyMid); ctx.lineTo(right, partyMid); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#111827'; ctx.font = '24px "Noto Sans KR", sans-serif';
  ctx.fillText('공급자', 106, 300); ctx.fillText('공급받는자', 106, 450);
  ctx.textAlign = 'left'; ctx.font = '28px "Noto Sans KR", sans-serif';
  ctx.font = '22px "Noto Sans KR", sans-serif';
  ctx.fillText(fitCanvasText(ctx, `상호 ${supplier.businessName}   |   성명 ${supplier.representativeName}`, 900), 190, 235);
  ctx.fillText(fitCanvasText(ctx, `등록번호 ${supplier.registrationNumber}`, 900), 190, 272);
  ctx.fillText(fitCanvasText(ctx, `이메일 ${supplier.businessEmail}   |   휴대번호 ${supplier.phone}`, 900), 190, 309);
  ctx.fillText(fitCanvasText(ctx, `계좌번호 ${supplier.bankAccount}`, 900), 190, 346);
  ctx.font = '28px "Noto Sans KR", sans-serif';
  ctx.fillText(fitCanvasText(ctx, `${record.companyName} 귀하`, 900), 190, 450);
  const tableTop = 520, headerHeight = 62;
  const columns = [left, 440, 680, 900, right];
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(left, tableTop, right-left, headerHeight);
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.strokeRect(left, tableTop, right-left, headerHeight + items.length*rowHeight);
  columns.slice(1,-1).forEach(x => { ctx.beginPath(); ctx.moveTo(x, tableTop); ctx.lineTo(x, tableTop+headerHeight+items.length*rowHeight); ctx.stroke(); });
  ctx.textAlign = 'center'; ctx.fillStyle = '#4b5563'; ctx.font = '23px "Noto Sans KR", sans-serif';
  ['품목','KG / 수량','단가','금액'].forEach((label,i) => ctx.fillText(label,(columns[i]+columns[i+1])/2,tableTop+41));
  items.forEach((item,index) => {
    const top = tableTop+headerHeight+index*rowHeight;
    ctx.beginPath(); ctx.moveTo(left,top); ctx.lineTo(right,top); ctx.stroke();
    ctx.fillStyle='#111827'; ctx.font='23px "Noto Sans KR", sans-serif';
    ctx.textAlign='center'; ctx.fillText(fitCanvasText(ctx,item.name,360),(columns[0]+columns[1])/2,top+51);
    ctx.textAlign='center'; ctx.fillText(formatStatementValue(item.quantity),(columns[1]+columns[2])/2,top+51);
    ctx.textAlign='center'; ctx.fillText(item.unitPrice===null?'-':`${formatNumber(item.unitPrice)}원`,(columns[2]+columns[3])/2,top+51);
    ctx.fillText(`${formatNumber(item.amount)}원`,(columns[3]+columns[4])/2,top+51);
  });
  let y = tableTop+headerHeight+items.length*rowHeight+52;
  ctx.setLineDash([8,8]); ctx.strokeStyle='#9ca3af'; ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke(); ctx.setLineDash([]);
  const breakdown = [
    ['부대비용', `${extras.addText ? `${extras.addText} = ` : ''}${formatNumber(extras.addAmount)}원`],
    ['수수료', `${formatNumber(extras.commissionRate)}% = ${formatNumber(extras.commissionAmount)}원`],
    ['기존 미수금', statementRemainingBalance===null?'확인 불가':`${formatNumber(statementRemainingBalance)}원`]
  ];
  ctx.font='24px "Noto Sans KR", sans-serif';
  breakdown.forEach(([label,value]) => { y+=48; ctx.fillStyle='#4b5563'; ctx.textAlign='left'; ctx.fillText(label,left,y); ctx.fillStyle='#111827'; ctx.textAlign='right'; ctx.fillText(fitCanvasText(ctx,value,850),right,y); });
  y+=35; ctx.setLineDash([8,8]); ctx.strokeStyle='#9ca3af'; ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke(); ctx.setLineDash([]);
  y+=65; ctx.fillStyle='#111827'; ctx.textAlign='left'; ctx.font='700 30px "Noto Sans KR", sans-serif'; ctx.fillText('청구 합계',left,y);
  ctx.fillStyle='#1769aa'; ctx.textAlign='right'; ctx.font='700 38px "Noto Sans KR", sans-serif'; ctx.fillText(`${formatNumber(grandTotal)}원`,right,y);
  y+=62; ctx.fillStyle='#6b7280'; ctx.textAlign='right'; ctx.font='20px "Noto Sans KR", sans-serif'; ctx.fillText('위 금액을 청구합니다.',right,y);
  const link=document.createElement('a');
  const safeCompany=String(record.companyName||'거래처').replace(/[\\/:*?"<>|]/g,'_');
  link.download=`거래명세서_${safeCompany}_${String(record.date||record.createdAt).slice(0,10)}.png`;
  link.href=canvas.toDataURL('image/png'); link.click();
  showToast('거래명세서를 사진으로 저장했습니다.');
}

window.copySaleRecord = function(id) {
  const r = allSalesRecords.find(x => x.id === id);
  if (!r) return;
  
  let text = `[${r.companyName}] ${formatDate(r.date || r.createdAt)}\n`;
  if (r.kilosText) text += `🐟 판매: ${r.kilosText} = ${formatNumber(r.kilosTotal)}원\n`;
  if (r.addText) text += `📦 부대비용: ${r.addText} = ${formatNumber(r.addTotal)}원\n`;
  if (r.commissionRate > 0) text += `🧾 수수료: ${r.commissionRate}% = ${formatNumber(r.commissionAmount)}원\n`;
  text += `총 합계: ${formatNumber(r.total)}원\n`;
  if (r.memo) text += `📝 메모: ${r.memo}`;
  
  copyTextToClipboard(text.trim());
};

function filterSalesRecords() {
  const q = document.getElementById('records-search').value.trim().toLowerCase();
  const periodRecords = getSalesRecordsForSelectedPeriod();
  const filtered = q
    ? periodRecords.filter(r => String(r.companyName || '').toLowerCase().includes(q))
    : periodRecords;
  renderSalesRecords(filtered);
}

async function deleteSaleRecord(id) {
  if (!confirm('이 판매 기록을 삭제하시겠습니까?\n(미수금 원장에도 즉시 반영됩니다)')) return;
  try {
    await API.del('sales', id);
    showToast('🗑 기록이 삭제되었습니다');
    await loadSalesRecords();
    await loadUnpaidRecords();
  } catch (e) {
    showToast('❌ 삭제 실패: ' + e.message, 'error');
  }
}


// ==========================================
// 미수금 탭 로직 (수납 처리 기능 포함)
// ==========================================
async function loadUnpaidRecords() {
  const container = document.getElementById('records-list-unpaid');
  if(!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await API.get('unpaid');
    allUnpaidRecords = data.data || [];
    renderUnpaidRecords(allUnpaidRecords);
  } catch {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">현황을 불러올 수 없습니다</div></div>`;
  }
}

function renderUnpaidRecords(records) {
  const container = document.getElementById('records-list-unpaid');
  renderedUnpaidRecords = records;
  const unpaidCount = records.filter(r => Number(r.balance) > 0).length;
  const paidCount = records.length - unpaidCount;
  document.getElementById('records-count-unpaid').textContent = `미수 ${unpaidCount}곳 · 완납 ${paidCount}곳`;

  const grandTotal = records.reduce((sum, r) => sum + Math.max(0, Number(r.balance) || 0), 0);
  document.getElementById('total-unpaid-amount').textContent = formatNumber(grandTotal);

  if (!records.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-text">현재 남은 미수금이 없습니다!</div></div>`;
    return;
  }

  container.innerHTML = records.map((r, index) => {
    const safeName = escapeHtml(r.companyName);
    const totalAmount = Number(r.totalAmount) || 0;
    const paidAmount = Number(r.paidAmount) || 0;
    const balance = Math.max(0, Number(r.balance) || 0);
    const isPaid = balance === 0;
    const paymentLabel = isPaid ? '수납 합계' : (paidAmount > 0 ? '일부 수납' : '수납 금액');
    return `
    <div class="record-item" style="border-left: 4px solid ${isPaid ? 'var(--success)' : 'var(--danger)'};">
      <div class="record-header">
        <div class="record-company">${safeName}</div>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
          <button class="btn-pay" style="width:auto; padding:4px 9px; font-size:0.72rem;" onclick="togglePaymentHistory(${index})">수납내역 편집</button>
          <span style="padding: 4px 9px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; color: white; background: ${isPaid ? 'var(--success)' : 'var(--danger)'};">${isPaid ? '완납' : '미수'}</span>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr auto; gap: 6px 16px; margin-top: 10px; font-size: 0.9rem;">
        <span>총 미수금액</span><strong>${formatNumber(totalAmount)}원</strong>
        <span>${paymentLabel}</span><strong style="color: var(--success);">${formatNumber(paidAmount)}원</strong>
        <span>남은 미수금</span><strong style="color: ${isPaid ? 'var(--success)' : 'var(--danger)'}; font-size: 1.05rem;">${formatNumber(balance)}원</strong>
      </div>
      
      <!-- 수납 입력 폼 -->
      ${isPaid ? '' : `<div style="margin-top: 12px; background: #f8f9fa; padding: 12px; border-radius: 8px;">
        <div style="font-size: 0.8rem; color: #666; margin-bottom: 6px;">💵 부분 수납 입력</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <input type="number" id="pay-amt-${index}" class="form-control" style="padding: 6px 10px; flex: 1; min-width: 150px;" placeholder="입금액 (원)" min="1" max="${balance}">
          <button class="btn-save" style="width: auto; padding: 6px 12px;" onclick="submitPayment(${index}, false)">일부 수납</button>
          <button class="btn-pay" style="width: auto; padding: 6px 12px;" onclick="submitPayment(${index}, true)">완납</button>
        </div>
      </div>`}
      <div id="payment-history-${index}" style="display:none; margin-top:12px;"></div>
    </div>
  `}).join('');
}

function filterUnpaidRecords() {
  const q = document.getElementById('records-search-unpaid').value.trim().toLowerCase();
  const filtered = q ? allUnpaidRecords.filter(r => r.companyName.toLowerCase().includes(q)) : allUnpaidRecords;
  renderUnpaidRecords(filtered);
}

async function togglePaymentHistory(recordIndex) {
  const record = renderedUnpaidRecords[recordIndex];
  if (!record) return;
  const container = document.getElementById(`payment-history-${recordIndex}`);
  if (container.style.display !== 'none') {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const response = await API.get(`payments?company=${encodeURIComponent(record.companyName)}`);
    const payments = response.data || [];
    if (!payments.length) {
      container.innerHTML = '<div class="statistics-empty">수정할 수납 내역이 없습니다.</div>';
      return;
    }
    container.innerHTML = `<div style="background:#f8f9fa; padding:12px; border-radius:8px;">
      <div style="font-size:0.82rem; font-weight:700; margin-bottom:8px;">수납 내역</div>
      ${payments.map(payment => `<div style="display:grid; grid-template-columns:1fr minmax(110px, 0.7fr) auto auto; gap:6px; align-items:center; margin-top:7px;">
        <span style="font-size:0.78rem; color:var(--text-muted);">${formatDate(payment.createdAt)}</span>
        <input type="number" id="payment-edit-${payment.id}" class="form-control" min="1" value="${Number(payment.amount) || 0}" style="padding:6px 8px;">
        <button class="btn-save" style="width:auto; padding:6px 9px; font-size:0.72rem;" onclick="updatePayment('${payment.id}')">저장</button>
        <button class="btn-del" style="width:auto; padding:6px 9px; font-size:0.72rem;" onclick="deletePayment('${payment.id}')">삭제</button>
      </div>`).join('')}
    </div>`;
  } catch (error) {
    container.innerHTML = `<div class="statistics-empty">수납 내역을 불러오지 못했습니다.<br>${escapeHtml(error.message)}</div>`;
  }
}

async function updatePayment(id) {
  const amount = Number(document.getElementById(`payment-edit-${id}`).value);
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast('올바른 수납 금액을 입력해주세요.', 'error');
    return;
  }
  try {
    const response = await API.put(`payments/${id}`, { amount });
    await refreshSalesStatementsForCompany(response.companyName);
    showToast('✅ 수납 금액을 수정했습니다.');
    await loadUnpaidRecords();
  } catch (error) {
    showToast('❌ 수납 금액 수정 실패: ' + error.message, 'error');
  }
}

async function deletePayment(id) {
  if (!confirm('이 수납 기록을 삭제하시겠습니까?')) return;
  try {
    const response = await API.del('payments', id);
    await refreshSalesStatementsForCompany(response.companyName);
    showToast('🗑️ 수납 기록을 삭제했습니다.');
    await loadUnpaidRecords();
  } catch (error) {
    showToast('❌ 수납 기록 삭제 실패: ' + error.message, 'error');
  }
}

async function submitPayment(recordIndex, fullPayment = false) {
  const record = renderedUnpaidRecords[recordIndex];
  if (!record) return;

  const companyName = record.companyName;
  const remainingBalance = Math.max(0, Number(record.balance) || 0);
  const input = document.getElementById(`pay-amt-${recordIndex}`);
  const amount = fullPayment ? remainingBalance : parseFloat(input.value);

  if (!amount || amount <= 0) {
    showToast('❗ 정확한 수납(입금) 금액을 입력해주세요.', 'error');
    return;
  }

  if (amount > remainingBalance) {
    showToast(`❗ 남은 미수금 ${formatNumber(remainingBalance)}원보다 많이 수납할 수 없습니다.`, 'error');
    return;
  }

  const actionLabel = fullPayment ? '완납' : '일부수납';
  if (!confirm(`[${companyName}] ${formatNumber(amount)}원을 ${actionLabel} 처리하시겠습니까?`)) return;

  try {
    await API.post('payments', { companyName, amount, memo: actionLabel });
    await refreshSalesStatementsForCompany(companyName);
    showToast(fullPayment ? '✅ 완납 처리되었습니다.' : '💵 일부 수납이 기록되었습니다.');
    await loadUnpaidRecords(); // 뷰 리로드
  } catch (e) {
    showToast('❌ 수납 처리 실패: ' + e.message, 'error');
  }
}
