# Arquitectura y transferencia del proyecto

## 1. Arquitectura actual

Aplicación web sin framework, con HTML/CSS y JavaScript modular. El cálculo se ejecuta en navegador. `index.html` carga los scripts en orden; `georisk-efforts-bridge.js` es un módulo ES y depende de `esfuerzos.js` y `zonas.js`. No requiere *build step* para la parte estática. La única infraestructura de servidor incluida son funciones de Netlify para precios y estaciones.

**Diagrama de flujo funcional**

```text
Entrada origen + destino + vehículo + carga
     ↓
app.js → OSRM (geometría vial / alternativas) + altimetría Open-Meteo
     ↓
georisk-efforts-bridge.js → OSM/Overpass → esfuerzos (7 clases)
     ↓
effort-editor.js → kilómetros automáticos | manuales por alternativa
     ↓
route-cost-editor.js → rubros monetarios opcionales por alternativa
     ↓
imt-cost-model.js → costo fijo / variable / utilidad, ruta ida + regreso
     ↓
app.js (resultados) + executive-report.js + audit-report.js
```

## 2. Lógica de cotización

- `imt-cost-model.js` contiene `quote(input)`, una función pura apta para pruebas Node, y `fromApp()` como adaptador DOM.
- `GCEffortEditor.rows()` provee los kilómetros **aplicables** al cálculo; `original()` devuelve las estimaciones no modificadas.
- `GCCostOverrides` restaura los importes manuales de la alternativa actual cuando `app.js` emite `geocoast:route-selected`; su lectura se restringe a la ruta actual.
- `GCIMT.fromApp(..., {includeManualCosts:false})` permite comparar otras rutas y vehículos sin copiar gastos editados de la principal.
- `executive-report.js` recalcula desde el motor para que **reporte y cotizador coincidan** respecto al lote real, sin emplear un segundo motor.

## 3. Persistencia

En `localStorage` del mismo navegador/dispositivo:
- `geocoast-georisk-correcciones-v1`: kilómetros manuales de cada ruta.
- `geocoast-costos-manuales-por-ruta-v1`: montos en MXN por ruta.

Clave de ruta: coordenadas de origen + coordenadas de destino (4 decimales) + índice de alternativa + longitud (0.1 km). Se retienen hasta 120 registros por tipo. Si OSRM modifica significativamente la geometría o distancia puede producir una nueva clave: **no equivale a un identificador permanente de ruta**. Al cambiar de equipo las correcciones no migran. La edición de kilómetros se puede exportar a JSON; los costos deben recapturarse o integrarse a una base central antes de escalar.

## 4. Catálogos locales y servicios externos

| Archivo / servicio | Finalidad | Riesgo de actualización |
|---|---|---|
| `data/frentes.json` | destinos/clientes | confidencialidad y vigencia |
| `data/bodegas.json`, `data/cemex-ubicaciones-oficiales.json` | plantas/orígenes | verificación de coordenadas |
| `data/zt/*.json` | división territorial ZT | cobertura y versiones |
| `data/capufe-tarifas.json` | referencia de peajes | tarifas y vigencia |
| `data/diesel-estados.json` | referencias estatales de combustible | actualización y origen del precio |
| OSRM público | rutas viales con perfil de automóvil | disponibilidad/ruta para pesados |
| OSM Overpass | camino y entorno urbano | calidad de etiquetas y límites de uso |
| Open-Meteo Elevation | perfil altimétrico muestreado | resolución/fecha |
| CNE/CRE/registro público, con respaldo cartográfico | estaciones y precios | respuesta temporal, cobertura; precio ≠ existencia de diésel |
| Leaflet / markercluster CDN | mapa y agregación visual | conectividad y dependencia externa |

Funciones en Netlify: `gasolineras-nacional.js`, `gasolineras-cartografia-respaldo.js`, `diesel-estados.js`. Los servicios deben tener evaluación de tasas/cupos, caché, manejo de caídas y monitoreo antes de uso a gran escala.

## 5. Publicación y protección

`netlify.toml` mantiene `publish='.'` y `functions='netlify/functions'`; se puede publicar el **contenido de esta carpeta** sin compilar. No subir archivos internos ni exponer datos operativos sin autorización. El contenido servido como estático es accesible desde el navegador incluso si la portada solo presenta “Iniciar”. Para uso multiusuario deben diseñarse autenticación real, permisos, almacenamiento versionado y registro auditable de correcciones.

## 6. Contratos de mantenimiento

- Preservar IDs de HTML utilizados por los scripts; modificaciones cosméticas requieren verificar controles.
- Mantener siempre sincronizada la categoría GeoRisk de siete clases entre `effort-editor.js`, `esfuerzos.js`, `imt-cost-model.js` y reportes.
- No elevar precios mediante **dos** fuentes de pendientes simultáneamente; con altimetría disponible se usa ascenso acumulado, no el extra por clasificación de sierra como reemplazo.
- No convertir una estimación de renta/operación/combustible en dato oficial sin evidencia documentada.
- Ejecutar `npm test` antes de enviar un nuevo ZIP y comprobar una ruta real de forma manual en un navegador habilitado.
