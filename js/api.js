// ===================================================
// api.js - Shared API client & utility functions
// ===================================================

const API = {
  baseUrl: '/api',

  async handleResponse(res) {
    if (res.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/' && !window.location.pathname.endsWith('index.html')) {
        window.location.href = '/';
      }
      throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
    }

    if (!res.ok) {
      try {
        const errData = await res.json();
        if (errData && errData.error) {
          throw new Error(errData.error);
        }
      } catch (e) {
        if (e.message && !e.message.includes('JSON')) {
          throw e;
        }
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
  },

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  async get(endpoint) {
    const res = await fetch(`${this.baseUrl}/${endpoint}`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(res);
  },

  async post(endpoint, data) {
    const res = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(res);
  },

  async put(endpoint, data) {
    const res = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(res);
  },

  async del(endpoint, id) {
    const res = await fetch(`${this.baseUrl}/${endpoint}/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return this.handleResponse(res);
  }
};

// ---- Toast ----
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ---- Formatters ----
function formatNumber(n) {
  if (isNaN(n) || n === null || n === undefined) return '0';
  return Math.round(Number(n)).toLocaleString('ko-KR');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  // YYYY-MM-DD format
  if (dateStr.includes('-') && dateStr.length === 10) {
    const [y, m, d] = dateStr.split('-');
    return `${y}.${m}.${d}`;
  }
  // ISO datetime
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  } catch {
    return dateStr;
  }
}

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ---- Security ----
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('✅ 텍스트가 복사되었습니다.');
  } catch(e) {
    showToast('❌ 복사 실패: 지원하지 않는 기기입니다.', 'error');
  }
}

window.copyTextToClipboard = copyTextToClipboard;
