document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('profile-form').addEventListener('submit', saveProfile);
  await loadProfile();
});

async function loadProfile() {
  try {
    const response = await API.get('profile');
    const user = response.user;
    document.getElementById('profile-username').value = user.username || '';
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-nickname').value = user.nickname || '';
    document.getElementById('profile-email').value = user.recoveryEmail || '';
    document.getElementById('profile-business-name').value = user.businessName || '';
    document.getElementById('profile-representative-name').value = user.representativeName || '';
    document.getElementById('profile-registration-number').value = user.registrationNumber || '';
    document.getElementById('profile-business-email').value = user.businessEmail || '';
    document.getElementById('profile-phone').value = user.phone || '';
  } catch (error) {
    showToast('회원정보를 불러오지 못했습니다: ' + error.message, 'error');
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const name = document.getElementById('profile-name').value.trim();
  const nickname = document.getElementById('profile-nickname').value.trim();
  const recoveryEmail = document.getElementById('profile-email').value.trim();
  const businessName = document.getElementById('profile-business-name').value.trim();
  const representativeName = document.getElementById('profile-representative-name').value.trim();
  const registrationNumber = document.getElementById('profile-registration-number').value.trim();
  const businessEmail = document.getElementById('profile-business-email').value.trim();
  const phone = document.getElementById('profile-phone').value.trim();
  const currentPassword = document.getElementById('profile-current-password').value;
  const newPassword = document.getElementById('profile-new-password').value;
  const confirmPassword = document.getElementById('profile-confirm-password').value;
  if (!name) return showToast('이름을 입력해주세요.', 'error');
  if (newPassword && newPassword !== confirmPassword) return showToast('새 비밀번호가 일치하지 않습니다.', 'error');
  if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) return showToast('현재 비밀번호와 새 비밀번호를 모두 입력해주세요.', 'error');
  try {
    const response = await API.put('profile', { name, nickname, recoveryEmail, businessName, representativeName, registrationNumber, businessEmail, phone, currentPassword, newPassword });
    localStorage.setItem('user', JSON.stringify(response.user));
    document.getElementById('profile-current-password').value = '';
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-confirm-password').value = '';
    showToast('회원정보를 저장했습니다.');
  } catch (error) {
    showToast('저장 실패: ' + error.message, 'error');
  }
}
