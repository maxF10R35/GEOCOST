# GeoCoast SC V4 — Estabilidad al cotizar

## Error identificado en la V3

`goRoute()` agrupaba la consulta OSRM y la activación/renderización de la cotización en un mismo `try/catch`. Si una excepción ocurría **después** de que OSRM devolviera una ruta válida (p. ej., al dibujar una capa o inicializar un panel), el `catch` hacía `route=null`, `lastRouted=[]` y reemplazaba el resultado por un estado de error general. Esto podía percibirse como un reinicio de la cotización. No se confirmó una recarga real del navegador a partir de las capturas.

## Cambios

- Un fallo en OSRM queda separado de un fallo posterior de representación o del cálculo. La geometría válida y la cotización anterior **no se descartan** por un error de interfaz.
- Mientras se solicita la ruta, el botón se deshabilita y los clics repetidos no envían solicitudes duplicadas; se agrega `type=button` explícito para impedir un submit involuntario si cambia el HTML.
- Se conserva el análisis de tramos GC-FIS sin porcentajes de esfuerzos GeoRisk.
- El comparativo realiza como máximo dos consultas principales de rutas de bodegas cercanas simultáneamente, y no espera las consultas OSM y altimétricas para publicar los primeros precios.
- Los archivos de polígonos SAP de cada entidad se descargan y parsean una sola vez durante la sesión; se reutilizan en los orígenes alternos.
- El cálculo de kilómetros por entidad utiliza muestras regulares del trazado (resolución espacial aprox. 0.6 a 2.5 km, máximo 1200 muestras) para reducir bloqueo del hilo principal. La distribución estatal es aproximada en los límites; requiere revisión si la ruta discurre junto a una frontera. El diésel promedio sigue ponderado por los kilómetros de los estados detectados.
- El precio de diésel del motor de costos sigue tomando el promedio estatal de **cada ruta**, sin introducir como valor automático el precio nacional fijo.

## Validación ejecutada

Se ejecutaron las pruebas unitarias y de integridad que acompañan al ZIP (`npm test`), incluida `quote-reset-regression.test.cjs`, que simula: a) ruta OSRM válida pero fallo de render, b) error de OSRM tras una ruta válida y c) doble clic. Las tres condiciones conservan la ruta que ya existe.

**Pendiente:** verificación integral de navegación, latencias, coberturas y reporte en un navegador real con acceso a OSRM, Open-Meteo, Overpass y Netlify. El entorno de pruebas no permite realizar consultas de producción desde el navegador, por lo que no se afirma validación de extremo a extremo.

## Si vuelve a ocurrir

Registrar exactamente si (a) regresa a la portada, (b) se limpia únicamente el resultado, (c) el navegador recarga la pestaña, o (d) aparece mensaje de error en el mapa. Una captura de la consola (F12 → Consola) durante el clic permitirá diferenciar fallos del navegador, servicios o aplicación.
