let allStatements = [];
let previewStatementId = null;
let statementProfile = {};

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('statements-search').addEventListener('input', filterStatements);
  document.getElementById('statements-type').addEventListener('change', filterStatements);
  document.getElementById('close-statement-image-preview').addEventListener('click', closeStatementImagePreview);
  document.getElementById('save-previewed-statement').addEventListener('click', () => saveStatementImage(previewStatementId));
  document.getElementById('statement-image-preview-modal').addEventListener('click', event => {
    if (event.target.id === 'statement-image-preview-modal') closeStatementImagePreview();
  });
  await loadStatements();
});

async function loadStatements() {
  const container = document.getElementById('statements-list');
  try {
    const [response, profileResponse] = await Promise.all([API.get('statements'), API.get('profile')]);
    statementProfile = profileResponse.user || {};
    allStatements = (response.data || []).map(record => {
      const total = record.statementType === 'sale'
        ? (Number(record.transactionTotal) || 0) + (Number(record.previousBalance) || 0)
        : Number(record.total) || 0;
      return {
        ...record,
        total,
        content: normalizeStatementContent(
          record.content,
          record.statementType,
          record.previousBalance,
          record.transactionTotal
        )
      };
    });
    filterStatements();
    focusRequestedStatement();
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">거래명세서를 불러오지 못했습니다.<br>${escapeHtml(error.message)}</div></div>`;
  }
}

function renderStatements(records) {
  document.getElementById('statements-count').textContent = `${records.length}건`;
  const container = document.getElementById('statements-list');
  if (!records.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-text">저장된 거래명세서가 없습니다.<br>판매·수매 기록을 저장하면 자동으로 생성됩니다.</div></div>';
    return;
  }
  container.innerHTML = records.map(record => `
    <article class="record-item statement-text-card" id="statement-${record.id}">
      <div class="record-header">
        <div class="record-company"><span class="statement-type-badge ${record.statementType === 'purchase' ? 'purchase' : ''}">${record.statementType === 'purchase' ? '수매' : '판매'}</span>${escapeHtml(record.companyName)}</div>
        <div class="record-date">${formatDate(record.saleDate)}</div>
      </div>
      <div class="record-total">총 ${formatNumber(record.total)}원</div>
      <pre>${escapeHtml(record.content)}</pre>
      <div class="record-actions">
        <button class="btn-pay" onclick="copyStatement('${record.id}')">텍스트 복사</button>
        <button class="btn-pay" onclick="previewStatementImage('${record.id}')">사진 미리보기</button>
        <button class="btn-save" onclick="saveStatementImage('${record.id}')">사진으로 저장</button>
        <button class="btn-delete" onclick="deleteStatement('${record.id}')">삭제</button>
      </div>
    </article>`).join('');
}

function normalizeStatementContent(content, statementType = 'sale', previousBalance = null, transactionTotal = null) {
  let source = String(content || '')
    .replace(/\n?현재\s*남은\s*미수금:\s*(?:확인 불가|[\d,]+원)/g, '');
  if (statementType === 'purchase') {
    source = source
      .replace(/(^|\n)공급자\s+상호:/g, '$1공급자:')
      .replace(/(^|\n)공급받는자\s+상호:/g, '$1공급받는자:');
  }
  if (statementType === 'sale' && previousBalance !== null && transactionTotal !== null) {
    const total = (Number(transactionTotal) || 0) + (Number(previousBalance) || 0);
    const summaryPattern = /^(?:합계|금일 합계|미수금|기존 미수금|청구 합계|총 합계|총합계):.*$/;
    const sourceLines = source.split(/\r?\n/).filter(line => !summaryPattern.test(line.trim()));
    let insertAt = -1;
    sourceLines.forEach((line, index) => {
      if (/^-{5,}$/.test(line.trim())) insertAt = index;
    });
    if (insertAt < 0) insertAt = sourceLines.findIndex(line => /위 금액을 청구합니다/.test(line));
    if (insertAt < 0) insertAt = sourceLines.length;
    sourceLines.splice(insertAt, 0,
      `합계: ${formatNumber(transactionTotal)}원`,
      `미수금: ${formatNumber(previousBalance)}원`,
      `총합계: ${formatNumber(total)}원`
    );
    source = sourceLines.join('\n');
  }
  const lines = source.split(/\r?\n/);
  const isReceiver = line => /^공급받는자(?:\s+상호)?\s*:/.test(line.trim());
  const isSupplier = line => /^(공급자(?:\s+(?:상호|성명))?\s*:|등록번호\s*:|이메일\s*:|휴대번호\s*:|계좌번호\s*:)/.test(line.trim());
  const identityIndexes = [];
  const supplierLines = [];
  let receiverLine = '';
  lines.forEach((line, index) => {
    if (isReceiver(line)) { identityIndexes.push(index); receiverLine = line; }
    else if (isSupplier(line)) { identityIndexes.push(index); supplierLines.push(line); }
  });
  if (!receiverLine || !supplierLines.length) return lines.join('\n');
  const insertAt = Math.min(...identityIndexes);
  const remaining = lines.filter((_, index) => !identityIndexes.includes(index));
  remaining.splice(insertAt, 0, ...supplierLines, receiverLine);
  return remaining.join('\n');
}

