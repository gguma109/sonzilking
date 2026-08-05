// ===================================================
// sales.js - 판매 페이지 로직 (판매/미수금 탭)
// ===================================================

let allSalesRecords = [];
let allUnpaidRecords = [];
let editSalesId = null; // 현재 편집 중인 레코드 ID;

document.addEventListener('DOMContentLoaded', async () => {
  // 기본 날짜
  document.getElementById('sale-date').value = getTodayDate();

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
  let grandTotal = kilosTotal + addTotal;

  if (commissionRate > 0) {
    commissionAmount = grandTotal * (commissionRate / 100);
  }

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

// ---- 업체명 자동완성 및 칩 ----
async function loadCompanies() {
  try {
    const data = await API.get('companies');
    const companies = data.companies || [];
    
    const datalist = document.getElementById('company-datalist');
    datalist.innerHTML = '';
    companies.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      datalist.appendChild(opt);
    });

    const chipsContainer = document.getElementById('company-chips');
    if (chipsContainer) {
      chipsContainer.innerHTML = '';
      companies.forEach(name => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.textContent = name;
        chip.onclick = () => {
          document.getElementById('company-name').value = name;
          checkUnpaidBalance();
        };
        chipsContainer.appendChild(chip);
      });
    }
  } catch {}
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
    if (editSalesId) {
      await API.put(`sales/${editSalesId}`, record);
      showToast('✅ 판매 기록이 수정되었습니다');
    } else {
      await API.post('sales', record);
      showToast('✅ 판매 기록이 저장되었습니다');
    }
    
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
    renderSalesRecords(allSalesRecords);
  } catch {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">기록을 불러올 수 없습니다</div></div>`;
  }
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
        ${r.commissionRate > 0 ? `<br>수수료 ${r.commissionRate}% (-${formatNumber(r.commissionAmount)}원)` : ''}`;
    } else {
      detailHTML = `
        <div style="font-size:0.8rem; color:#555; background:#f5f6f8; padding:8px; border-radius:6px; margin-bottom:6px;">
          ${r.kilosText ? `<div>🐟 <b>입력:</b> ${escapeHtml(r.kilosText)} = ${formatNumber(r.kilosTotal)}원</div>` : ''}
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
        <button class="btn-pay" style="padding: 4px 12px; font-size: 0.72rem; margin-right:4px;" onclick="copySaleRecord('${r.id}')">📋 복사</button>
        <button class="btn-pay" style="padding: 4px 12px; font-size: 0.72rem; margin-right:4px;" onclick="editSaleRecord('${r.id}')">✏️ 편집</button>
        <button class="btn-delete" onclick="deleteSaleRecord('${r.id}')">🗑 삭제</button>
      </div>
    </div>
  `}).join('');
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
  const filtered = q ? allSalesRecords.filter(r => r.companyName.toLowerCase().includes(q)) : allSalesRecords;
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
  document.getElementById('records-count-unpaid').textContent = `${records.length}곳`;

  const grandTotal = records.reduce((sum, r) => sum + r.balance, 0);
  document.getElementById('total-unpaid-amount').textContent = formatNumber(grandTotal);

  if (!records.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-text">현재 남은 미수금이 없습니다!</div></div>`;
    return;
  }

  container.innerHTML = records.map(r => {
    const safeName = escapeHtml(r.companyName);
    return `
    <div class="record-item" style="border-left: 4px solid var(--danger);">
      <div class="record-header">
        <div class="record-company">${safeName}</div>
        <div class="record-total" style="color: var(--danger); font-size: 1.2rem;">${formatNumber(r.balance)}원</div>
      </div>
      
      <!-- 수납 입력 폼 -->
      <div style="margin-top: 12px; background: #f8f9fa; padding: 12px; border-radius: 8px;">
        <div style="font-size: 0.8rem; color: #666; margin-bottom: 6px;">💵 부분 수납 입력</div>
        <div style="display: flex; gap: 8px;">
          <input type="number" id="pay-amt-${safeName}" class="form-control" style="padding: 6px 10px;" placeholder="입금액 (원)">
          <button class="btn-save" style="width: auto; padding: 6px 12px;" onclick="submitPayment('${safeName}')">수납</button>
        </div>
      </div>
    </div>
  `}).join('');
}

function filterUnpaidRecords() {
  const q = document.getElementById('records-search-unpaid').value.trim().toLowerCase();
  const filtered = q ? allUnpaidRecords.filter(r => r.companyName.toLowerCase().includes(q)) : allUnpaidRecords;
  renderUnpaidRecords(filtered);
}

async function submitPayment(companyName) {
  const input = document.getElementById(`pay-amt-${companyName}`);
  const amount = parseFloat(input.value);

  if (!amount || amount <= 0) {
    showToast('❗ 정확한 수납(입금) 금액을 입력해주세요.', 'error');
    return;
  }

  if (!confirm(`[${companyName}] 업체로부터 ${formatNumber(amount)}원을 수납(입금) 처리하시겠습니까?`)) return;

  try {
    await API.post('payments', { companyName, amount, memo: '부분수납' });
    showToast('💵 수납이 정상적으로 기록되었습니다.');
    await loadUnpaidRecords(); // 뷰 리로드
  } catch (e) {
    showToast('❌ 수납 처리 실패: ' + e.message, 'error');
  }
}
