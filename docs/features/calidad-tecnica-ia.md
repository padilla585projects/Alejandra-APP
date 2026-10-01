# Calidad técnica — IA-QUALITY-01

Fecha: 2026-10-01. Corrección de flujos existentes, sin cambio de proveedores,
arquitectura CAD, datos ni AR. Base ef173a2, rama codex/professional-quality-controls.

## Datos antes de actuar

Antes de generar un plano, recuperar datos ya confirmados o disponibles por herramientas
autorizadas. Preguntar por los faltantes que condicionan el resultado, agrupando preguntas
concretas y explicando su finalidad. En bandejas: unidades, dimensiones, recorrido X/Y,
altura Z y referencia de nivel. No confundir Y con Z. En dimensionado eléctrico:
cargas, alimentación, longitudes y condiciones de instalación, entre otros requisitos
del cálculo concreto. No repetir preguntas ya respondidas.

Solo un boceto preliminar solicitado puede omitir estos datos e identificar pendientes.
Los ejemplos del prompt y el catálogo no son datos del proyecto ni una elección aprobada.
Generación y edición usan la misma política de fidelidad: conservar valores confirmados,
no inventar cumplimiento o firma, no añadir elementos ausentes, cotas coherentes con una
proporción común, textos separados y cajetín de borrador pendiente de revisión.

Esta política guía al modelo; **no es un verificador geométrico ni una barrera determinista
de datos completos**. El formulario directo sigue admitiendo descripciones libres.
No acreditar uso de ejecución, escala de impresión o CAD por el mero éxito de la tool.

## Controles deterministas

- Generar y editar rechazan una respuesta sin cierre SVG. No fabrican el cierre ni
  persisten esa respuesta. El extractor controla el contenedor, no valida todo XML,
  medidas, topología, solapamientos o contenido activo; esos controles siguen pendientes.
- Office preserva cero al rellenar/seleccionar; rechaza campos no editables, tipos
  incompatibles, opciones ausentes/deshabilitadas y clicks deshabilitados. El ejecutor
  ya detiene el plan ante error. No acredita persistencia backend por efectuar un click.
- Chat IA compacto z810 queda sobre FAB z499 y chat equipo z800, bajo los modales.
  Conserva diseño, arrastre y redimensión existentes; sin rediseño de producto.
- CI sincroniza cuatro marcadores: version.json, sw.js, index.html y panel.html.

## Correcciones de mecánicas y fuentes

El RITE se aprobó por RD 1027/2007; oficinas son IDA 2. Para el método por persona,
la tabla 1.4.2.1 establece 12,5 l/s por persona bajo sus condiciones. Se corrige la
confusión con IDA 1 y se remite a las condiciones aplicables antes de fijar valores.
[RITE consolidado — BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2007-15820).

RD 809/2021 regula equipos a presión e ITC; RD 709/2015 regula comercialización.
Se retiran periodicidades/presiones universales del párrafo de equipos y se pide
determinar el caso por categoría, fluido, equipo e ITC.
[Reglamento — BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2021-16407),
[Comercialización — BOE](https://www.boe.es/eli/es/rd/2015/07/24/709).

Se retira una estimación térmica que multiplicaba un índice volumétrico por ΔT;
se distinguen transmisión y ventilación con unidades coherentes y cargas latentes.
No se incorpora una herramienta nueva de dimensionado ni se acredita el resto del
módulo mecánico: otros párrafos normativos y fórmulas siguen sujetos a auditoría.

## Validación y entrega

13 regresiones ejecutan funciones de producción aisladas, incluida ausencia de
persistencia ante SVG incompleto; 290 pruebas del agente y 16 de benchmark/AR.
Sintaxis Workers, encoding, versiones, departamentos e inventarios correctos.
Las pruebas de prompts verifican contrato de instrucciones, no comportamiento de
todos los modelos. La comprobación publicada debe registrarse aparte.

Rollback: revertir PR antes de publicar; después, workflows con SHA fijo de la entrega
sana anterior: Workers 33be87e, Pages 00517cf (9.79). Sin migraciones ni secretos.

Pendientes para nivel de ejecución: motor/verificador CAD con unidades, capas,
cotas y round-trip; evaluación de preguntas faltantes y fidelidad por modelo;
auditoría normativa y cálculos por disciplina; postcondiciones Office de negocio;
muestras previas a rediseño gráfico. Propuestas CAD en suite-ingenieria-cad-y-modelo-local.md
mantienen su estado Idea/Investigación; esta corrección no las acepta como arquitectura.
