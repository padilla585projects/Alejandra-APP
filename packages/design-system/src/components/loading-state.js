(function registerLoadingState() {
  function loadingStateHtml(message = 'Cargando...') {
    const safeMessage = String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div style="color:var(--color-text-muted);font-size:13px">${safeMessage}</div>`;
  }

  window.AlejandraPresentation = window.AlejandraPresentation || {};
  window.AlejandraPresentation.designSystem = window.AlejandraPresentation.designSystem || {};
  window.AlejandraPresentation.designSystem.loadingStateHtml = loadingStateHtml;
})();
