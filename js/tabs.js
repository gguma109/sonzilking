// js/tabs.js
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');

  function activateTab(tabId) {
    const targetTab = [...tabs].find(tab => tab.getAttribute('data-tab') === tabId) || tabs[0];
    if (!targetTab) return;

    tabs.forEach(tab => tab.classList.toggle('active', tab === targetTab));
    panes.forEach(pane => pane.classList.toggle('active', pane.id === targetTab.getAttribute('data-tab')));

    const fab = document.getElementById('btn-open-modal');
    if (fab) {
      const activeId = targetTab.getAttribute('data-tab');
      fab.style.display = activeId === 'tab-sales' || activeId === 'tab-purchase' ? 'flex' : 'none';
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      if (tab.classList.contains('active')) return;
      window.history.pushState({ ...(window.history.state || {}), tabId }, '', `#${tabId}`);
      activateTab(tabId);
    });
  });

  window.addEventListener('popstate', event => {
    const tabId = event.state?.tabId || window.location.hash.slice(1) || tabs[0]?.getAttribute('data-tab');
    activateTab(tabId);
  });

  const initialTab = window.history.state?.tabId || window.location.hash.slice(1);
  if (initialTab) activateTab(initialTab);
});
