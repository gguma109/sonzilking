// ===================================================
// purchase.js - 수매 페이지 로직
// ===================================================

let allPurchaseRecords = [];

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('purchase-date').value = getTodayDate();

  document.getElementById('calc-kilos-pur').addEventListener('input', calculatePurchase);
  document.getElementById('btn-save-purchase').addEventListener('click', savePurchase);
  document.getElementById('records-search-pur').addEventListener('input', filterPurchaseRecords);

  // 모달 제어
  const modal = document.getElementById('form-modal');
  document.getElementById('btn-open-modal').addEventListener('click', () => modal.classList.add('active'));
  document.getElementById('btn-close-modal').addEventListener('click', () => modal.classList.remove('active'));
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
    memo: document.getElementById('purchase-memo').value.trim()
  };

  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    await API.post('purchases', record);
    showToast('✅ 수매 기록이 저장되었습니다');
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
  document.getElementById('form-modal').classList.remove('active');
}

// ---- 기록 로드 ----
async function loadPurchaseRecords() {
  const container = document.getElementById('records-list-pur');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const data = await API.get('purchases');
    allPurchaseRecords = data.data || [];
    renderPurchaseRecords(allPurchaseRecords);
  } catch {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">기록을 불러올 수 없습니다</div></div>`;
  }
}

// ---- 기록 렌더링 ----
function renderPurchaseRecords(records) {
  const container = document.getElementById('records-list-pur');
  document.getElementById('records-count-pur').textContent = `${records.length}건`;

  if (!records.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">저장된 수매 기록이 없습니다</div></div>`;
    return;
  }

  container.innerHTML = records.map(r => `
    <div class="record-item" id="pur-rec-${r.id}">
      <div class="record-header">
        <div class="record-company">${escapeHtml(r.companyName)}</div>
        <div class="record-date">${formatDate(r.date || r.createdAt)}</div>
      </div>
      <div class="record-body">
        <div class="record-detail">수매액: ${formatNumber(r.total)}원</div>
        <div class="record-total">${formatNumber(r.total)}원</div>
      </div>
      ${r.memo ? `<div class="record-memo">📝 ${escapeHtml(r.memo)}</div>` : ''}
      <div class="record-actions">
        <button class="btn-delete" onclick="deletePurchaseRecord('${r.id}')">🗑 삭제</button>
      </div>
    </div>
  `).join('');
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

