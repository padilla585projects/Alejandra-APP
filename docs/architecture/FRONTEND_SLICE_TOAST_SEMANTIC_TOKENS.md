# Rebanada P-ARCH-005 — Toast con tokens semánticos

- Estado: Implementada
- Alcance: una sola superficie de bajo riesgo

`alejandra-panel.html` carga `semantic.css` después de la paleta base. El estilo del toast,
ya compartido, usa ahora roles semánticos de superficie, color primario, texto, espaciado y
radio. Los aliases resuelven a los mismos valores actuales, por lo que no cambia el aspecto ni
las 12 invocaciones de `mostrarToast()`.

Rollback: revertir el commit restaura las variables anteriores y elimina la carga de tokens
semánticos. No cambia JavaScript, API, permisos ni datos.
