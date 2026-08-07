// ===================================================
// purchase.js - 수매 페이지 로직
// ===================================================

let allPurchaseRecords = [];
let editPurchaseId = null; // 현재 편집 중인 레코드 ID

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('purchase-date').value = getTodayDate();
  document.getElementById('purchase-summary-month').value = getTodayDate().slice(0, 7);
  document.getElementById('purchase-summary-day').value = getTodayDate();
  document.getElementById('purchase-summary-period').addEventListener('change', syncPurchaseSummaryPeriod);
  document.getElementById('purchase-summary-month').addEventListener('change', updateMonthlyPurchaseSummary);
  document.getElementById('purchase-summary-day').addEventListener('change', updateMonthlyPurchaseSummary);

  document.getElementById('calc-kilos-pur').addEventListener('input', calculatePurchase);
  document.getElementById('btn-save-purchase').addEventListener('click', savePurchase);
  document.getElementById('records-search-pur').addEventListener('input', filterPurchaseRecords);

  // 모달 제어
  const modal = document.getElementById('form-modal');
  document.getElementById('btn-open-modal').addEventListener('click', () => {
    resetPurchaseForm();
    modal.classList.add('active');
  });
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    resetPurchaseForm();
    modal.classList.remove('active');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  await loadCompanies();
  await loadPurchaseRecords();
});

// ---- 계산 ----
function calculatePurchase() {
  const kilosText = document.getElementById('calc-kilos-pur').value;
  const total = parseAndCalculateMath(kilosText);

  document.getElementById('preview-kilos-pur').textContent = formatNumber(total) + '원';
  document.getElementById('grand-total-pur').textContent = formatNumber(total);

  return { kilos: 1, unitPrice: total, total }; // API 호환
}

// ---- 업체명 자동완성 및 칩 ----
async function loadCompanies() {
  try {
    const data = await API.get('companies');
    const companies = data.companies || [];

    const datalist = document.getElementById('company-datalist-pur');
    datalist.innerHTML = '';
    companies.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      datalist.appendChild(opt);
    });

    const chipsContainer = document.getElementById('company-chips-pur');
    if (chipsContainer) {
      chipsContainer.innerHTML = '';
      companies.forEach(name => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.textContent = name;
        chip.onclick = () => {
          document.getElementById('company-name-pur').value = name;
        };
        chipsContainer.appendChild(chip);
      });
    }
  } catch {}
}

// ---- 저장 ----
async function savePurchase() {
  const btn = document.getElementById('btn-save-purchase');
  const companyName = document.getElementById('company-name-pur').value.trim();

  if (!companyName) {
    showToast('❗ 업체명을 입력해주세요', 'error');
    document.getElementById('company-name-pur').focus();
    return;
  }

  const values = calculatePurchase();

  const record = {
    companyName,
    date: document.getElementById('purchase-date').value || getTodayDate(),
    kilos: values.kilos,
    unitPrice: values.unitPrice,
    total: values.total,
    kilosText: document.getElementById('calc-kilos-pur').value,
    memo: document.getElementById('purchase-memo').value.trim()
  };

  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    if (editPurchaseId) {
      await API.put(`purchases/${editPurchaseId}`, record);
      showToast('✅ 수매 기록이 수정되었습니다');
    } else {
      await API.post('purchases', record);
      showToast('✅ 수매 기록이 저장되었습니다');
    }

    resetPurchaseForm();
    await loadCompanies();
    await loadPurchaseRecords();
  } catch (e) {
    showToast('❌ 저장 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 저장하기';
  }
}

function resetPurchaseForm() {
  ['company-name-pur', 'calc-kilos-pur', 'purchase-memo'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  document.getElementById('purchase-date').value = getTodayDate();
  calculatePurchase();
  editPurchaseId = null;
  document.querySelector('#form-modal .section-title').textContent = '📝 수매 입력';
  document.getElementById('form-modal').classList.remove('active');
}

// ---- 편집(수정) 기능 ----
function editPurchaseRecord(id) {
  const record = allPurchaseRecords.find(r => r.id === id);
  if (!record) return;

  editPurchaseId = id;
  document.querySelector('#form-modal .section-title').textContent = '✏️ 수매 기록 수정';

  document.getElementById('company-name-pur').value = record.companyName;
  document.getElementById('calc-kilos-pur').value = record.kilosText || '';
  document.getElementById('purchase-date').value = (record.date || record.createdAt).split('T')[0];
  document.getElementById('purchase-memo').value = record.memo || '';

  calculatePurchase();
  document.getElementById('form-modal').classList.add('active');
}

// ---- 기록 로드 ----
async function loadPurchaseRecords() {
  const container = document.getElementById('records-list-pur');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const data = await API.get('purchases');
    allPurchaseRecords = data.data || [];
    updateMonthlyPurchaseSummary();
    renderPurchaseRecords(allPurchaseRecords);
  } catch {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">기록을 불러올 수 없습니다</div></div>`;
  }
}

