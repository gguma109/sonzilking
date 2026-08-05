// ===================================================
// unpaid.js - 미수금 현황 페이지 로직
// ===================================================

let allUnpaidRecords = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 검색
  document.getElementById('records-search').addEventListener('input', filterRecords);

  // 데이터 로드
  await loadUnpaidRecords();
});

// ---- 미수금 현황 로드 ----
async function loadUnpaidRecords() {
  const container = document.getElementById('records-list');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const data = await API.get('unpaid');
    allUnpaidRecords = data.data || [];
    renderRecords(allUnpaidRecords);
  } catch {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">미수금 현황을 불러올 수 없습니다</div>
      </div>`;
  }
}

// ---- 미수금 현황 렌더링 ----
function renderRecords(records) {
  const container = document.getElementById('records-list');
  const countEl = document.getElementById('records-count');
  countEl.textContent = `${records.length}곳`;

  // 총 미수금 계산
  const grandTotal = records.reduce((sum, r) => sum + r.balance, 0);
  document.getElementById('total-unpaid-amount').textContent = formatNumber(grandTotal);

  if (!records.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎉</div>
        <div class="empty-text">현재 남은 미수금이 없습니다!</div>
      </div>`;
    return;
  }

  container.innerHTML = records.map(r => `
    <div class="record-item" style="border-left: 4px solid var(--danger);">
      <div class="record-header">
        <div class="record-company">${escapeHtml(r.companyName)}</div>
      </div>
      <div class="record-body">
        <div class="record-detail">미수금 총액</div>
        <div class="record-total" style="color: var(--danger); font-size: 1.2rem;">${formatNumber(r.balance)}원</div>
      </div>
    </div>
  `).join('');
}

// ---- 검색 ----
function filterRecords() {
  const q = document.getElementById('records-search').value.trim().toLowerCase();
  const filtered = q
    ? allUnpaidRecords.filter(r => r.companyName.toLowerCase().includes(q))
    : allUnpaidRecords;
  renderRecords(filtered);
}
