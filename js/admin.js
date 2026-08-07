let adminUsers = [];

document.addEventListener('DOMContentLoaded', loadAdminUsers);

async function loadAdminUsers() {
  const container = document.getElementById('admin-users-list');
  try {
    const response = await API.get('admin/users');
    if (!response.isAdmin) throw new Error('관리자만 접근할 수 있습니다.');
    adminUsers = response.data || [];
    document.getElementById('admin-user-count').textContent = `${adminUsers.length}명`;
    container.innerHTML = adminUsers.map(user => `
      <article class="record-item admin-user-card">
        <div class="record-header">
          <div class="record-company">${escapeHtml(user.nickname || user.name || user.username)}${user.isOwner ? ' (관리자)' : ''}</div>
          <div class="record-date">${formatDate(user.createdAt)}</div>
        </div>
        <div class="admin-user-details">
          <div><span>아이디</span><strong>${escapeHtml(user.username)}</strong></div>
          <div><span>이름</span><strong>${escapeHtml(user.name || '-')}</strong></div>
          <div><span>복구 이메일</span><strong>${escapeHtml(user.recoveryEmail || '-')}</strong></div>
        </div>
        <div class="admin-usage-grid">
          <span>판매 ${user.salesCount}건</span><span>수매 ${user.purchasesCount}건</span>
          <span>수납 ${user.paymentsCount}건</span><span>메모 ${user.notesCount}건</span>
          <span>명세서 ${user.statementsCount}건</span><span>총 ${user.totalRecords}건</span>
        </div>
        ${user.isOwner ? '' : `<div class="record-actions"><button class="btn-delete" onclick="deleteAdminUser('${user.id}')">회원 및 데이터 삭제</button></div>`}
      </article>`).join('');
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><div class="empty-text">${escapeHtml(error.message)}</div></div>`;
    if (error.message.includes('관리자')) setTimeout(() => { window.location.href = 'index.html'; }, 1200);
  }
}

async function deleteAdminUser(id) {
  const user = adminUsers.find(item => item.id === id);
  if (!user) return;
  if (!confirm(`${user.username} 회원과 판매·수매·수납·메모·명세서 데이터를 모두 삭제할까요?\n삭제 후 복구할 수 없습니다.`)) return;
  try {
    await API.del('admin/users', id);
    showToast('회원과 관련 데이터를 삭제했습니다.');
    await loadAdminUsers();
  } catch (error) {
    showToast('회원 삭제 실패: ' + error.message, 'error');
  }
}