function updateMonthlyPurchaseSummary() {
  const period = document.getElementById('purchase-summary-period').value;
  const selected = document.getElementById(period === 'day' ? 'purchase-summary-day' : 'purchase-summary-month').value;
  const records = allPurchaseRecords.filter(record => String(record.date || record.createdAt || '').slice(0, period === 'day' ? 10 : 7) === selected);
  const total = records.reduce((sum, record) => sum + (Number(record.total) || 0), 0);
  const [year, monthNumber, day] = selected.split('-');
  document.getElementById('purchase-summary-label').textContent = period === 'day'
    ? `${year}년 ${Number(monthNumber)}월 ${Number(day)}일 총 지출`
    : `${year}년 ${Number(monthNumber)}월 총 지출`;
  document.getElementById('purchase-summary-amount').textContent = formatNumber(total);
  document.getElementById('purchase-summary-count').textContent = `${records.length}건`;
}

function syncPurchaseSummaryPeriod() {
  const isDay = document.getElementById('purchase-summary-period').value === 'day';
  const monthInput = document.getElementById('purchase-summary-month');
  const dayInput = document.getElementById('purchase-summary-day');
  monthInput.hidden = isDay;
  dayInput.hidden = !isDay;
  const label = document.getElementById('purchase-summary-date-label');
  label.textContent = isDay ? '조회 날짜' : '조회 월';
  label.htmlFor = isDay ? 'purchase-summary-day' : 'purchase-summary-month';
  updateMonthlyPurchaseSummary();
}

// ---- 기록 렌더링 ----
function renderPurchaseRecords(records) {
  const container = document.getElementById('records-list-pur');
  document.getElementById('records-count-pur').textContent = `${records.length}건`;

  if (!records.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">저장된 수매 기록이 없습니다</div></div>`;
    return;
  }

  container.innerHTML = records.map(r => {
    const isOldRecord = !r.kilosText && r.total > 0;
    
    let detailHTML = '';
    if (isOldRecord) {
      detailHTML = `수매액: ${formatNumber(r.total)}원`;
    } else {
      detailHTML = `
        <div style="font-size:0.8rem; color:#555; background:#f5f6f8; padding:8px; border-radius:6px; margin-bottom:6px;">
          ${r.kilosText ? `<div>🐙 <b>입력:</b> ${escapeHtml(r.kilosText)} = ${formatNumber(r.total)}원</div>` : ''}
        </div>
      `;
    }

    return `
    <div class="record-item" id="pur-rec-${r.id}">
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
        <button class="btn-pay" style="padding: 4px 12px; font-size: 0.72rem; margin-right:4px;" onclick="editPurchaseRecord('${r.id}')">✏️ 편집</button>
        <button class="btn-delete" onclick="deletePurchaseRecord('${r.id}')">🗑 삭제</button>
      </div>
    </div>
  `}).join('');
}

// ---- 검색 ----
function filterPurchaseRecords() {
  const q = document.getElementById('records-search-pur').value.trim().toLowerCase();
  const filtered = q ? allPurchaseRecords.filter(r => r.companyName.toLowerCase().includes(q)) : allPurchaseRecords;
  renderPurchaseRecords(filtered);
}

// ---- 삭제 ----
async function deletePurchaseRecord(id) {
  if (!confirm('이 수매 기록을 삭제하시겠습니까?')) return;
  try {
    await API.del('purchases', id);
    showToast('🗑 기록이 삭제되었습니다');
    await loadPurchaseRecords();
  } catch (e) {
    showToast('❌ 삭제 실패: ' + e.message, 'error');
  }
}
