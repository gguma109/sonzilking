let allStatements = [];

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('statements-search').addEventListener('input', filterStatements);
  await loadStatements();
});

async function loadStatements() {
  const container = document.getElementById('statements-list');
  try {
    const response = await API.get('statements');
    allStatements = response.data || [];
    renderStatements(allStatements);
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">거래명세서를 불러오지 못했습니다.<br>${escapeHtml(error.message)}</div></div>`;
  }
}

function renderStatements(records) {
  document.getElementById('statements-count').textContent = `${records.length}건`;
  const container = document.getElementById('statements-list');
  if (!records.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-text">저장된 거래명세서가 없습니다.<br>판매 기록을 저장하면 자동으로 생성됩니다.</div></div>';
    return;
  }
  container.innerHTML = records.map(record => `
    <article class="record-item statement-text-card">
      <div class="record-header">
        <div class="record-company">${escapeHtml(record.companyName)}</div>
        <div class="record-date">${formatDate(record.saleDate)}</div>
      </div>
      <div class="record-total">총 ${formatNumber(record.total)}원</div>
      <pre>${escapeHtml(record.content)}</pre>
      <div class="record-actions">
        <button class="btn-pay" onclick="copyStatement('${record.id}')">📋 텍스트 복사</button>
        <button class="btn-delete" onclick="deleteStatement('${record.id}')">🗑 삭제</button>
      </div>
    </article>`).join('');
}

function filterStatements() {
  const query = document.getElementById('statements-search').value.trim().toLowerCase();
  renderStatements(query ? allStatements.filter(record => record.companyName.toLowerCase().includes(query)) : allStatements);
}

function copyStatement(id) {
  const record = allStatements.find(item => item.id === id);
  if (record) copyTextToClipboard(record.content);
}

async function deleteStatement(id) {
  if (!confirm('이 거래명세서를 삭제하시겠습니까?')) return;
  try {
    await API.del('statements', id);
    showToast('🗑️ 거래명세서를 삭제했습니다.');
    await loadStatements();
  } catch (error) {
    showToast('❌ 삭제 실패: ' + error.message, 'error');
  }
}
