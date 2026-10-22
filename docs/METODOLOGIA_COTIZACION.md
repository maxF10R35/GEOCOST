# GeoCost SC — Modelo de flete GeoCoast–IMT 2026 (V1 calibrable)

**Fuente metodológica principal:** Instituto Mexicano del Transporte (IMT), Publicación Técnica No. 630 (2021), José Elías Jiménez Sánchez y Ailed Dejanira Rodríguez Cristerna, *Análisis del costo fijo del autotransporte de carga*. PDF proporcionado por el usuario. La investigación sustenta **CF + CV(distance) + U**, el impacto del ciclo de transporte y la productividad de los vehículos sobre el costo fijo unitario, pero **no proporciona los coeficientes que se cargan inicialmente en este modelo para cada unidad**.

Bibliografía complementaria citada en la investigación o en los materiales de contexto: IMT Publicación Técnica No. 536 (Jiménez Sánchez, 2018), PT 483 (Jiménez Sánchez y Jiménez, 2016), Hooper y Murray/ATRI (2019), Kot (2015), Berwick (1997), Kulović (2004). Smart Fleet, RUTAZO y Carga Precisa son **materiales prácticos de referencia** aportados por el usuario; sus tablas comerciales y precios de otras monedas no son parámetros oficiales IMT ni costos confirmados de CEMEX.

## 1. Fórmula aplicada en la aplicación

**Tarifa integral por ciclo = (CF asignado por viaje + CV ida cargada + CV regreso vacío + costos del ciclo) × (1 + utilidad)**

La utilidad comienza en **0.08 (8 % del costo)** y es editable. Corresponde a *markup sobre costos*, no a margen sobre ingresos. No se añade tonelaje como multiplicador del costo de una unidad **porque el cálculo ya representa un viaje completo con capacidad y volumen capturado**; la división de la tarifa entre toneladas entrega $/Tn, evitando cobro doble.

**CF mensual** = depreciación **o** arrendamiento / costo financiero conforme a la modalidad de tenencia, más sueldo fijo del operador y prestaciones (si aplica), seguros, administración, permisos, GPS y patio/base. Para evitar doble contabilidad, la interfaz permite elegir *sueldo fijo* o *pago por km*: el segundo excluye la partida salarial mensual del cálculo.

**CF del ciclo** = MAX(CF mensual × km del ciclo / km mensuales previstos, CF mensual × horas del ciclo / horas productivas mensuales). Interpretación: disponibilidad limitada por kilometraje o tiempo. Esta regla MAX es **una decisión de modelación para GeoCoast**, motivada por la productividad de los viajes discutida en la PT630; **no es una fórmula literal publicada por el IMT**. Horas incluyen manejo, carga/descarga y espera capturada; no implica verificación NOM-087.

**CV** se desglosa en diésel, lubricantes, DEF/ARLA32, mantenimiento preventivo/correctivo, llantas por vida útil, casetas de ambos sentidos, maniobras, viáticos, custodias, lavado, operador variable (solo cuando se elige ese régimen) y otros gastos explícitos. El seguro habitual **es costo fijo mensual**, no una segunda partida $/km.

## 2. Rendimiento, antigüedad y cargado/vacío

- Rendimiento nominal por vehículo: editable en `Configurar costos > Modelo GeoCoast–IMT`.
- Bandas exploratorias de unidades fabricadas **2000–2009**, **2010–2019**, **2020–2026**. En la implementación los factores de rendimiento son 0.79, 0.90, 1.00 respectivamente; factores de mantenimiento 1.50, 1.20, 1.00. **Estos factores son supuestos de ensayo, no resultados certificados del IMT.**
- Se calcula en litros la ida **con carga** (ajustando lote/capacidad nominal) y el retorno **sin carga**, con rendimientos distintos. El regreso usa distancia equivalente de la ruta seleccionada, **sin comprobación de retorno vial ni peaje diferente**. Todo el consumo de diésel, incluido ralentí estimado, multiplica el precio de diésel obtenido del componente estatal existente; el usuario puede corregirlo.
- El desgaste y las llantas se calculan sobre **ambos sentidos**, multiplicando por distancia y factores de relieve/vialidad; son gastos del vehículo, no factores directos sobre toda la tarifa.

## 3. GeoRisk SC, orografía y control de doble recargo

Los kilómetros de las siete clases existentes (urbano, autopista con/sin sierra, pavimento con/sin sierra, terracería con/sin sierra) se leen del motor GeoRisk y, si el usuario los modifica, el modelo se recalcula. Los kilómetros sin clasificar **se costean en condición base** y se reportan por separado. Si la suma de clases supera los kilómetros de la ruta, el cotizador detiene la cotización IMT.

