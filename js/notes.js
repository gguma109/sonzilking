// js/notes.js
// 공용 메모장 로직

document.addEventListener('DOMContentLoaded', async () => {
  // 메모 저장 버튼
  const btnSaveNote = document.getElementById('btn-save-note');
  if (btnSaveNote) {
    btnSaveNote.addEventListener('click', saveNote);
  }

  // 탭 전환 시 메모 로드 (초기 1회는 바로 로드)
  await loadNotes();
});

async function loadNotes() {
  const container = document.getElementById('notes-list');
  if (!container) return;
  
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const data = await API.get('notes');
    renderNotes(data.data || []);
  } catch (e) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">메모를 불러올 수 없습니다</div>
      </div>`;
  }
}

function renderNotes(notes) {
  const container = document.getElementById('notes-list');
  if (!container) return;

  if (!notes.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-text">작성된 메모가 없습니다</div>
      </div>`;
    return;
  }

  container.innerHTML = notes.map(n => `
    <div class="note-item" id="note-${n.id}">
      <div class="note-header">
        <div class="note-date">${formatDate(n.createdAt)}</div>
        <button class="btn-close-modal" style="font-size: 1rem;" onclick="deleteNote('${n.id}')">🗑</button>
      </div>
      <div class="note-content">${escapeHtml(n.content)}</div>
    </div>
  `).join('');
}

async function saveNote() {
  const input = document.getElementById('note-input');
  if (!input) return;

  const content = input.value.trim();
  if (!content) {
    showToast('❗ 메모 내용을 입력해주세요.', 'error');
    input.focus();
    return;
  }

  const btn = document.getElementById('btn-save-note');
  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    await API.post('notes', { content });
    showToast('✅ 메모가 저장되었습니다.');
    input.value = '';
    await loadNotes();
  } catch (e) {
    showToast('❌ 메모 저장 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 메모 저장';
  }
}

async function deleteNote(id) {
  if (!confirm('이 메모를 삭제하시겠습니까?')) return;
  try {
    await API.del('notes', id);
    showToast('🗑 메모가 삭제되었습니다.');
    await loadNotes();
  } catch (e) {
    showToast('❌ 삭제 실패: ' + e.message, 'error');
  }
}
