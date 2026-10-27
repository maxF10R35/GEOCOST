# Ajuste: participación porcentual de componentes

El cuadro ejecutivo **Participación del costo por componente** tiene tres columnas:
- Tipo: costo fijo o variable.
- Componente: diésel, mantenimiento, llantas, casetas, servicios y maniobras, depreciación/arrendamiento, seguro, gastos administrativos y operador.
- % participación: resultado real del motor GCIMT para la ruta cotizada.

La fotografía "Presupuesto 2027 – Cálculo Base" sirvió como ejemplo de rubros y visualización: sus porcentajes NO están programados como objetivos, cuotas o porcentajes obligatorios.

## Metodología

Participación = 100 × costo del componente / costo técnico (antes de utilidad).

La suma de componentes es 100% del costo técnico, con posibles diferencias visuales de centésimas por redondeo. Se consolidan rubros ya existentes sin cambiar el precio calculado por el motor:
- Mantenimiento: mantenimiento mecánico + suspensión + lubricantes + DEF.
- Gastos administrativos: administración + permisos + GPS + patio.
- Servicios y maniobras: servicios, viáticos, riesgo/custodia y otras partidas.
- Operador: fijo cuando se paga mensualmente; variable cuando se paga por kilómetro. En el segundo caso se separa de servicios solo para exhibición, sin contar dos veces su costo.

Si los importes manuales de una ruta cambian o se elige otro transportista, unidad, ruta o precio de diésel, sus participaciones cambian también.

La vista compacta y el reporte ejecutivo no incluyen columnas de fluctuación ni de impacto. El desglose técnico de MXN se conserva separadamente para auditoría y no implica que los porcentajes de ejemplo sean fijos.

## Verificaciones

`npm test` pasó el conjunto completo de pruebas existentes y las nuevas validaciones de reconciliación y sensibilidad del porcentaje.

## Limitaciones

La aplicación mantiene los supuestos de ruteo y de costos heredados del proyecto. La calidad de los porcentajes depende de la calibración, evidencia vial y fuentes de costo. Una participación recalculada no certifica por sí sola la precisión de la tarifa.
