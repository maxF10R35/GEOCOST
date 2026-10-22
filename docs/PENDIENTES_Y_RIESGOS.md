# Pendientes priorizados para continuidad

## Prioridad alta (antes de uso operativo vinculante)

1. **Calibrar GeoRisk contra rutas etiquetadas**: clasificación de superficies y sierra a nivel de tramo, con control de evidencia, exactitud y metros faltantes. El motor usa OSM y elevaciones externas, no consume una API GeoRisk homologada en tiempo real.
2. **Validar ruteo pesado y cumplimiento NOM-012** con restricciones por segmento, conectividad vial, retorno real y sentido de casetas. OSRM automóvil no certifica acceso de rabón, torton, tráiler o full.
3. **Validar importes del modelo IMT** contra datos reales de flota, año, seguros, sueldos, consumos, reparaciones, peajes y precios del combustible en fecha aplicable. Los coeficientes iniciales NO son parámetros oficiales IMT ni tarifa CEMEX.
4. **Controlar exposición de datos internos** si se va a desplegar en dominio público: frentes, catálogos, ubicaciones y políticas de negocio requieren análisis de permisos.

## Prioridad media

- Crear almacenamiento multiusuario para correcciones kilometraje/costos con aprobaciones, controles de cambios y trazabilidad (ahora `localStorage`); exportación de gastos a formato auditable.
- Medir cobertura y consistencia de padrón nacional de estaciones y precios CNE; diferenciar estaciones con venta de diésel **verificada** frente a disponibilidad desconocida.
- Cambiar servicios públicos de OSRM y Overpass por alternativas con SLA o infraestructura propia para garantizar latencia y estabilidad nacional.
- Regresar al cálculo de peajes con sentido y vehículo real, no simplificar siempre a ×2 si la ruta de vuelta difiere.
- Conciliar resultados contra sistema operativo de tarifas y documentar diferencias por lote, condiciones comerciales e IVA.

## Riesgos conocidos

**Dependencias de red**: la app depende de bibliotecas CDN y fuentes públicas. **Datos**: perfiles OSM/elevación pueden faltar o contener errores. **Persistencia**: cambios locales se pueden perder por limpieza de almacenamiento, distinto navegador o ajustes de geometría. **Calibración**: la tarifa es un ejercicio de ingeniería parametrizable, no un precio contractual. **Seguridad**: archivos estáticos no están protegidos con autenticación.
