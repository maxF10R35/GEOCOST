# Manual de operación y validación para un ingeniero receptor

## Escenario básico

1. Abrir aplicación, pulsar *Iniciar* y elegir origen/cliente o localizar un punto validado en el mapa.
2. Seleccionar vehículo, presentación, lote por viaje y número de viajes. La capacidad declarada es referencial: verificar configuraciones autorizadas en operación.
3. Generar ruta. Revisar longitud y rutas alternas contra cartografía vial para camiones, casetas y restricciones NOM-012.
4. Revisar datos de GeoRisk, el perfil altimétrico y las siete categorías de esfuerzo. Si existe evidencia de un tramo mal clasificado, corregir los **kilómetros de la ida**. La suma no debe exceder la longitud de la ruta.
5. Configurar modelo de costos (año de unidad, diésel, operador fijo/variable, peajes, utilización y **utilidad**, inicialmente 8 %). Introducir importes manuales **solo donde haya evidencia**; el campo vacío usa el cálculo automático.
6. Revisar las participaciones **sobre tarifa C sin IVA**, el costo por tonelada, el costo de viaje completo (ida cargada + regreso vacío) y todas las partidas fijas y variables.
7. Usar `Reportes` para emitir el comparativo ejecutivo: los comparables se normalizan a capacidad máxima; el desglose puntual corresponde a **vehículo y lote activos**. Utilizar la memoria de cálculo para auditoría matemática.
8. Exportar correcciones GeoRisk a JSON, registrar responsable, fecha y motivo. Los ajustes monetarios locales no se sincronizan ni se exportan centralmente todavía.

## Validaciones mínimas

**Automáticas**: ejecutar `npm test`. Comprueba relación tarifa/costo, unidades, porcentajes, año modelo, variaciones de relieve, rubros, topes de carga, límites de kilómetros, integridad de archivos y aislamiento de importes por ruta.

**Manual UI**: cargar la aplicación desde un servidor web, abrir mapa; cotizar origen → destino, corregir un tramo, verificar que modifica combustible/mantenimiento; regresar a la misma ruta, verificar que recupera los kilómetros; cambiar a ruta alterna, confirmar que no hereda importes MXN; abrir el reporte y comprobar que la tarifa central coincide con los resultados, no con un vehículo a plena carga, salvo que esta sea la carga introducida.

**Integración Netlify**: comprobar que `/.netlify/functions/gasolineras-nacional` responde; verificar total nacional sin filtro por ruta y que el detalle de una estación no atribuye un precio promedio estatal como si fuera de ese establecimiento. Si falla el origen de datos, mostrar limitación en vez de precios inventados.

**Tolerancias de contabilidad**: `costo fijo asignado + suma CV = costo técnico`, `costo técnico + utilidad = tarifa C`, y `sumatorio categorías <= kilómetros ida (+0.1 de tolerancia de redondeo)`. Los rubros desglosados **no se suman nuevamente** a sus encabezados grupales.

## Calibración con datos reales

1. Reunir muestra de rutas y unidades: GPS, pendientes por sentido, kilómetros urbano/terracería/pavimento/autopista, combustible cargado/vacío, edad, tipo de carga, número de viajes, mantenimiento, nómina y gastos demostrables.
2. Separar viajes de ida cargada, retorno vacío y retorno con carga; el modelo actual presupone regreso vacío de la misma longitud.
3. Comparar contra cotizaciones y gastos comprobados por origen, tipo de unidad y año; documentar sesgo, error absoluto y escenarios atípicos.
4. Ajustar una variable a la vez sin convertir correlaciones en causalidad. Evitar doble recargo de pendiente (ascenso real y clase sierra).
5. Mantener una versión de parámetros y un registro de quién autorizó cada cambio.

## Para depurar

- Mapa no carga: revisar conectividad de CDN, errores de consola y permisos de red.
- Rutas no aparecen: comprobar disponibilidad OSRM; el programa **no debe** calcular costo con línea recta como sustituto.
- No hay estaciones: probar funciones en Netlify o `netlify dev`, no en `python -m http.server`.
- Esfuerzos incompletos: revisar tasa de fallos OSM/Overpass y elevación, calidad del trazado; por seguridad dejar kilómetros sin clasificar en vez de inventar camino.
- Costos inesperados: revisar campos manuales (incluido 0), la utilidad, retorno, peajes y estado de la ruta seleccionada.

> Limitación de verificación de esta entrega: se ejecutaron pruebas automatizadas de Node e integridad. No se realizó una prueba extremo a extremo de geocodificación, ruta, mapa y estaciones en un navegador con acceso a los servicios externos.
