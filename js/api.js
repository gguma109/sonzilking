// ===================================================
// api.js - Shared API client & utility functions
// ===================================================

const API = {
  baseUrl: '/api',

  async handleResponse(res) {
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

  async get(endpoint) {
    const res = await fetch(`${this.baseUrl}/${endpoint}`);
    return this.handleResponse(res);
  },

  async post(endpoint, data) {
    const res = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return this.handleResponse(res);
  },

  async put(endpoint, data) {
    const res = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return this.handleResponse(res);
  },

  async del(endpoint, id) {
    const res = await fetch(`${this.baseUrl}/${endpoint}/${id}`, {
      method: 'DELETE'
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
