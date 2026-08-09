// 검색·선택·이름 변경을 지원하는 판매/수매 업체 선택기
function createCompanyPicker({ type, inputId, containerId, onRename }) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  const typeLabel = type === 'sales' ? '판매' : '수매';
  let companies = [];

  container.innerHTML = `
    <button type="button" class="company-picker-toggle" aria-expanded="false">
      <span>${typeLabel} 업체 목록에서 선택</span>
      <span class="company-picker-count">0곳</span>
      <span class="company-picker-arrow">⌄</span>
    </button>
    <div class="company-picker-panel" hidden>
      <div class="company-picker-heading">
        <strong>${typeLabel} 업체</strong>
        <button type="button" class="company-picker-close" aria-label="업체 목록 닫기">✕</button>
      </div>
      <input type="search" class="company-picker-search" placeholder="업체명 검색" autocomplete="off">
      <div class="company-picker-list"></div>
      <p class="company-picker-hint">목록에 없으면 위 업체명 칸에 직접 입력하세요.</p>
    </div>`;

  const toggle = container.querySelector('.company-picker-toggle');
  const panel = container.querySelector('.company-picker-panel');
  const search = container.querySelector('.company-picker-search');
  const list = container.querySelector('.company-picker-list');
  const count = container.querySelector('.company-picker-count');

  function render(query = '') {
    const normalized = query.trim().toLowerCase();
    const filtered = companies.filter(company => company.name.toLowerCase().includes(normalized));
    list.replaceChildren();

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'company-picker-empty';
      empty.textContent = companies.length === 0 ? `등록된 ${typeLabel} 업체가 없습니다.` : '검색 결과가 없습니다.';
      list.appendChild(empty);
      return;
    }

    filtered.forEach(company => {
      const row = document.createElement('div');
      row.className = 'company-picker-row';

      const selectButton = document.createElement('button');
      selectButton.type = 'button';
      selectButton.className = 'company-picker-select';
      const name = document.createElement('span');
      name.className = 'company-picker-name';
      name.textContent = company.name;
      const usage = document.createElement('small');
      usage.textContent = `${company.recordCount}건`;
      selectButton.append(name, usage);
      selectButton.addEventListener('click', () => {
        input.value = company.name;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        close();
      });

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'company-picker-edit';
      editButton.textContent = '수정';
      editButton.setAttribute('aria-label', `${company.name} 업체명 수정`);
      editButton.addEventListener('click', () => rename(company.name));

      row.append(selectButton, editButton);
      list.appendChild(row);
    });
  }

  function open(query = '') {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    container.classList.add('open');
    search.value = query;
    render(query);
  }

  function close() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    container.classList.remove('open');
  }

  async function load() {
    try {
      const response = await API.get(`companies?type=${encodeURIComponent(type)}`);
      companies = response.companies || [];
      count.textContent = `${companies.length}곳`;
      render(search.value);
    } catch (error) {
      companies = [];
      count.textContent = '불러오기 실패';
      render();
    }
  }

  async function rename(oldName) {
    const newName = prompt(`변경할 업체명을 입력해주세요.`, oldName);
    if (newName === null) return;
    const trimmedName = newName.trim();
    if (!trimmedName) return showToast('업체명을 입력해주세요.', 'error');
    if (trimmedName === oldName) return;
    const targetExists = companies.some(company => company.name === trimmedName);
    const message = targetExists
      ? `이미 있는 '${trimmedName}' 업체와 합칠까요?\n관련된 ${typeLabel} 기록의 업체명이 모두 변경됩니다.`
      : `'${oldName}'을(를) '${trimmedName}'(으)로 변경할까요?\n관련된 ${typeLabel} 기록의 업체명이 모두 변경됩니다.`;
    if (!confirm(message)) return;

    try {
      await API.put('companies', { type, oldName, newName: trimmedName });
      if (input.value.trim() === oldName) {
        input.value = trimmedName;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await load();
      if (typeof onRename === 'function') await onRename();
      showToast('업체명을 변경했습니다.');
    } catch (error) {
      showToast('업체명 변경 실패: ' + error.message, 'error');
    }
  }

  toggle.addEventListener('click', () => panel.hidden ? open() : close());
  container.querySelector('.company-picker-close').addEventListener('click', close);
  search.addEventListener('input', () => render(search.value));
  input.addEventListener('focus', () => open());
  input.addEventListener('input', () => {
    if (panel.hidden) open(input.value);
    else render(input.value);
  });
  document.addEventListener('click', event => {
    if (!container.contains(event.target) && event.target !== input) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });

  return { load, open, close };
}