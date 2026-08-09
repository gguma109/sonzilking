let adminUsers = [];
let adminAccessRole = 'member';
let currentAdminUserId = '';
let passwordResetUserId = '';

document.addEventListener('DOMContentLoaded', () => {
  loadAdminUsers();
  document.getElementById('password-reset-form').addEventListener('submit', submitPasswordReset);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePasswordResetModal();
  });
});

function roleLabel(user) {
  if (user.isOwner) return '관리자';
  if (user.role === 'operator') return '운영자';
  return '일반 회원';
}

function renderUserActions(user) {
  const isSelf = user.id === currentAdminUserId;
  const canResetPassword = !isSelf && (adminAccessRole === 'owner' || (adminAccessRole === 'operator' && user.role === 'member'));
  const canManageRole = adminAccessRole === 'owner' && !user.isOwner;
  const canDelete = adminAccessRole === 'owner' && !user.isOwner;
  if (!canResetPassword && !canManageRole && !canDelete) return '';

  const actions = [];
  if (canResetPassword) actions.push(`<button class="btn-admin-action" onclick="resetUserPassword('${user.id}')">비밀번호 재설정</button>`);
  if (canManageRole) {
    const nextRole = user.role === 'operator' ? 'member' : 'operator';
    const label = user.role === 'operator' ? '운영자 해제' : '운영자로 지정';
    actions.push(`<button class="btn-admin-action btn-role" onclick="changeUserRole('${user.id}', '${nextRole}')">${label}</button>`);
  }
  if (canDelete) actions.push(`<button class="btn-delete" onclick="deleteAdminUser('${user.id}')">회원 및 데이터 삭제</button>`);
  return `<div class="record-actions">${actions.join('')}</div>`;
}

async function loadAdminUsers() {
  const container = document.getElementById('admin-users-list');
  try {
    const response = await API.get('admin/users');
    if (!response.isAdmin) throw new Error('관리자 또는 운영자만 접근할 수 있습니다.');
    adminUsers = response.data || [];
    adminAccessRole = response.accessRole || 'member';
    currentAdminUserId = response.currentUserId || '';
    document.getElementById('admin-user-count').textContent = `${adminUsers.length}명`;
    document.getElementById('admin-access-label').textContent = adminAccessRole === 'owner' ? '관리자 권한' : '운영자 권한';
    container.innerHTML = adminUsers.map(user => `
      <article class="record-item admin-user-card">
        <div class="record-header">
          <div class="record-company">${escapeHtml(user.nickname || user.name || user.username)} <span class="admin-role-badge role-${user.role}">${roleLabel(user)}</span></div>
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
        ${renderUserActions(user)}
      </article>`).join('');
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><div class="empty-text">${escapeHtml(error.message)}</div></div>`;
    if (error.message.includes('접근')) setTimeout(() => { window.location.href = 'index.html'; }, 1200);
  }
}

function resetUserPassword(id) {
  const user = adminUsers.find(item => item.id === id);
  if (!user) return;
  passwordResetUserId = id;
  document.getElementById('password-reset-username').textContent = user.username;
  document.getElementById('admin-new-password').value = '';
  document.getElementById('admin-confirm-password').value = '';
  document.getElementById('password-reset-modal').classList.add('active');
  setTimeout(() => document.getElementById('admin-new-password').focus(), 50);
}

function closePasswordResetModal() {
  const modal = document.getElementById('password-reset-modal');
  if (!modal) return;
  modal.classList.remove('active');
  passwordResetUserId = '';
  document.getElementById('password-reset-form')?.reset();
}

async function submitPasswordReset(event) {
  event.preventDefault();
  const user = adminUsers.find(item => item.id === passwordResetUserId);
  if (!user) return closePasswordResetModal();
  const newPassword = document.getElementById('admin-new-password').value;
  const confirmation = document.getElementById('admin-confirm-password').value;
  if (newPassword.length < 4) return showToast('새 비밀번호는 4자 이상 입력해주세요.', 'error');
  if (newPassword !== confirmation) return showToast('새 비밀번호가 일치하지 않습니다.', 'error');
  if (!confirm(`${user.username} 회원의 비밀번호를 재설정할까요?\n해당 회원은 모든 기기에서 로그아웃됩니다.`)) return;
  try {
    await API.put(`admin/users/${user.id}/password`, { newPassword });
    closePasswordResetModal();
    showToast('비밀번호를 재설정하고 기존 로그인을 해제했습니다.');
  } catch (error) {
    showToast('비밀번호 재설정 실패: ' + error.message, 'error');
  }
}

async function changeUserRole(id, role) {
  const user = adminUsers.find(item => item.id === id);
  if (!user) return;
  const action = role === 'operator' ? '운영자로 지정' : '일반 회원으로 변경';
  if (!confirm(`${user.username} 회원을 ${action}할까요?`)) return;
  try {
    await API.put(`admin/users/${id}`, { role });
    showToast(role === 'operator' ? '운영자 권한을 부여했습니다.' : '운영자 권한을 해제했습니다.');
    await loadAdminUsers();
  } catch (error) {
    showToast('권한 변경 실패: ' + error.message, 'error');
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
