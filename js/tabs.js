// js/tabs.js
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      // Activate clicked
      tab.classList.add('active');
      const targetPane = document.getElementById(tab.getAttribute('data-tab'));
      if (targetPane) {
        targetPane.classList.add('active');
      }

      // Hide modal/fab logic if switching tabs (e.g., Unpaid or Notes tab)
      const fab = document.getElementById('btn-open-modal');
      if (fab) {
        if (tab.getAttribute('data-tab') === 'tab-sales' || tab.getAttribute('data-tab') === 'tab-purchase') {
          fab.style.display = 'flex';
        } else {
          fab.style.display = 'none';
        }
      }
    });
  });
});