Con perfil de altimetría disponible, **ascenso acumulado real** sobre la dirección del viaje ajusta el diésel de ida cargada, y el descenso acumulado del perfil de ida corresponde al **ascenso del regreso vacío**. Sin perfil de elevación se utiliza un recargo estimado por participación clasificada como sierra. Se usa **uno u otro**, nunca los dos a la vez, para evitar doble recargo de pendiente. Se agregan después efectos independientes de urbanización y terracería en sus rubros.

Los recargos iniciales de monte, ciudad, terracería, llantas, ralentí y mantenimiento no deben presentarse como cifras oficiales ni aplicarse indiscriminadamente a todos los kilómetros. En especial, los porcentajes de **40–60 % de diésel** y **15–20 % de mantenimiento** contenidos en capturas informales no están validados como efecto general: son hipótesis que solo podrían calibrarse con telemetría, combustible, consumo por tramo, pendiente, modelo y carga.

El **IRA** sigue siendo un indicador operativo de seguridad por separado; **IRA 5 no supone automáticamente un recargo de precio**. Para sumar gastos de custodia por riesgo se debe introducir un importe explícito y justificable.

## 4. Factores operativos y límites

- Capacidad de referencia cargada: Camioneta 5 Tn, Rabón 9 Tn, Torton 18 Tn, Tráiler 28 Tn, Full 50 Tn. Son **capacidades comerciales sugeridas**; homologación y PBV deben verificarse caso por caso. La clasificación de vehículos y catálogos históricos anteriores pueden variar.
- Tipo de transportista (chico, mediano, grande): afecta únicamente el componente administrativo por un factor modificable existente; no se multiplica indiscriminadamente todo el costo.
- Tiempo de viaje proviene de OSRM (perfil automóvil, **no apto para validar camiones pesados**). La operación requiere comprobar NOM-012, ruta efectiva, pendientes, restricciones, peajes, tiempos de descarga, NOM-087 y disponibilidad.
- Sin tasas de financiamiento propias, cotizaciones de seguro, bitácoras de mantenimiento, precios netos de combustible y nómina, todos los valores iniciales son **referencias ilustrativas**. No sustituye Staff Cotizaciones ni representa C/C′/B/Spot.

## 5. Cómo operarlo

1. Selecciona origen, destino y unidad; captura lote y viajes.
2. En **Configurar costos → Motor GeoCoast–IMT**, deja activo IMT para usarlo como cotización principal. Ajusta año modelo, utilidad (8 % por defecto), régimen de pago del operador y abre los parámetros editables de la unidad.
3. Traza una ruta. GeoRisk intenta clasificar los tramos y calcular su altimetría. Corrige las siete clases de esfuerzo cuando tengas evidencia más confiable.
4. Revisa el resultado integral: CF del ciclo, CV por partida, litros de ida/regreso, utilidad y costos de todos los viajes. Para comparar, despliega *Comparación con modelo anterior*.
5. Recalcula desde **Aplicar y recalcular** para actualizar el comparativo de bodegas sin asumir igualdad con Excel Staff.
6. En **Reportes**, el comparativo por unidad utiliza el modelo IMT si está activo. En alternativas sin perfil de elevación o clases GeoRisk completas se emplean condiciones base y se advierte su limitación.

## 6. Ejemplo reproducible ilustrativo

`tests/imt-model.test.js` valida la ruta de 53.4 km de ida, 106.8 km para el ciclo. Para Rabón, 9 Tn, modelo 2022 y precio hipotético de diésel de $26.99/L, el valor **cambia** según el relieve, el costo fijo mensual, el precio y casetas capturados. Ejecuta `node tests/imt-model.test.js` para confirmar relaciones esperadas. **No representa el precio real Vallejo–Lerma ni reemplaza los $4,253.33 reportados por el Excel Staff.**

## 7. Siguientes tareas de calibración obligatorias

- Sustituir los valores de inicio por datos reales 2025–2026 de transportistas y facturación, segmentados por unidad y antigüedad.
- Comparar con las fórmulas originales del Excel *Cotizador 2025* (lógica Staff E.L.) sobre un conjunto de rutas y fijar tolerancias.
- Georreferenciar casetas oficiales, conectar un motor de enrutamiento de vehículos pesados para ida y vuelta y registrar restricciones NOM-012.
- Validar los consumos cargado/vacío y pendiente con GPS/ECM, telemetría y recargas reales; distinguir altitud absoluta de gradiente.
- Repetir pruebas funcionales del sitio completo en Netlify y monitorear fuentes de estaciones/diésel.

### Referencias verificables

- [IMT PT630 — ficha oficial](https://www.imt.mx/resumen-publicaciones.html?IdPublicacion=1056&IdTipo=Publicaci%C3%B3n+t%C3%A9cnica+No.630)
- [IMT — análisis de costo fijo, boletín](https://www.gob.mx/imt/articulos/analisis-del-costo-fijo-del-autotransporte-de-carga)
- [IMT PT536 — resultados de publicaciones](https://www.imt.mx/publicacion.html?LbPalabras=0&LiCategoria=30&LiPagina=5)
