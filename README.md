# GeoCost SC · Versión de entrega para ingeniería

**Versión:** 2026-10-22 · **Área:** Autotransporte, Centro Sur · **Estado:** prototipo funcional parametrizable, pendiente de validación de campo.  
**Objetivo:** cotizar rutas de autotransporte, comparar orígenes, analizar esfuerzos logísticos por tipo de camino y reportar el costo completo del ciclo de ida y retorno.

## Inicio rápido

1. Abrir esta carpeta completa en VS Code; **no separar** el HTML, los JS, `data/` y `assets/`.
2. En terminal ejecutar `python -m http.server 8000` y abrir `http://localhost:8000` (o usar Live Server).
3. Para las funciones de estaciones nacionales y precios, desplegar en **Netlify** con `netlify.toml` y `netlify/functions/`. Un servidor HTTP estático **no** ejecuta las funciones Netlify. En ambiente de desarrollo puede utilizarse `netlify dev` con Netlify CLI.
4. Se necesita conexión a Internet para mapas Leaflet, rutas OSRM, geocodificación, OSM/Overpass, datos altimétricos y servicios externos de estaciones.
5. Ejecutar **`npm test`** (requiere Node.js 18+; **no requiere `npm install`** ni dependencias de desarrollo).

## Qué contiene cada carpeta

| Ruta | Finalidad |
|---|---|
| `index.html`, `styles.css` | Vista y componentes; portada y menú |
| `app.js`, `interface.js`, `addresses.js`, `settings.js` | Flujo principal, interacción y selección |
| `imt-cost-model.js` | **Único motor** de cálculo auditable para costos |
| `georisk-efforts-bridge.js`, `esfuerzos.js`, `zonas.js`, `effort-editor.js` | Clasificación GeoRisk, evidencia vial y corrección por ruta |
| `route-cost-editor.js`, `gc-settings-clean.js` | Edición de rubros MXN aislada por ruta y configuración |
| `executive-report.js`, `audit-report.js` | Reporte ejecutivo y memoria detallada de cálculo |
| `fuel-core.js`, `diesel-market.js`, `services-diesel.js`, `stations-clusters.js` | Precio de diésel, servicios, estaciones y cartografía |
| `catalog-layers.js`, `cemex-oficial.js`, `zt-sap.js`, `dynamic-map-layout.js` | Bodegas, clientes, ZT y capas |
| `tolls.js`, `fullscreen.js` | Peajes y presentación de mapa |
| `netlify/functions/` | Funciones que se ejecutan en Netlify; no en el navegador |
| `data/` | Catálogos y conjuntos de datos **requeridos** |
| `assets/` | Imagen de portada y logotipo |
| `tests/` | Pruebas de cálculo, integridad y no contaminación entre rutas |
| `docs/` | Explicación técnica, operación, pendientes y fuentes |

## Modelo de costo

Tarifa **C** por ciclo = `CF asignado + CV de ida cargada y regreso vacío + utilidad sobre costo`.  
Utilidad inicial de **8 %** (*markup*) modificable. Incluye distancia total, gastos fijos, rubros variables, su participación porcentual y desglose de esfuerzos en siete clases. En el reporte se utilizan **la unidad y el lote seleccionado**, mientras el comparativo muestra escenarios a **capacidad máxima** sin trasladar correcciones monetarias de la ruta principal.

Los esfuerzos automáticos son referencias construidas a partir de OpenStreetMap y elevaciones; se puede corregir el kilometraje por categoría. La herramienta actualiza la tarifa con el valor corregido. Las correcciones de costos en MXN y las de kilómetros se guardan **localmente por origen, destino y alternativa**, no son un aprendizaje de GeoRisk ni una sincronización entre equipos.

## Documentación de entrega

- **[Arquitectura y datos](docs/ARQUITECTURA_Y_DATOS.md)** — módulos, fuentes, eventos y despliegue.
- **[Modelo matemático](docs/METODOLOGIA_COTIZACION.md)** — fórmulas, factores y ejemplos.
- **[Operación y validación](docs/OPERACION_Y_VALIDACION.md)** — procedimiento para operar, probar y calibrar.
- **[Limitaciones y pendientes](docs/PENDIENTES_Y_RIESGOS.md)** — tareas recomendadas para el siguiente responsable.
- **[Control de cambios](docs/CAMBIOS_2026-10-22.md)** — qué cambió en esta entrega.

## Advertencias de ingeniería y seguridad

- Los factores por año, relieve, tipo de camino y vehículo son **hipótesis calibrables**, no certificaciones del IMT, tarifas CEMEX ni ofertas de mercado.
- OSRM usa perfil automóvil; la ruta generada **no acredita cumplimiento NOM-012** ni seguridad operativa para tractocamiones.
- Las estaciones se muestran según registros públicos; una estación sin precio individual verificado **no confirma** venta o inventario de diésel.
- **Revisar autorización para exponer catálogos de clientes, frentes y datos CEMEX antes de publicar el ZIP en un sitio público.** Un acceso al botón *Iniciar* no protege archivos estáticos.
- El repositorio no contiene cuentas, passwords ni claves privadas; no agregarlas al frontend.
