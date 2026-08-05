let isLoginMode = true;

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  document.getElementById('auth-title').textContent = isLoginMode ? '로그인' : '회원가입';
  document.getElementById('auth-submit-btn').textContent = isLoginMode ? '로그인' : '회원가입';
  document.getElementById('auth-toggle-text').textContent = isLoginMode ? '계정이 없으신가요?' : '이미 계정이 있으신가요?';
  document.getElementById('auth-toggle-btn').textContent = isLoginMode ? '회원가입' : '로그인';
  
  document.getElementById('register-fields').style.display = isLoginMode ? 'none' : 'block';
  
  // Required fields for register
  document.getElementById('auth-name').required = !isLoginMode;
}

async function handleAuthSubmit() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  
  if (isLoginMode) {
    try {
      const res = await API.post('auth/login', { username, password });
      if (res.success) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        showToast('로그인 성공!');
        checkAuth();
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  } else {
    const name = document.getElementById('auth-name').value.trim();
    const nickname = document.getElementById('auth-nickname').value.trim();
    const recoveryEmail = document.getElementById('auth-email').value.trim();
    
    try {
      const res = await API.post('auth/register', { username, password, name, nickname, recoveryEmail });
      if (res.success) {
        showToast('회원가입이 완료되었습니다. 로그인해주세요.');
        toggleAuthMode();
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  checkAuth();
}

function checkAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  const authSection = document.getElementById('auth-section');
  const menuSection = document.getElementById('menu-section');
  
  // If we are on index.html
  if (authSection && menuSection) {
    if (token && userStr) {
      authSection.style.display = 'none';
      menuSection.style.display = 'grid';
      
      try {
        const user = JSON.parse(userStr);
        document.getElementById('welcome-text').textContent = `${user.nickname || user.name}님 환영합니다!`;
      } catch (e) {}
    } else {
      authSection.style.display = 'block';
      menuSection.style.display = 'none';
    }
  } else {
    // Other pages (sales, purchase)
    if (!token) {
      alert('로그인이 필요합니다.');
      window.location.href = '/';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
