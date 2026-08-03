# Control de Calidad · Jarabes

App instalable para el analista de Aseguramiento de Calidad: verificación de
**volumen** y **°Brix** contra especificación, dictamen y control de vencimientos.

*Developed by Marcelo Herrera · Helen Condori · Alfredo Mamani*

---

## Flujo del análisis

### 1 · Lote a analizar
Producto, unidades y tanque. Aparecen las especificaciones del producto.

### 2 · Verificación de volumen
Las tres tarjetas muestran **mínimo, teórico y máximo** (±0,5 %). Al escribir el
volumen real, un medidor visual marca dónde cayó y un cartel dice si está dentro
de rango, en el límite o fuera, con el diferencial en porcentaje.

Ejemplo — Coca-Cola × 80 unidades: 23880 / 24000 / 24120 L.

### 3 · Verificación de °Brix
Igual que el volumen: tarjetas de **mínimo, estándar y máximo** (±0,30 °Bx),
medidor y resultado con la desviación exacta.

Ejemplo — Coca-Cola: 54,55 / 54,85 / 55,15 °Bx.

Debajo aparecen los **sólidos** real y teórico con su diferencial, calculados con
el polinomio de densidad del libro original.

### 4 · Dictamen
Veredicto global y selector **Liberado / Retenido / Rechazado**. Se propone solo
según el resultado, pero el analista decide. Se registra el analista, la fecha de
elaboración, el vencimiento y las observaciones.

### Corrección con agua (auxiliar)
Panel colapsable al final. Calcula el agua a indicar a Procesos según el °Brix
medido del jarabe simple, con la fórmula de la columna Q de la planilla J2.

---

## Vencimientos

En la pestaña **Registros**: resumen de vigentes / por vencer / vencidos, switch
de alarmas con antelación configurable, y exportación a `.ics` con alarmas nativas
que funcionan aunque la app esté cerrada.

## Exportación

Excel, PDF e imagen. Incluyen dictamen, analista, observaciones, elaboración y
vencimiento. El certificado de análisis se exporta como imagen individual.

## Instalación

Ver la guía completa en `../LEEME.md`. Resumen: repositorio **Public** en GitHub,
subir los archivos **sueltos** a la raíz, activar **Settings → Pages**, y en Chrome
del celular menú ⋮ → **Instalar aplicación**.

Al modificar archivos, subir la versión en `sw.js`:

```js
const VERSION = 'calidad-v2';   // v1 → v2
```
