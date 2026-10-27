# GeoCoast SC | Motor de costos independiente GC-FIS 2.0

**Estado:** prototipo operativo (GC-FIS 2.1), valores iniciales sujetos a validación. **Fecha:** 22/10/2026. **Ámbito:** cotización de autotransporte en MXN sin IVA.

## 1. Modelo implantado

Tarifa C del ciclo = (CF del ciclo + CV del ciclo) × (1 + utilidad editable); utilidad inicial 8 % sobre costo.

**La fuente económica ya no es GeoRisk ni un índice de esfuerzos logísticos.** Un módulo propio `road-physics.js` identifica los tramos por trazado vial OSRM + atributos OpenStreetMap y compara muestras de elevación de Open-Meteo. Clasifica las siete clases de superficie/pediente para mostrar un desglose legible, pero el incremento económico se produce mediante **consumo, desgaste, llantas y tiempo**, no por un multiplicador directo a la tarifa. `GeoRiskEfforts` permanece disponible sólo como contraste de seguridad, sin alimentar `GCIMT`.

Clasificación espacial aproximada: búsqueda de vías OSM a hasta 45 m del eje vial por puntos distribuidos. Motorway se identifica como autopista, residential/service como entorno urbano, superficies explícitamente sin pavimentar como terracería. Jerarquías trunk/primary/secondary/tertiary sin dato de superficie se estiman como pavimento provisional: NO es certificación. Lo no identificado se reporta como sin clasificar y se costea en condición base. Se permite corrección manual **por ruta**, sin usar esfuerzos GeoRisk.

## 2. Fórmula de combustible

1. Segmentar la ruta real por estado con polígonos ZT SAP.
2. Sumar km reconocidos por estado e identificar precio estatal de diésel del corte local/actualizado (editable en pantalla).
3. Calcular **precio medio aplicado = SUMA(km_estado × precio_estado) / SUMA(km_estado con precio)**. Los km no reconocidos quedan fuera del promedio y se reportan como cobertura incompleta. Si no se reconoce ningún estado, NO hay cotización automática.
4. Litros ida cargada = km ida / rendimiento cargado × factor carga × (1 + penalización superficial + ascenso medido). Litros regreso vacío = km vuelta / rendimiento vacío × (1 + penalización superficial + ascenso equivalente del retorno).
5. Consumo total = litros ida + litros regreso + litros adicionales por ralentí. **Costo diésel = litros totales × precio medio estatal de esa ruta.** El importe alimenta `variable.diesel` y por tanto la tarifa, con utilidad sobre costo después de sumar rubros.

**No se aplica $26.99/L fijo ni precio nacional a tramos desconocidos.** Un estado puede presentar legítimamente $26.99 si esa es su cifra en el corte de datos. Las estimaciones de diésel no prueban el precio neto pagado por un transportista ni la ubicación real de sus cargas de combustible.

## 3. Efectos físicos

- **Superficie:** participación por km de tramo urbano y terracería altera el consumo, costo de mantenimiento, llantas y tiempo de viaje. Valores iniciales del motor son hipótesis modificables, nunca tablas oficiales IMT.
- **Pendiente:** ascenso acumulado de ida incrementa consumo cargado; descenso de ida es ascenso del retorno vacío y afecta este consumo. Ascensos + descensos afectan el mantenimiento en proporción a la distancia, sujetos a topes prudenciales. Altitud absoluta no es un sobrecosto por sí sola.
- **Desconocido:** sin altimetría no se inventa ascenso ni se aplica recargo de sierra. La falta de superficie conserva condiciones base y deja aviso de cobertura.
- **CF:** depreciación/arrendamiento, sueldo/seguro, permisos, patio, GPS y estructura administrativa prorrateada por productividad (km u horas del ciclo). La flota grande comienza con mayor costo administrativo y de patio por unidad; la mejora en utilización es parámetro editable, **no automática**.
- **Rubros variables:** mantenimiento preventivo/correctivo, llantas por precio/vida del juego, lubricantes, DEF, casetas manuales, maniobras sugeridas 180 MXN/ciclo, lavado/otros 60 MXN/ciclo, viáticos por jornada de más de 8 h (350 MXN/jornada). Custodias y riesgos extraordinarios siguen en cero hasta que el operador indique una necesidad real. Todo se puede editar.
- **Sin doble cargo:** sueldo fijo o por km; un solo perfil ascenso/descenso en diésel y desgaste; casetas manuales se duplican para ida/regreso según supuesto.

