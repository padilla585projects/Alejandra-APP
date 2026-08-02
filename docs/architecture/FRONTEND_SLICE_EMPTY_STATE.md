# Rebanada P-ARCH-008 — Estado vacío compartido

- Estado: Implementada
- Alcance: historial y dashboard de conversación

Se extrae una primitiva de estado vacío usada por `renderHistorial()`. Esa función abastece tanto
el historial filtrado como el dashboard, por lo que el componente tiene dos usos compatibles.
Conserva texto, alineación y espaciado; usa el alias semántico de texto secundario y mantiene un
fallback idéntico si el script no carga.

No llama a backend ni trata permisos. Rollback: revertir el commit restaura el HTML local.
