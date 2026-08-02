// Primitiva de presentación: no conoce rutas, datos de negocio, autenticación ni permisos.
(function registerToastComponent() {
  const ICONS = { scan: '📸', warn: '⚠️', error: '❌', info: 'ℹ️', success: '✅' };

  function escapeToastText(value) {
    if (!value) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  function createToast({ container, title, message, type = 'info', timeoutMs = 8000, setTimeoutFn = setTimeout }) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="t-icon">${ICONS[type] || 'ℹ️'}</span>
      <div class="t-body"><div class="t-title">${escapeToastText(title)}</div>${escapeToastText(message)}</div>
      <button class="t-close" type="button" aria-label="Cerrar notificación">×</button>`;

    toast.querySelector('.t-close').addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    setTimeoutFn(() => { if (toast.parentElement) toast.remove(); }, timeoutMs);
    return toast;
  }

  window.AlejandraPresentation = window.AlejandraPresentation || {};
  window.AlejandraPresentation.designSystem = window.AlejandraPresentation.designSystem || {};
  window.AlejandraPresentation.designSystem.createToast = createToast;
})();
