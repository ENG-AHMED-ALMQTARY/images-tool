// UI logic: tab switching, dark mode, drag & drop, etc.
document.addEventListener('DOMContentLoaded', () => {
  // Restore tab from localStorage
  const savedTab = localStorage.getItem('activeTab');
  if (savedTab) {
    document.querySelectorAll('.tabs li').forEach(t => t.classList.remove('active'));
    const tabLi = document.querySelector('.tabs li[data-tab="' + savedTab + '"]');
    if (tabLi) tabLi.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(sec => sec.classList.remove('active'));
    const tabSec = document.getElementById(savedTab);
    if (tabSec) tabSec.classList.add('active');
  }
  // Tab switching
  document.querySelectorAll('.tabs li').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tabs li').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(sec => sec.classList.remove('active'));
      document.getElementById(tab.dataset.tab).classList.add('active');
      // Save tab
      localStorage.setItem('activeTab', tab.dataset.tab);
    });
  });
  // Restore dark mode from localStorage
  if (localStorage.getItem('darkMode') === '1') {
    document.body.classList.add('dark');
    document.getElementById('darkModeToggle').textContent = '☀️';
  }
  // Dark mode toggle
  const darkToggle = document.getElementById('darkModeToggle');
  darkToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    darkToggle.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('darkMode', isDark ? '1' : '0');
  });
});

window.showMessage = function(msg, type = 'success', duration = 5000) {
  const el = document.getElementById('float-message');
  el.textContent = msg;
  el.className = type;
  el.style.display = 'block';
  clearTimeout(window._floatMsgTimeout);
  window._floatMsgTimeout = setTimeout(() => {
    el.style.display = 'none';
  }, duration);
};
