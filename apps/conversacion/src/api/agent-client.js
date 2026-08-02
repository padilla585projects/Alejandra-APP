// Cliente de transporte del Worker IA. No decide permisos ni transforma reglas de dominio.
function createAgentClient({ baseUrl, fetchImpl = fetch }) {
  return {
    getHealth() {
      return fetchImpl(`${baseUrl}/health`).then(response => response.json());
    },
  };
}

window.AlejandraPresentation = window.AlejandraPresentation || {};
window.AlejandraPresentation.createAgentClient = createAgentClient;