## 4. Informe ejecutivo

`executive-report.js` usa el mismo `GCIMT` del panel principal, incorpora mapa de ruta y alternativas, tabla de orígenes para unidad/lote constantes, matriz por vehículo con **el mismo lote** (si la capacidad lo permite), participación de CF/CV, promedio estatal de diésel, detalle de costos, transparencia de cobertura OSM y limitaciones.

**C´** sustituye todas las menciones de “C Prima”. Las bandas C/C´/B/B+/B SPOT son referencias de simulación editables, no necesariamente contratos CEMEX.

## 5. Alcance pendiente de validación

- Afirmar que los resultados están “cercanos al mercado” exige validar contra tarifas efectivas de la misma ruta, unidad, carga, retorno, fecha, casetas y nivel de servicio. No existe un feed nacional de ofertas comparables implementado.
- Los costos base para unidades y coeficientes de superficies proceden de escenarios iniciales editables, no de tablas certificadas del IMT ni de datos reales de flotas. Se requiere calibración con facturación, telemetría, litros, órdenes de taller, llantas y viajes.
- OSRM usa perfil automóvil y OSM ofrece datos comunitarios. No acredita tránsito legal de camiones ni el cumplimiento NOM-012/087, ni distingue todas las superficies si sus etiquetas no están completas.
- Regreso estimado por el mismo camino en sentido inverso y sin carga; verificar escenarios con retornos cargados, rutas inversas diferentes y peajes específicos.
- El precio de diésel es estatal, no precio contratado del transportista; revisar cada corte y ajustar mediante controles.
- Ajustes de rutas y precios se guardan en el navegador. Netlify estático NO oculta por sí mismo información de clientes contenida en el ZIP.

## 6. Fuentes metodológicas

- IMT Publicación Técnica 630: *Análisis del costo fijo del autotransporte de carga* (2021). https://www.imt.mx/resumen-publicaciones.html?IdPublicacion=1056&IdTipo=Publicaci%C3%B3n+t%C3%A9cnica+No.630
- IMT Publicación Técnica 881: *Costos de operación base de los vehículos representativos del transporte interurbano 2025* (2025); boletín NOTAS 220 (2026). https://www.imt.mx/resumen-boletines.html?IdArticulo=657&IdBoletin=221
- Instituto Mexicano del Transporte: *Incremento económico en los costos de operación vehicular*, 2022. https://www.gob.mx/imt/articulos/incremento-economico-en-los-costos-de-operacion-vehicular

Las publicaciones respaldan la **estructura y factores causales**, no los importes específicos del prototipo. Los precios por estado se conservan en `data/diesel-estados.json` (incluye fecha y procedencia).


## Anexo V5: variación de costos por cada ruta (23/10/2026)

El motor contempla tramos urbanos, autopista, pavimento, terracería y los metros reales de ascenso y descenso. La participación de cada concepto **no es fija**: se calcula como importe del rubro / tarifa de esa ruta. Dos rutas con el mismo kilometraje y la misma carga pueden producir porcentajes diferentes al variar combustible, desgaste, tiempo y gastos asociados.

Para dar visibilidad al desgaste de suspensión se desdobló el presupuesto base de mantenimiento por kilómetro: 

- Mantenimiento mecánico = km del ciclo × mantenimiento base/km × (1 − proporción suspensión) × (1 + ajuste por superficie y perfil).
- Suspensión / amortiguadores = km del ciclo × mantenimiento base/km × proporción suspensión × (1 + ajuste por superficie y perfil).

La suma de ambos presupuestos base (sin recargos) es **igual** al mantenimiento base que ya existía: **no se duplica**. De inicio, la proporción de suspensión es 18 % como **hipótesis editable**, no un dato de mercado. La variación por ruta se alimenta de participaciones de pavimento/urbano/terracería y del ascenso/descenso medido; existen parámetros editables de sensibilidad para combustible, mantenimiento, llantas y suspensión.

**Limitaciones clave**: no existe un índice certificado de rugosidad IRI, calidad del pavimento, temperatura de llantas, peso real por eje, frenadas por kilómetro o curvas cerradas muestreadas en cada tramo. El nivel real de deterioro de suspensión no puede inferirse perfectamente de OSM ni de altitud: calibrar contra órdenes de taller e historial de neumáticos por ruta y unidad. El dato de alta altitud no implica por sí solo mayor desgaste; importan pendientes, superficie, frenado y carga. El modelo usa valores de arranque, no coeficientes oficiales IMT.
