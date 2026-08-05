// ===================================================
// sales.js - 판매 페이지 로직
// ===================================================

let allSalesRecords = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 오늘 날짜 기본값
  document.getElementById('sale-date').value = getTodayDate();

  // 계산 이벤트
  ['kilos', 'unit-price', 'add-qty', 'add-price', 'commission-rate'].forEach(id => {
    document.getElementById(id).addEventListener('input', calculateSales);
  });

  // 업체명 입력 시 미수금 조회
  let debounceTimer;
  document.getElementById('company-name').addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkUnpaidBalance, 600);
  });

  // 저장 버튼
  document.getElementById('btn-save-sales').addEventListener('click', saveSale);

  // 모달 제어
  const modal = document.getElementById('form-modal');
  document.getElementById('btn-open-modal').addEventListener('click', () => modal.classList.add('active'));
  document.getElementById('btn-close-modal').addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // 검색
  document.getElementById('records-search').addEventListener('input', filterSalesRecords);

  // 초기 데이터 로드
  await loadCompanies();
  await loadSalesRecords();
});

// ---- 계산 ----
function calculateSales() {
  const kilos = parseFloat(document.getElementById('kilos').value) || 0;
  const unitPrice = parseFloat(document.getElementById('unit-price').value) || 0;
  const addQty = parseFloat(document.getElementById('add-qty').value) || 0;
  const addPrice = parseFloat(document.getElementById('add-price').value) || 0;
  const commissionRate = parseFloat(document.getElementById('commission-rate').value) || 0;

  const kilosTotal = kilos * unitPrice;
  const addTotal = addQty * addPrice;
  const subtotal = kilosTotal + addTotal;
  const commissionAmount = subtotal * (commissionRate / 100);
  const grandTotal = subtotal - commissionAmount;

  document.getElementById('kilos-total').textContent = formatNumber(kilosTotal) + '원';
  document.getElementById('add-total').textContent = formatNumber(addTotal) + '원';
  document.getElementById('commission-amount').textContent = formatNumber(commissionAmount) + '원';
  document.getElementById('grand-total').textContent = formatNumber(grandTotal);

  return { kilos, unitPrice, kilosTotal, addQty, addPrice, addTotal, commissionRate, commissionAmount, grandTotal };
}

// ---- 미수금 조회 ----
async function checkUnpaidBalance() {
  const company = document.getElementById('company-name').value.trim();
  const alertEl = document.getElementById('alert-unpaid');

  if (!company) {
    alertEl.style.display = 'none';
    return;
  }

  try {
    const data = await API.get(`companies/${encodeURIComponent(company)}/balance`);
    const balance = data.balance || 0;

    if (balance > 0) {
      document.getElementById('unpaid-amount-display').textContent = formatNumber(balance) + '원';
      alertEl.style.display = 'flex';
    } else {
      alertEl.style.display = 'none';
    }
  } catch {
    alertEl.style.display = 'none';
  }
}

// ---- 업체명 자동완성 및 칩 ----
async function loadCompanies() {
  try {
    const data = await API.get('companies');
    const companies = data.companies || [];
    
    // Datalist 업데이트
    const datalist = document.getElementById('company-datalist');
    datalist.innerHTML = '';
    companies.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      datalist.appendChild(opt);
    });

    // 칩 (버튼) 업데이트
    const chipsContainer = document.getElementById('company-chips');
    if (chipsContainer) {
      chipsContainer.innerHTML = '';
      companies.forEach(name => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.textContent = name;
        chip.onclick = () => {
          document.getElementById('company-name').value = name;
          checkUnpaidBalance(); // 미수금 조회 실행
        };
        chipsContainer.appendChild(chip);
      });
    }
  } catch {
    // 업체 목록 로드 실패 시 무시
  }
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
    addQty: values.addQty,
    addPrice: values.addPrice,
    addTotal: values.addTotal,
    commissionRate: values.commissionRate,
    commissionAmount: values.commissionAmount,
    total: values.grandTotal,
    unpaid: true,
    memo: document.getElementById('sale-memo').value.trim()
  };

  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    await API.post('sales', record);
    showToast('✅ 판매 기록이 저장되었습니다');
    resetSalesForm();
    await loadCompanies();
    await loadSalesRecords();
  } catch (e) {
    showToast('❌ 저장 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 저장하기';
  }
}

