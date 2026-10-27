# GeoCoast SC V3 — Resumen físico y bodegas cercanas

## Correcciones
- Se eliminó el panel y editor heredados de esfuerzos logísticos GeoRisk y el desglose editable en “Resumen de la ruta”.
- “Resumen de la ruta” sólo presenta superficie identificada, km sin evidencia, altitud, IRA de seguridad y precaución NOM-012; **los precios no consumen esfuerzos GeoRisk**.
- La edición vigente de las siete categorías **físicas** se mantiene únicamente en Configurar costos → Tipo de camino y pendiente. Sirve para corregir evidencia cartográfica, no para introducir un factor de “esfuerzo” arbitrario.
- Bodegas cercanas: aparecen inmediatamente al elegir el destino y luego se muestran resultados progresivos de OSRM / precio estatal / altimetría / cartografía OSM, sin esperar a Overpass.
- Cada opción usa km viales reales y diésel estatal de su propio trazado; sin servicio OSRM no se fabrican kilómetros ni tarifas.
- La cifra que aparece antes de confirmar relieve y superficie es **provisional**, ajustable conforme llegan las fuentes. No significa equivalencia contractual con el mercado.

## Validar con una ruta real
1. Servir `GeoCost_SC/` por HTTP o Netlify; no abrir directamente con `file://`.
2. Seleccionar origen, destino y vehículo; presionar Calcular ruta y cotizar.
3. Comprobar que aparecen de inmediato nombres de bodegas y distancia geográfica preliminar en el comparativo.
4. Verificar que cada alternativa pasa a kilometraje vial, precio estatal y tarifa; si la fuente falla, debe mostrar una falla concreta, no pantalla vacía.
5. Confirmar que la clasificación de superficie y pendiente sea el motor GC-FIS, y que no haya edición de esfuerzos en el resumen.
6. Comparar dos unidades, revisar el reporte y validar por factura gastos, casetas manuales, rendimientos, utilización, carga máxima y permisos NOM-012.
