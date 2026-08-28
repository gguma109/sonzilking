function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function formatReleaseDate(value) {
  const [year, month, day] = String(value || '').split('-');
  if (!year || !month || !day) return value || '';
  return `${year}.${month}.${day}`;
}

function createReleaseGroup(group) {
  const section = document.createElement('section');
  section.className = 'release-change-group';

  const label = createTextElement('h4', `release-change-label ${group.tone || ''}`, group.label);
  const list = document.createElement('ul');
  list.className = 'release-change-list';

  (group.items || []).forEach(item => {
    list.appendChild(createTextElement('li', '', item));
  });

  section.append(label, list);
  return section;
}

function createReleaseCard(release, isLatest) {
  const article = document.createElement('article');
  article.className = `release-card${isLatest ? ' latest' : ''}`;

  const header = document.createElement('div');
  header.className = 'release-card-header';

  const heading = document.createElement('div');
  heading.className = 'release-card-heading';
  const versionRow = document.createElement('div');
  versionRow.className = 'release-version-row';
  versionRow.append(
    createTextElement('strong', 'release-version', release.version),
    createTextElement('span', `release-status ${release.status === '테스트 배포' ? 'testing' : 'production'}`, release.status)
  );
  if (isLatest) versionRow.appendChild(createTextElement('span', 'release-latest-badge', '최신'));
  heading.append(versionRow, createTextElement('h3', '', release.title));

  header.append(heading, createTextElement('time', 'release-date', formatReleaseDate(release.date)));
  article.append(header, createTextElement('p', 'release-summary', release.summary));

  const changes = document.createElement('div');
  changes.className = 'release-changes';
  (release.groups || []).forEach(group => changes.appendChild(createReleaseGroup(group)));
  article.appendChild(changes);
  return article;
}

document.addEventListener('DOMContentLoaded', () => {
  const releases = Array.isArray(window.SONJILWANG_RELEASES) ? window.SONJILWANG_RELEASES : [];
  const list = document.getElementById('release-list');
  const current = releases[0];

  document.getElementById('release-count').textContent = `${releases.length}개 버전`;

  if (!current) {
    document.getElementById('release-current-summary').textContent = '등록된 업데이트가 없습니다.';
    list.appendChild(createTextElement('div', 'empty-state', '등록된 업데이트가 없습니다.'));
    return;
  }

  document.getElementById('release-current-version').textContent = current.version;
  document.getElementById('release-current-status').textContent = current.status;
  document.getElementById('release-current-summary').textContent = current.title;

  releases.forEach((release, index) => list.appendChild(createReleaseCard(release, index === 0)));
});