function resetSalesForm() {
  ['company-name', 'kilos', 'unit-price', 'add-qty', 'add-price', 'commission-rate', 'sale-memo'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('sale-date').value = getTodayDate();
  document.getElementById('alert-unpaid').style.display = 'none';
  calculateSales();
  
  // 성공 후 폼 닫기
  document.getElementById('form-modal').classList.remove('active');
}

// ---- 기록 로드 ----
async function loadSalesRecords() {
  const container = document.getElementById('records-list');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const data = await API.get('sales');
    allSalesRecords = data.data || [];
    renderSalesRecords(allSalesRecords);
  } catch {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">기록을 불러올 수 없습니다</div>
      </div>`;
  }
}

// ---- 기록 렌더링 ----
function renderSalesRecords(records) {
  const container = document.getElementById('records-list');
  const countEl = document.getElementById('records-count');
  countEl.textContent = `${records.length}건`;

  if (!records.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">저장된 판매 기록이 없습니다</div>
      </div>`;
    return;
  }

  container.innerHTML = records.map(r => {
    const isUnpaid = r.unpaid !== false;
    const statusBadge = isUnpaid
      ? `<span class="status-badge unpaid" style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; margin-left: 8px;">미수</span>`
      : `<span class="status-badge paid" style="background: var(--success); color: white; padding: 2px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; margin-left: 8px;">완납</span>`;

    return `
      <div class="record-item" id="sale-rec-${r.id}">
        <div class="record-header">
          <div class="record-company">
            ${escapeHtml(r.companyName)}
            ${statusBadge}
          </div>
          <div class="record-date">${formatDate(r.date || r.createdAt)}</div>
        </div>
        <div class="record-body">
          <div class="record-detail">
            ${r.kilos}kg × ${formatNumber(r.unitPrice)}원
            ${r.addTotal > 0 ? `<br>부대비용 ${formatNumber(r.addTotal)}원` : ''}
            ${r.commissionRate > 0 ? `<br>수수료 ${r.commissionRate}% (${formatNumber(r.commissionAmount)}원)` : ''}
          </div>
          <div class="record-total">${formatNumber(r.total)}원</div>
        </div>
        ${r.memo ? `<div class="record-memo">📝 ${escapeHtml(r.memo)}</div>` : ''}
        <div class="record-actions">
          ${isUnpaid ? `<button class="btn-pay" style="padding: 4px 12px; background: transparent; border: 1.5px solid var(--success); color: var(--success); border-radius: var(--radius-xs); font-size: 0.72rem; font-family: 'Noto Sans KR', sans-serif; cursor: pointer; transition: var(--transition);" onclick="markAsPaid('${r.id}')">💵 수납 완료</button>` : ''}
          <button class="btn-delete" onclick="deleteSaleRecord('${r.id}')">🗑 삭제</button>
        </div>
      </div>
    `;
  }).join('');
}

// ---- 검색 ----
function filterSalesRecords() {
  const q = document.getElementById('records-search').value.trim().toLowerCase();
  const filtered = q
    ? allSalesRecords.filter(r => r.companyName.toLowerCase().includes(q))
    : allSalesRecords;
  renderSalesRecords(filtered);
}

// ---- 삭제 ----
async function deleteSaleRecord(id) {
  if (!confirm('이 판매 기록을 삭제하시겠습니까?')) return;
  try {
    await API.del('sales', id);
    showToast('🗑 기록이 삭제되었습니다');
    await loadSalesRecords();
    await checkUnpaidBalance();
  } catch (e) {
    showToast('❌ 삭제 실패: ' + e.message, 'error');
  }
}

// ---- 수납 완료 ----
async function markAsPaid(id) {
  if (!confirm('이 판매 건의 수납을 완료 처리하시겠습니까?')) return;
  try {
    await API.put(`sales/${id}`, { unpaid: false });
    showToast('💵 수납 완료 처리되었습니다');
    await loadSalesRecords();
    await checkUnpaidBalance();
  } catch (e) {
    showToast('❌ 처리 실패: ' + e.message, 'error');
  }
}
