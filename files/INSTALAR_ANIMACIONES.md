# ✨ Mejoras de Animaciones — Pollos Vivi POS

Estas mejoras se instalan en **2 pasos** y **no modifican ningún archivo tuyo**.
Todo está construido sobre tu sistema de diseño "Brasa" existente (usa tus mismas
variables de color, tu tipografía Bricolage Grotesque y respeta
`prefers-reduced-motion`).

---

## 📦 Qué incluye

| Archivo | Qué hace |
|---------|----------|
| `animations.css` | Todas las animaciones (entrada de paneles, hover de productos, stagger, modales, etc.) |
| `animations.js` | Micro-interacciones con lógica: partícula que vuela al carrito, ripple en botones, destello del total, salida animada de ítems |
| `demo_animaciones.html` | Demo lista para abrir en el navegador y ver todo funcionando |

---

## 🚀 Instalación (2 pasos)

### Paso 1 — Copia los 2 archivos

- `animations.css` → dentro de tu carpeta `frontend/css/`
- `animations.js` → dentro de tu carpeta `frontend/js/`

### Paso 2 — Enlázalos en `index.html`

En el `<head>`, **después** de `pos.css`:

```html
<link rel="stylesheet" href="css/main.css">
<link rel="stylesheet" href="css/pos.css">
<link rel="stylesheet" href="css/animations.css">   <!-- ← AGREGAR ESTA -->
```

Justo antes de cerrar el `</body>` (después de tu `<script type="module">`):

```html
<script src="js/animations.js"></script>   <!-- ← AGREGAR ESTA -->
```

**Eso es todo.** No hay que tocar `pos.js`, `main.css` ni ningún otro archivo.

---

## 🎬 Qué vas a ver

1. **Entrada del POS** — el header, las 3 columnas y el carrito aparecen en cascada al cargar.
2. **Productos escalonados** — al cambiar de categoría o buscar, las tarjetas entran una tras otra (efecto *stagger*).
3. **Hover de producto** — brillo diagonal que cruza la tarjeta + el precio crece un poco.
4. **Partícula al carrito** — al tocar un producto, un "+" vuela en arco hasta el contador, que "late".
5. **Total con destello** — cuando el total cambia, parpadea en dorado.
6. **Ripple en botones** — onda de agua al hacer clic en cualquier botón.
7. **Carrito** — ítems entran deslizándose desde la derecha y salen suavemente al eliminarlos.
8. **Botón "Cobrar Efectivo"** — pulsa sutilmente cuando hay algo que cobrar.
9. **Modales** — entrada con rebote elegante; las opciones de presa aparecen escalonadas.
10. **Categoría activa** — barra lateral que se desliza al seleccionarla.

---

## 🔒 Seguro y reversible

- **No borra ni cambia nada** de tu código actual.
- Para **desactivarlo**, solo quita las 2 líneas del `index.html`.
- Respeta accesibilidad: quien tenga "reducir movimiento" activado en su sistema
  operativo verá el POS sin animaciones (todo sigue funcionando).

---

## 💡 ¿Quieres aplicarlo también a `admin.html`?

`animations.css` y `animations.js` ya cubren el POS. Si quieres que el panel de
administración (`admin.html`) también tenga estas animaciones, agrégale las mismas
2 líneas y avísame — puedo crear un complemento específico para las tablas,
tarjetas de estadísticas y gráficos del admin.
