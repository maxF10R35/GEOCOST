## Inicio local V11 · sin API key y presupuesto por componente

GeoCost SC no requiere token ni API key. Puedes usar Live Server o el iniciador con Python; los precios y peajes se consultan con fuentes públicas cuando están disponibles.

Los ejes y la velocidad orientativa se derivan automáticamente del vehículo: Camioneta 2, Rabón 2, Torton 3, Tráiler 5 y Full 9. Estas son **configuraciones referenciales**, no sustituyen fichas de cada unidad (por ejemplo, algunas tractoconfiguraciones varían). El motor no inventa PBV, altura, ancho, longitud ni permisos; todo criterio sin evidencia continúa pendiente. La hora de consulta es solo referencia, no confirmación del horario de salida.

# GeoCoast SC V6 — Integración RNC preparada (22 octubre 2026)

El motor GC-FIS 2.2 ahora puede usar la **Red Nacional de Caminos (RNC)** como fuente prioritaria de tipos de rodamiento por tramo. La RNC real no se incluye porque solo se proporcionaron `red_vial.shx` y `red_vial.prj`; faltan **.shp y .dbf**. En esta entrega el motor continúa con OSM y señala cobertura/procedencia sin inventar datos oficiales.

**Para instalar la RNC nacional:** abrir `docs/RNC_2025_INTEGRACION.md` y ejecutar `tools/convert_rnc.py` una vez que se reciban los cuatro componentes oficiales. Para probar un corredor puede importarse GeoJSON WGS84 desde Configurar costos. Los motores de costos y combustible estatal, comparador de bodegas, reportes y ajustes manuales se conservan de la V5.

**Validación:** `npm test`. La integración del archivo de ejemplo fue probada con un SHP sintético; **no** se realizó una prueba en navegador con servicios de mapas reales debido a restricciones del entorno y falta de datos completos.

---

## Actualización V5: costos por características de cada ruta

- Motor físico independiente de esfuerzos GeoRisk.
- Cada ruta conserva su mezcla de vías, pendientes, costo medio estatal de diésel y tiempos.
- **No se fijan porcentajes de diésel, mantenimiento, llantas o suspensión sobre la tarifa.** Se calculan importes individuales y después su participación en el total.
- Suspensión / amortiguadores se calcula por separado y se puede ajustar manualmente por ruta; su importe base sale del mantenimiento previo, evitando sumarlo dos veces.
- Control técnico nuevo: parámetros de consumo en pavimento, desgaste de llantas y suspensión por tipo de vía y pendiente.
- Coeficientes provisionales: requieren calibración con mantenimiento real, litros de diésel, condiciones de pavimento y tarifas pagadas.
- Cambios detallados: `docs/CAMBIOS_GCFIS_V5.md`.

**Actualización V4 — estabilidad:** Cotizar ya no borra la ruta válida ante errores de render o de fuentes externas; una sola solicitud por clic, consultas de bodegas limitadas, geometría estatal reutilizada. Consultar `docs/V4_ESTABILIDAD_COTIZACION.md`.

# GeoCost SC · Versión de entrega para ingeniería

**Versión:** 2026-10-22 GC-FIS V2 · **Área:** Autotransporte, Centro Sur · **Estado:** prototipo funcional parametrizable, pendiente de validación de campo.  
**Objetivo:** cotizar rutas de autotransporte, comparar orígenes, evaluar automáticamente tipo de camino y relieve por geometría, sin aplicar índices GeoRisk al cálculo y reportar el costo completo del ciclo de ida y retorno.

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
| `road-physics-core.js`, `road-physics.js`, `physics-editor.js` | Clasificación física independiente de GeoRisk; cálculo por superficie y pendiente, con corrección manual |
| `road-evidence.js`, `road-physics.js`, `physics-editor.js` | Cartografía OSM y evaluación física independiente de GeoRisk |
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

Tarifa **estimada** por ciclo = `CF asignado + CV de ida cargada y regreso vacío + utilidad sobre costo`.  
Utilidad inicial de **8 %** (*markup*) modificable. Incluye distancia total, gastos fijos, rubros variables, su participación porcentual y desglose de tipo de vía y pendiente en siete clases. En el reporte se utilizan **la unidad y el lote seleccionado**, mientras el comparativo muestra escenarios a **capacidad máxima** sin trasladar correcciones monetarias de la ruta principal.

La clasificación GC-FIS usa OpenStreetMap y elevaciones, sin utilizar el índice de esfuerzos de GeoRisk para el importe tarifario. Puede corregirse el kilometraje por superficie en Configurar costos. El precio diésel procede de un promedio estatal ponderado por km por cada origen/ruta; no se utiliza un valor nacional fijo de $26.99. Las correcciones de costos en MXN y las de kilómetros se guardan **localmente por origen, destino y alternativa**, no son un aprendizaje de GeoRisk ni una sincronización entre equipos.

## Documentación de entrega

- **[Arquitectura y datos](docs/ARQUITECTURA_Y_DATOS.md)** — módulos, fuentes, eventos y despliegue.
- **[Motor GC-FIS independiente (V2)](docs/MODELO_FISICO_GCFIS_V2.md)** — metodología actual de tipos de camino, pendiente, diesel estatal y escenarios por vehículo.
- **[Modelo matemático V1, histórico](docs/METODOLOGIA_COTIZACION.md)** — fórmulas, factores y ejemplos.
- **[Operación y validación](docs/OPERACION_Y_VALIDACION.md)** — procedimiento para operar, probar y calibrar.
- **[Limitaciones y pendientes](docs/PENDIENTES_Y_RIESGOS.md)** — tareas recomendadas para el siguiente responsable.
- **[Control de cambios](docs/CAMBIOS_2026-10-22.md)** — qué cambió en esta entrega.

## Advertencias de ingeniería y seguridad

- Los factores por año, relieve, tipo de camino y vehículo son **hipótesis calibrables**, no certificaciones del IMT, tarifas CEMEX ni ofertas de mercado.
- OSRM usa perfil automóvil; la ruta generada **no acredita cumplimiento NOM-012** ni seguridad operativa para tractocamiones.
- Las estaciones se muestran según registros públicos; una estación sin precio individual verificado **no confirma** venta o inventario de diésel.
- **Revisar autorización para exponer catálogos de clientes, frentes y datos CEMEX antes de publicar el ZIP en un sitio público.** Un acceso al botón *Iniciar* no protege archivos estáticos.
- El repositorio no contiene cuentas, passwords ni claves privadas; no agregarlas al frontend.

## V3 — Orígenes cercanos y resumen sin esfuerzos heredados

- No se cargan los módulos antiguos de esfuerzos GeoRisk ni el editor en el resumen.
- La tabla de orígenes muestra inmediatamente bodegas candidatas, luego consulta ruta vial, diésel por estado y elevación por separado.
- Las casetas del origen principal **no se copian** a otras bodegas. Los peajes de alternativas son preliminares hasta que se identifique su tarifa por ruta y validación de superficie/altimetría.
- Ver `docs/V3_ORIGENES_RESUMEN.md`.

## Ruteo público y limitaciones (V11)

Sin clave. Se utiliza OSRM/OSM como referencia vial. No comprueba el cumplimiento NOM-012 ni todas las restricciones de carga; validar antes del despacho. Los peajes OSM/CAPUFE incompletos se etiquetan como pendientes, no como cero garantizado.
