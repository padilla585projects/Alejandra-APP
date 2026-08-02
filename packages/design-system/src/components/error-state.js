(function registerErrorState() {
  function errorStateHtml(message) {
    const safeMessage = String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div style="color:var(--color-danger)">Error: ${safeMessage}</div>`;
  }

  window.AlejandraPresentation = window.AlejandraPresentation || {};
  window.AlejandraPresentation.designSystem = window.AlejandraPresentation.designSystem || {};
  window.AlejandraPresentation.designSystem.errorStateHtml = errorStateHtml;
})();
