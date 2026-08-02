function renderSystemHealth(health, { versionElement, statusElement }) {
  if (versionElement) versionElement.textContent = health.version || 'v?';
  if (!statusElement) return;

  const online = health.status === 'ok';
  statusElement.textContent = online ? '● online' : '● error';
  statusElement.style.color = online ? 'var(--color-success)' : 'var(--color-danger)';
}

async function refreshSystemHealth({ apiBaseUrl, elements }) {
  try {
    const health = await window.AlejandraPresentation
      .createAgentClient({ baseUrl: apiBaseUrl })
      .getHealth();
    renderSystemHealth(health, elements);
  } catch {
    // Se conserva el contrato previo: un fallo de salud no modifica la cabecera.
  }
}

window.AlejandraPresentation = window.AlejandraPresentation || {};
window.AlejandraPresentation.systemHealth = { refreshSystemHealth };