function filterStatements() {
  const query = document.getElementById('statements-search').value.trim().toLowerCase();
  const type = document.getElementById('statements-type').value;
  const filtered = allStatements.filter(record => {
    const matchesType = type === 'all' || record.statementType === type;
    const matchesQuery = !query || String(record.companyName || '').toLowerCase().includes(query);
    return matchesType && matchesQuery;
  });
  renderStatements(filtered);
}

function focusRequestedStatement() {
  const id = sessionStorage.getItem('statement-focus-id');
  if (!id) return;
  sessionStorage.removeItem('statement-focus-id');
  requestAnimationFrame(() => {
    const card = document.getElementById(`statement-${id}`);
    if (!card) return;
    card.classList.add('statement-focused');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
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

function createStatementCanvas(record) {
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
  return canvas;
}

function getFormalStatementItems(record) {
  const lines = String(record.kilosText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const fallbackAmount = Number(record.kilosTotal) || Number(record.total) || 0;
  const fallbackName = record.statementType === 'purchase' ? '수매품목' : '판매품목';
  if (!lines.length) return [{ name: fallbackName, quantity: '-', unitPrice: '-', amount: fallbackAmount }];
  return lines.map((line, index) => {
    const expression = line.replace(/\s*=\s*[\d,]+(?:\.\d+)?\s*원?\s*$/, '').trim();
    const match = expression.match(/^(.*?)\s+([\d,]+(?:\.\d+)?\s*(?:kg|킬로|미|개|마리|박스|상자|팩|봉|통|망)?)\s*\*\s*([\d,]+(?:\.\d+)?)\s*원?\s*$/i);
    if (!match) return { name: expression || fallbackName, quantity: '-', unitPrice: '-', amount: lines.length === 1 && index === 0 ? fallbackAmount : 0 };
    const quantityNumber = Number(match[2].replace(/[^\d.]/g, ''));
    const unitPrice = Number(match[3].replace(/,/g, ''));
    return { name: match[1].trim(), quantity: match[2].replace(/\s+/g, ''), unitPrice, amount: quantityNumber * unitPrice };
  });
}

function statementDateLabel(date) {
  const parts = String(date || '').slice(0, 10).split('-');
  return parts.length === 3 ? `${Number(parts[0])}년 ${Number(parts[1])}월 ${Number(parts[2])}일` : String(date || '');
}

function canvasFitText(ctx, text, maxWidth) {
  const source = String(text || '');
  if (ctx.measureText(source).width <= maxWidth) return source;
  let result = source;
  while (result.length && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function createFormalStatementCanvas(record) {
  const items = getFormalStatementItems(record);
  const isPurchase = record.statementType === 'purchase';
  const width = 1200, rowHeight = 82, height = 1010 + items.length * rowHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const left = 42, right = width - 42;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 4; ctx.strokeRect(12, 12, width - 24, height - 24);
  ctx.fillStyle = '#111827'; ctx.textAlign = 'center'; ctx.font = '500 44px "Noto Sans KR", sans-serif'; ctx.fillText('거 래 명 세 서', width / 2, 85);
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(left, 120); ctx.lineTo(right, 120); ctx.stroke();
  ctx.textAlign = 'right'; ctx.fillStyle = '#4b5563'; ctx.font = '24px "Noto Sans KR", sans-serif'; ctx.fillText(`발급일: ${statementDateLabel(record.saleDate)}`, right, 165);
  const partyTop = 195, partyMid = 395, partyBottom = 485, labelRight = 170;
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.strokeRect(left, partyTop, right-left, partyBottom-partyTop);
  ctx.beginPath(); ctx.moveTo(labelRight, partyTop); ctx.lineTo(labelRight, partyBottom); ctx.moveTo(left, partyMid); ctx.lineTo(right, partyMid); ctx.stroke();
  ctx.textAlign='center'; ctx.fillStyle='#111827'; ctx.font='24px "Noto Sans KR", sans-serif'; ctx.fillText('공급자',106,300); ctx.fillText('공급받는자',106,450);
  const profileBusiness = statementProfile.businessName || statementProfile.nickname || statementProfile.name || '-';
  ctx.textAlign='left';
  if (isPurchase) {
    ctx.font='28px "Noto Sans KR", sans-serif';
    ctx.fillText(canvasFitText(ctx, record.companyName, 900), 190, 300);
    ctx.fillText(canvasFitText(ctx, profileBusiness, 900), 190, 450);
  } else {
    ctx.font='22px "Noto Sans KR", sans-serif';
    const supplierLines = [
      `상호 ${profileBusiness}   |   성명 ${statementProfile.representativeName || statementProfile.name || '-'}`,
      `등록번호 ${statementProfile.registrationNumber || '-'}`,
      `이메일 ${statementProfile.businessEmail || '-'}   |   휴대번호 ${statementProfile.phone || '-'}`,
      `계좌번호 ${statementProfile.bankAccount || '-'}`
    ];
    supplierLines.forEach((line, index) => ctx.fillText(canvasFitText(ctx, line, 900), 190, 235 + index * 37));
    ctx.font='28px "Noto Sans KR", sans-serif';
    ctx.fillText(canvasFitText(ctx, `${record.companyName} 귀하`, 900), 190, 450);
  }
  const tableTop=520, headerHeight=62, columns=[left,440,680,900,right];
  ctx.fillStyle='#f8fafc'; ctx.fillRect(left,tableTop,right-left,headerHeight); ctx.strokeStyle='#111827'; ctx.lineWidth=2; ctx.strokeRect(left,tableTop,right-left,headerHeight+items.length*rowHeight);
  columns.slice(1,-1).forEach(x=>{ctx.beginPath();ctx.moveTo(x,tableTop);ctx.lineTo(x,tableTop+headerHeight+items.length*rowHeight);ctx.stroke();});
  ctx.textAlign='center';ctx.fillStyle='#4b5563';ctx.font='23px "Noto Sans KR", sans-serif';['품목','KG / 수량','단가','금액'].forEach((label,i)=>ctx.fillText(label,(columns[i]+columns[i+1])/2,tableTop+41));
  items.forEach((item,index)=>{const top=tableTop+headerHeight+index*rowHeight;ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(right,top);ctx.stroke();ctx.fillStyle='#111827';ctx.font='23px "Noto Sans KR", sans-serif';ctx.textAlign='center';ctx.fillText(canvasFitText(ctx,item.name,360),(columns[0]+columns[1])/2,top+51);ctx.fillText(item.quantity,(columns[1]+columns[2])/2,top+51);ctx.fillText(item.unitPrice==='-'?'-':`${formatNumber(item.unitPrice)}원`,(columns[2]+columns[3])/2,top+51);ctx.fillText(`${formatNumber(item.amount)}원`,(columns[3]+columns[4])/2,top+51);});
  let y=tableTop+headerHeight+items.length*rowHeight+52;ctx.setLineDash([8,8]);ctx.strokeStyle='#9ca3af';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.setLineDash([]);
  const transactionTotal=Number(record.transactionTotal)||Number(record.total)||0;
  const previousBalance=Number(record.previousBalance)||0;
  const breakdown=isPurchase
    ? [['거래 구분','수매']]
    : [['부대비용',`${record.addText?`${record.addText} = `:''}${formatNumber(record.addTotal)}원`],['수수료',`${formatNumber(record.commissionRate)}% = ${formatNumber(record.commissionAmount)}원`],['합계',`${formatNumber(transactionTotal)}원`],['미수금',`${formatNumber(previousBalance)}원`]];
  ctx.font='24px "Noto Sans KR", sans-serif';breakdown.forEach(([label,value])=>{y+=48;ctx.fillStyle='#4b5563';ctx.textAlign='left';ctx.fillText(label,left,y);ctx.fillStyle='#111827';ctx.textAlign='right';ctx.fillText(canvasFitText(ctx,value,850),right,y);});
  y+=35;ctx.setLineDash([8,8]);ctx.strokeStyle='#9ca3af';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.setLineDash([]);y+=65;ctx.fillStyle='#111827';ctx.textAlign='left';ctx.font='700 30px "Noto Sans KR", sans-serif';ctx.fillText(isPurchase ? '총 합계' : '총합계',left,y);ctx.fillStyle='#1769aa';ctx.textAlign='right';ctx.font='700 38px "Noto Sans KR", sans-serif';ctx.fillText(`${formatNumber(record.total)}원`,right,y);y+=62;ctx.fillStyle='#6b7280';ctx.textAlign='right';ctx.font='20px "Noto Sans KR", sans-serif';ctx.fillText(isPurchase ? '위 금액을 지급합니다.' : '위 금액을 청구합니다.',right,y);
  return canvas;
}

function previewStatementImage(id) {
  const record = allStatements.find(item => item.id === id);
  if (!record) return;
  previewStatementId = id;
  document.getElementById('statement-image-preview').src = createFormalStatementCanvas(record).toDataURL('image/png');
  document.getElementById('statement-image-preview-modal').classList.add('active');
}

function closeStatementImagePreview() {
  document.getElementById('statement-image-preview-modal').classList.remove('active');
  previewStatementId = null;
}

function saveStatementImage(id) {
  const record = allStatements.find(item => item.id === id);
  if (!record) return;
  const canvas = createFormalStatementCanvas(record);
  const link = document.createElement('a');
  const safeCompany = String(record.companyName || '거래처').replace(/[\\/:*?"<>|]/g, '_');
  link.download = `${record.statementType === 'purchase' ? '수매' : '판매'}_거래명세서_${safeCompany}_${record.saleDate}.png`;
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
