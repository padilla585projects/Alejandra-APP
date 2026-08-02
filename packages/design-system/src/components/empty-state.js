(function registerEmptyState() {
  function emptyStateHtml({ message, compact = true }) {
    const padding = compact ? '16px' : '30px';
    const safeMessage = String(message)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div style="color:var(--color-text-muted);font-size:12px;text-align:center;padding:${padding}">${safeMessage}</div>`;
  }

  window.AlejandraPresentation = window.AlejandraPresentation || {};
  window.AlejandraPresentation.designSystem = window.AlejandraPresentation.designSystem || {};
  window.AlejandraPresentation.designSystem.emptyStateHtml = emptyStateHtml;
})();
