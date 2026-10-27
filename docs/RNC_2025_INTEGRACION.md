# Red Nacional de Caminos (RNC) 2025 — GeoCoast SC V6

## Estado de la integración

- **Código integrado:** el cálculo físico busca primero la RNC, clasifica los kilómetros recorridos mediante sus campos documentados y conserva la elevación por tramo.
- **RNC nacional NO instalada en este ZIP:** únicamente se recibieron `red_vial.shx` y `red_vial.prj`. Son índice y proyección, **no contienen** geometría (`red_vial.shp`) ni atributos (`red_vial.dbf`). Es técnicamente imposible generar los kilómetros reales de terracería de México sin los dos archivos ausentes.
- En ausencia de RNC, el motor sigue operando con evidencia OSM provisional y marca la procedencia. No asigna pavimento por la jerarquía primaria/secundaria de una carretera.

## Qué clasifica el modelo

| Campo RNC | Uso | Restricción |
|---|---|---|
| `Cond_Pav` | `Con pavimento` frente a `Sin pavimento` | No inferir si es N/A o N/D |
| `Recubri` | `Concreto`, `Asfalto`, `Bloques` / `Grava`, `Tierra` | Identificación de rodamiento, **no** estado/baches |
| `Tipo_Vial` | Distinguir vialidades urbanas y autopistas explícitas | `Carretera` y `Peaje` no prueban autopista ni pavimento |
| Elevación de GeoCoast | Ascensos y descensos por trayectoria | La altura absoluta NO representa pendiente |

Una superficie urbana sin `Cond_Pav`/`Recubri` confirmados se registra como entorno urbano (no como asfalto certificado). Los valores sin información permanecen sin clasificar y se cotizan como condición base, mostrando la cobertura incompleta.

## Instalar la red nacional

1. Obtener juntos, de la misma edición, `red_vial.shp`, `red_vial.shx`, `red_vial.dbf` y `red_vial.prj`. La RNC puede tener millones de segmentos y ocupar GB.
2. Instalar en Python 3: `python -m pip install pyshp pyproj`.
3. Desde `GeoCost_SC` ejecutar:

   `python tools/convert_rnc.py --input "/ruta/red_vial.shp" --output data/rnc --year 2025`

4. Verificar `data/rnc/manifest.json` y `data/rnc/tiles/*.ndjson` antes de publicar. La clasificación es **por trayectoria**, no por un porcentaje nacional fijo.
5. Comprobar tamaño y cuotas de Netlify; para un volumen nacional muy grande conviene alojar las teselas en almacenamiento estático/CDN y modificar su URL de lectura. La RNC no debe enviarse como un solo archivo a cada navegador.

También se puede recortar una ruta en QGIS y exportar un GeoJSON EPSG:4326 con los atributos de RNC: abrir **Configurar costos → Tipo de camino y pendiente → Cargar GeoJSON RNC**. El archivo se procesa localmente y solo dura mientras esa pestaña permanezca abierta. No se envía por API ni queda disponible para otros usuarios.

## Efecto en cotización

- Los kilómetros por rodamiento influyen sobre consumo de diésel, desgaste de llantas, suspensión y mantenimiento; el ascenso/descenso de la **ruta** también interviene.
- El precio de diésel estatal por los estados atravesados sigue entrando al importe de combustible del flete total.
- Se mantienen los parámetros editables, tarifas C y C´ y peajes manuales.
- Es **un modelo técnico de estimación**, NO calibración del mercado. Validar litros reales, refacciones, horas y facturación antes de negociar una tarifa contractual.

## Referencias

- IMT / SICT, Red Nacional de Caminos 2025: https://www.gob.mx/imt/red-nacional-de-caminos
- INEGI, diccionario de datos 2025 (campos Tipo_Vial, Cond_Pav, Recubri): https://inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/nueva_estruc/889463927457.pdf
