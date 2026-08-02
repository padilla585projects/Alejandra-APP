# Rebanada P-ARCH-007 — Badges con tokens semánticos

- Estado: Implementada
- Alcance: colores de los cinco estados reutilizados

Los badges del panel de conversación conservan sus cinco clases y fondos actuales. Sus colores
de texto se resuelven ahora a roles semánticos de primario, éxito, atención, riesgo e
información. No se altera el marcado, las llamadas del backend ni las reglas de estado.

Rollback: revertir el commit restaura las cinco variables de color directas.
