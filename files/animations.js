/**
 * animations.js — Micro-interacciones para el Sistema POS (Pollos Vivi)
 * ────────────────────────────────────────────────────────────────────
 * PLUG & PLAY: no modifica tu código. Agrégalo AL FINAL del <body>:
 *     <script src="js/animations.js"></script>
 *
 * Funciona por sí solo observando el DOM. No necesita que cambies pos.js.
 * Respeta prefers-reduced-motion.
 */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ══ 1. STAGGER de productos ══════════════════════════════════════
   * Cada vez que se repinta la grilla, aplica entrada escalonada. */
  function staggerProducts() {
    const cards = document.querySelectorAll('#products-grid .product-card');
    cards.forEach((card, i) => {
      card.style.setProperty('--i', i);
      card.classList.remove('stagger-in');
      // reflow para reiniciar la animación
      void card.offsetWidth;
      card.classList.add('stagger-in');
    });
  }

  /* ══ 2. RIPPLE en botones ═════════════════════════════════════════ */
  function attachRipple(e) {
    const btn = e.target.closest('.btn');
    if (!btn || btn.disabled || reduceMotion) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }
  document.addEventListener('click', attachRipple);

  /* ══ 3. PARTÍCULA que vuela al carrito ════════════════════════════
   * Al hacer clic en una tarjeta de producto, lanza un "+" hacia
   * el contador del carrito. */
  function flyToCart(startX, startY) {
    if (reduceMotion) return;
    const target = document.getElementById('cart-count');
    if (!target) return;
    const tRect = target.getBoundingClientRect();
    const endX = tRect.left + tRect.width / 2;
    const endY = tRect.top + tRect.height / 2;

    const dot = document.createElement('div');
    dot.className = 'fly-dot';
    dot.textContent = '+';
    dot.style.left = startX + 'px';
    dot.style.top = startY + 'px';
    document.body.appendChild(dot);

    // Arco: sube un poco antes de caer al carrito
    const anim = dot.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${(endX - startX) * 0.5}px, ${(endY - startY) * 0.3 - 60}px) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0.3)`, opacity: 0.2 }
    ], { duration: 620, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' });

    anim.onfinish = () => {
      dot.remove();
      pulseCartCount();
    };
  }

  function pulseCartCount() {
    const count = document.getElementById('cart-count');
    if (!count || reduceMotion) return;
    count.classList.remove('pop');
    void count.offsetWidth;
    count.classList.add('pop');
  }

  // Delegación: capturamos clic en tarjetas de producto
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (card) flyToCart(e.clientX, e.clientY);
  });

  /* ══ 4. DESTELLO del total cuando cambia ══════════════════════════ */
  const totalEl = document.getElementById('cart-total');
  if (totalEl) {
    let prev = totalEl.textContent;
    const obs = new MutationObserver(() => {
      if (totalEl.textContent !== prev) {
        prev = totalEl.textContent;
        if (reduceMotion) return;
        totalEl.classList.remove('flash');
        void totalEl.offsetWidth;
        totalEl.classList.add('flash');
      }
    });
    obs.observe(totalEl, { childList: true, characterData: true, subtree: true });
  }

  /* ══ 5. Observa la grilla para relanzar el stagger ════════════════ */
  const grid = document.getElementById('products-grid');
  if (grid && !reduceMotion) {
    let debounce;
    const gridObs = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(staggerProducts, 20);
    });
    gridObs.observe(grid, { childList: true });
    // Primera pasada
    setTimeout(staggerProducts, 100);
  }

  /* ══ 6. Salida animada al eliminar ítems del carrito ══════════════
   * Interceptamos el botón ✕ para animar antes de que el JS lo borre. */
  document.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.cart-item-remove');
    if (!removeBtn || reduceMotion) return;
    const item = removeBtn.closest('.cart-item');
    if (item) {
      item.classList.add('removing');
      // el render de pos.js repinta el carrito; la clase da el efecto visual
    }
  }, true); // captura antes que el handler de pos.js

  console.log('%c✨ Animaciones POS activas', 'color:#ee5d29;font-weight:bold;');
})();
