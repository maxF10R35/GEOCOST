# GeoCost SC V8 · Diésel estatal y casetas geográficas sin IVA

## Diésel (automático por defecto)

- Fuente: GasMapa (precios reportados a CRE/CNE) por entidad, corte y cobertura visibles; usa instantánea local si falla la actualización en línea. Los reportes no deben presentarlos como compras comprobadas.
- Segmentación: kilómetros de la carretera por polígonos de estados SAP/GeoCost; promedio ponderado de los estados con precio y polígono, excluyendo km desconocidos. **No sustituir automáticamente por precio nacional**.
- Fuente en MXN/L con IVA; para modelo de costo **sin IVA** usa el cociente entre **1.16** en el motor. Checkbox de respaldo permite indicar un precio neto capturado por el usuario. Los importes de presupuesto editados manualmente por rubro ya se consideran netos y no se dividen otra vez.
- Visualizaciones muestran el importe neto y su referencia base, fecha y cobertura.

## Casetas por la ruta seleccionada

- Sin credenciales: consulta OSM/Overpass para encontrar plazas próximas a la **geometría vial seleccionada**, no puntos próximos al destino.
- Las casetas con nombre exacto normalizado (e.g., elimina «caseta» y acentos), categoría C2/C3/C5/C9 estimada por tipo de camión, y una **única tarifa** oficial CAPUFE/FONADIN para ese nombre se proponen con importe. Si varias secciones tienen montos diferentes, la plaza queda pendiente de verificar.
- Las barreras cercanas (carriles de la misma plaza) se desduplican. Las plazas OSM sin nombre/tarifa única se listan como pendientes y **no se suman**.
- Al activar otra alternativa se consulta **su propia geometría** y se mantiene su lista/tarifa separada.
- Fuente de catálogo: `data/capufe-tarifas.json` (2026, con IVA); importes calculados **sin IVA** dividiendo el peaje publicado entre 1.16. Retorno **estimado** por el mismo coste en sentido inverso, no se dispone de detección independiente ni de tarifa asimétrica.
- Se presenta «identificación parcial» incluso si no hay hallazgos. **Un 0 automático NO certifica ruta libre de peajes**. Los peajes privados/concesionados/estatales fuera del catálogo, tramos cerrados, clases de eje diferentes y plazas cartográficamente incompletas pueden quedar pendientes.
- Respaldo manual disponible dentro de Configurar costos > casetas, por ruta, únicamente cuando una plaza falta o la tarifa de clase no coincide. Cualquier ajuste ya es por trayecto y con IVA, luego se elimina IVA al cotizar.
- Para cobertura más robusta, integrar una fuente geolocalizada con tarifas por vehículo y sentido, como API SAKBÉ/INEGI cuando se tenga una clave autorizada: https://www.inegi.org.mx/servicios/Ruteo/Default.html . Sin token no afirmar que esa API está conectada.
- Consulta Netlify `/.netlify/functions/casetas-ruta`; servidor estático intenta OSM directo de respaldo. Requiere conectividad y puede estar sujeto a bloqueos o límites de OSM. Validar posición real de caseta, accesos y aptitud NOM-012 antes de cerrar una cotización.

## Validación

Ejecutar `npm test`: V8 prueba IVA, plazas duplicadas, ambigüedad por sección, punto alejado de ruta, notas de cobertura y UI. No sustituye una prueba en vivo con plataforma desplegada y una ruta con ticket conocido. **No se garantizan peajes exhaustivos ni rutas aptas para transporte pesado**: OSRM actualmente usa perfil automóvil.
