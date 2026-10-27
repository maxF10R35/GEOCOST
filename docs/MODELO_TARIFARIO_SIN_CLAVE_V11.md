# Modelo tarifario por ruta – V11 (sin API key)

Estructura: COSTO VARIABLE + COSTO FIJO PRORRATEADO + MARGEN = TARIFA ESTIMADA SIN IVA.

Costos variables: diésel, mantenimiento (incl. suspensión/lubricantes/DEF), llantas, operador variable (si hay pago por km), casetas, servicios y maniobras.

Fijos: vehículo/depreciación, seguros, gastos administrativos, mano de obra fija de mantenimiento (editable, 0 hasta contar con presupuesto), sueldo fijo operador, y otros fijos (GPS, patio, permisos).

Los componentes corresponden al formato solicitado; sus porcentajes NO son los de la imagen. Cada participación se calcula como importe/costo técnico. El margen se añade por separado y NO entra en la base de 100% de gastos.

Diésel: precio por entidad federativa de archivo `data/diesel-estados.json`; se detectan km por estado en la ruta y se calcula el promedio ponderado; la fuente y fecha se exponen. Los precios de bomba incluyen IVA, así que el modelo usa precio /1.16. Si faltan estados no se inventa un precio nacional. La actualización por función Netlify es opcional; sin función se usa instantánea local.

Casetas: OSM Overpass identifica plazas mediante geometría del trazo; se cruza nombre y categoría (C2,C3,C5,C9) con tarifas locales CAPUFE/FONADIN con fecha. Sólo se suman coincidencias unívocas; la ausencia de plaza o tarifa se reporta como pendiente. Se dividen importes publicados con IVA entre 1.16 para costeo. El regreso usa la misma cifra como aproximación, NO verificada por sentido.

Ruteo: OSRM público sin API key. NO es un router especializado en carga ni acredita NOM-012, altura, peso, prohibiciones de circulación u horarios municipales. Ninguna ruta es apta para despacho sin verificación independiente.
