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
        <button class="btn-save" onclick="saveStatementImage('${record.id}')">사진으로 저장</button>
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

function wrapStatementLine(ctx, text, maxWidth) {
  const source = String(text || '');
  if (!source) return [''];
  const rows = [];
  let current = '';
  for (const character of source) {
    const candidate = current + character;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      rows.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) rows.push(current);
  return rows;
}

function saveStatementImage(id) {
  const record = allStatements.find(item => item.id === id);
  if (!record) return;
  const width = 1200;
  const padding = 70;
  const lineHeight = 42;
  const sourceLines = String(record.content || '').split(/\r?\n/);
  const measureCanvas = document.createElement('canvas');
  const measureContext = measureCanvas.getContext('2d');
  measureContext.font = '24px "Noto Sans KR", sans-serif';
  const lines = sourceLines.flatMap(line => wrapStatementLine(measureContext, line, width - padding * 2));
  const height = Math.max(700, padding * 2 + 100 + lines.length * lineHeight);
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
  ctx.font = '700 34px "Noto Sans KR", sans-serif';
  ctx.fillText(`${record.companyName} 거래명세서`, width / 2, 75);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, 100);
  ctx.lineTo(width - padding, 100);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.font = '24px "Noto Sans KR", sans-serif';
  let y = 145;
  lines.forEach(line => {
    ctx.fillText(line, padding, y);
    y += lineHeight;
  });
  const link = document.createElement('a');
  const safeCompany = String(record.companyName || '거래처').replace(/[\\/:*?"<>|]/g, '_');
  link.download = `거래명세서_${safeCompany}_${record.saleDate}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('거래명세서를 사진으로 저장했습니다.');
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
