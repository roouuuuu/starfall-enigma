'use strict';

(function () {
  const state = window.SE = window.SE || {};
  const body = document.body;
  const lang = state.lang === 'id' ? 'id' : 'en';
  const moneyCurrency = (body.dataset.currency || state.currency || 'USD').toUpperCase();
  const exchangeRate = Number(state.exchangeRate || 0) || 16000;
  const strings = state.strings || {};
  const CART_KEY = 'se_cart';
  const WISHLIST_KEY = 'se_wishlist';
  const MAX_QTY = 10;

  const ui = {
    en: {
      added: 'Added to bag',
      removed: 'Removed',
      cartEmpty: 'Your bag is empty',
      cartEmptyText: 'Pieces you select will wait here, wrapped in the dark.',
      bag: 'Bag',
      quantity: 'Quantity',
      remove: 'Remove',
      stockWarning: 'Only {count} available — reduce the quantity before checkout.',
      unavailable: 'This piece is no longer available in the requested quantity.',
      wishlistAdded: 'Saved to wishlist',
      wishlistRemoved: 'Removed from wishlist',
      wishlistNeedsVariant: 'Open a piece to choose a size first.',
      searchNoResults: 'No pieces found',
      searchNoResultsText: 'Try a different word or browse the full archive.',
      viewAll: 'View all results',
      close: 'Close',
      loading: 'Loading',
      newsletterSuccess: 'You are on the private list.',
      networkError: 'The archive could not be reached. Check your connection and try again.',
      genericError: 'Something went wrong. Please try again.',
      from: 'From',
      lowStock: 'Low stock',
      soldOut: 'Sold out',
      addedToBag: 'Added to bag.',
      addedVariantToBag: '{name} ({label}) added to your bag.',
      emailRequired: 'Please enter a valid email address.',
      previous: 'Previous',
      next: 'Next',
      page: 'Page {page} of {total}',
      noOrders: 'No orders yet.'
    },
    id: {
      added: 'Ditambahkan ke tas',
      removed: 'Dihapus',
      cartEmpty: 'Tas Anda kosong',
      cartEmptyText: 'Karya yang Anda pilih akan menunggu di sini, terbungkus dalam gelap.',
      bag: 'Tas',
      quantity: 'Jumlah',
      remove: 'Hapus',
      stockWarning: 'Hanya tersedia {count} — kurangi jumlah sebelum checkout.',
      unavailable: 'Karya ini tidak lagi tersedia dalam jumlah yang diminta.',
      wishlistAdded: 'Disimpan ke wishlist',
      wishlistRemoved: 'Dihapus dari wishlist',
      wishlistNeedsVariant: 'Buka karya untuk memilih ukuran terlebih dahulu.',
      searchNoResults: 'Tidak ada karya ditemukan',
      searchNoResultsText: 'Coba kata lain atau telusuri seluruh arsip.',
      viewAll: 'Lihat semua hasil',
      close: 'Tutup',
      loading: 'Memuat',
      newsletterSuccess: 'Anda masuk ke daftar privat.',
      networkError: 'Arsip tidak dapat dihubungi. Periksa koneksi lalu coba lagi.',
      genericError: 'Terjadi kesalahan. Silakan coba lagi.',
      from: 'Dari',
      lowStock: 'Stok terbatas',
      soldOut: 'Habis',
      addedToBag: 'Ditambahkan ke tas.',
      addedVariantToBag: '{name} ({label}) ditambahkan ke tas Anda.',
      emailRequired: 'Masukkan alamat email yang valid.',
      previous: 'Sebelumnya',
      next: 'Berikutnya',
      page: 'Halaman {page} dari {total}',
      noOrders: 'Belum ada pesanan.'
    }
  }[lang];

  const hasDOM = typeof document !== 'undefined';
  let cartSequence = 0;
  let searchTimer = null;
  let searchSequence = 0;

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeAttr(value) {
    return escapeHTML(value).replaceAll('\n', '&#10;').replaceAll('\r', '&#13;');
  }

  function interpolate(template, map) {
    return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (
      Object.prototype.hasOwnProperty.call(map || {}, key) ? String(map[key]) : ''
    ));
  }

  function formatMoney(cents) {
    const amount = Number(cents || 0);
    if (moneyCurrency === 'IDR') {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
      }).format(Math.round((amount / 100) * exchangeRate));
    }
    const usd = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: Number.isInteger(usd) ? 0 : 2,
      maximumFractionDigits: 2
    }).format(usd);
  }

  function formatIdrNumber(value) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function readStorage(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* Storage can be disabled; the UI still works for the current request. */
    }
  }

  function removeStorage(key) {
    try { window.localStorage.removeItem(key); } catch (_) { /* noop */ }
  }

  async function apiFetch(url, options = {}) {
    const init = { credentials: 'same-origin', ...options };
    init.headers = new Headers(options.headers || {});
    init.headers.set('Accept', 'application/json');
    if (init.body && !(init.body instanceof FormData) && typeof init.body !== 'string') {
      init.headers.set('Content-Type', 'application/json');
      init.body = JSON.stringify(init.body);
    }
    const method = String(init.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      init.headers.set('X-CSRF-Token', String(state.csrfToken || ''));
    }
    let response;
    try {
      response = await fetch(url, init);
    } catch (_) {
      const error = new Error(ui.networkError);
      error.code = 'network';
      throw error;
    }
    let data = null;
    const type = response.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      try { data = await response.json(); } catch (_) { data = null; }
    } else {
      try { data = await response.text(); } catch (_) { data = null; }
    }
    if (!response.ok) {
      const message = data && data.error && data.error.message
        ? data.error.message
        : ui.genericError;
      const error = new Error(message);
      error.status = response.status;
      error.code = data && data.error ? data.error.code : '';
      error.data = data;
      throw error;
    }
    return data;
  }

  function toast(message, type = 'success') {
    if (!message) return;
    let stack = document.querySelector('[data-toast-stack]');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.dataset.toastStack = '';
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    const node = document.createElement('div');
    node.className = `toast${type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : ''}`;
    node.setAttribute('role', 'status');
    const star = document.createElement('span');
    star.setAttribute('aria-hidden', 'true');
    star.textContent = type === 'error' ? '!' : '✦';
    const copy = document.createElement('span');
    copy.textContent = message;
    node.append(star, copy);
    stack.appendChild(node);
    window.setTimeout(() => {
      node.style.opacity = '0';
      node.style.transition = 'opacity .25s ease, transform .25s ease';
      node.style.transform = 'translateY(8px)';
      window.setTimeout(() => node.remove(), 280);
    }, 3400);
  }

  /* ---------------------------------------------------------------------
     Bag
     --------------------------------------------------------------------- */

  function readCart() {
    const raw = readStorage(CART_KEY, []);
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const clean = [];
    for (const line of raw) {
      const variantId = Number(line && line.variantId);
      const quantity = Math.max(1, Math.min(MAX_QTY, Number.parseInt(line && line.quantity, 10) || 1));
      if (!Number.isInteger(variantId) || variantId <= 0 || seen.has(variantId)) continue;
      seen.add(variantId);
      clean.push({ variantId, quantity });
    }
    return clean;
  }

  function writeCart(lines) {
    const clean = [];
    const seen = new Set();
    for (const line of Array.isArray(lines) ? lines : []) {
      const variantId = Number(line && line.variantId);
      const quantity = Math.max(1, Math.min(MAX_QTY, Number.parseInt(line && line.quantity, 10) || 1));
      if (!Number.isInteger(variantId) || variantId <= 0 || seen.has(variantId)) continue;
      seen.add(variantId);
      clean.push({ variantId, quantity });
    }
    writeStorage(CART_KEY, clean);
    updateCartBadges(clean.reduce((sum, line) => sum + line.quantity, 0));
    return clean;
  }

  function cartCount() {
    return readCart().reduce((sum, line) => sum + line.quantity, 0);
  }

  function updateCartBadges(count = cartCount()) {
    document.querySelectorAll('[data-cart-count]').forEach((node) => {
      node.textContent = count > 0 ? String(count) : '';
    });
    const drawerCount = document.querySelector('[data-cart-drawer-count]');
    if (drawerCount) drawerCount.textContent = count > 0 ? `(${count})` : '';
  }

  async function resolveCart() {
    const sequence = ++cartSequence;
    const items = readCart();
    if (!items.length) {
      renderCart({ items: [], subtotalCents: 0, count: 0 });
      return;
    }
    try {
      const data = await apiFetch('/api/cart/resolve', { method: 'POST', body: { items } });
      if (sequence !== cartSequence) return;
      const resolvedIds = new Set((data.items || []).map((item) => Number(item.variantId)));
      const pruned = items.filter((line) => resolvedIds.has(Number(line.variantId)));
      if (pruned.length !== items.length) writeCart(pruned);
      renderCart(data);
    } catch (error) {
      if (sequence !== cartSequence) return;
      const container = document.querySelector('[data-cart-items]');
      if (container) {
        container.innerHTML = `<div class="cart-empty"><span aria-hidden="true">✦</span><h3>${escapeHTML(ui.loading)}</h3><p>${escapeHTML(error.message || ui.genericError)}</p></div>`;
      }
      toast(error.message || ui.networkError, 'error');
    }
  }

  function cartLineHTML(item) {
    const warning = !item.available
      ? `<p class="cart-line-warning">${escapeHTML(interpolate(ui.stockWarning, { count: item.stock }))}</p>`
      : '';
    return `
      <div class="cart-line" data-cart-line="${item.variantId}">
        <a href="/product/${escapeAttr(item.slug)}" aria-hidden="true" tabindex="-1"><img class="cart-line-image" src="${escapeAttr(item.image)}" alt="" loading="lazy"></a>
        <div class="cart-line-copy">
          <h3><a href="/product/${escapeAttr(item.slug)}">${escapeHTML(item.name)}</a></h3>
          <p>${escapeHTML(item.label)}</p>
          <div class="cart-line-controls">
            <div class="cart-line-qty" aria-label="${escapeAttr(ui.quantity)}">
              <button type="button" data-cart-action="decrease" data-variant-id="${item.variantId}" aria-label="${escapeAttr(ui.quantity)} −">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-cart-action="increase" data-variant-id="${item.variantId}" aria-label="${escapeAttr(ui.quantity)} +">+</button>
            </div>
            <button class="cart-line-remove" type="button" data-cart-action="remove" data-variant-id="${item.variantId}">${escapeHTML(ui.remove)}</button>
          </div>
        </div>
        <span class="cart-line-total">${formatMoney(item.lineTotalCents)}</span>
        ${warning}
      </div>`;
  }

  function renderCart(data) {
    const items = Array.isArray(data.items) ? data.items : [];
    const container = document.querySelector('[data-cart-items]');
    const subtotal = document.querySelector('[data-cart-subtotal]');
    const foot = document.querySelector('.cart-drawer-foot');
    const count = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (container) {
      container.innerHTML = items.length
        ? items.map(cartLineHTML).join('')
        : `<div class="cart-empty">
            <span aria-hidden="true">✦</span>
            <h3>${escapeHTML(strings.cartEmpty || ui.cartEmpty)}</h3>
            <p>${escapeHTML(strings.cartEmptyText || ui.cartEmptyText)}</p>
            <a class="button button--outline" href="/shop">${escapeHTML(strings.startShopping || 'Shop the archive')} <span aria-hidden="true">↗</span></a>
          </div>`;
    }
    if (subtotal) subtotal.textContent = formatMoney(data.subtotalCents || 0);
    if (foot) foot.hidden = items.length === 0;
    updateCartBadges(count);
  }

  function syncOverlayLock() {
    const open = document.querySelector('.search-overlay.is-open, .cart-drawer.is-open, .mobile-menu.is-open, .shop-filters.is-open');
    body.classList.toggle('no-scroll', Boolean(open));
  }

  const overlayOpeners = new WeakMap();
  const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function currentOverlay() {
    return document.querySelector('.search-overlay.is-open, .cart-drawer.is-open, .mobile-menu.is-open, .shop-filters.is-open');
  }

  function captureOverlayOpener(overlay) {
    const active = document.activeElement;
    if (!active || active === document.body || overlay.contains(active)) return null;
    if (active.closest('.search-overlay.is-open, .cart-drawer.is-open, .mobile-menu.is-open, .shop-filters.is-open')) return null;
    return active;
  }

  function rememberOverlayOpener(overlay, opener) {
    if (opener) overlayOpeners.set(overlay, opener);
  }

  function restoreOverlayOpener(overlay) {
    const opener = overlayOpeners.get(overlay);
    overlayOpeners.delete(overlay);
    if (opener && document.contains(opener) && opener.getClientRects().length) opener.focus({ preventScroll: true });
  }

  function focusableElements(overlay) {
    return [...overlay.querySelectorAll(focusableSelector)].filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
  }

  function openCart() {
    const drawer = document.querySelector('[data-cart-drawer]');
    const backdrop = document.querySelector('[data-cart-backdrop]');
    if (!drawer) return;
    const opener = captureOverlayOpener(drawer);
    closeSearch(false);
    closeMenu(false);
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (backdrop) backdrop.classList.add('is-open');
    rememberOverlayOpener(drawer, opener);
    syncOverlayLock();
    resolveCart();
    window.setTimeout(() => {
      const close = drawer.querySelector('[data-cart-close]');
      if (close) close.focus({ preventScroll: true });
    }, 60);
  }

  function closeCart(restoreFocus = true) {
    const drawer = document.querySelector('[data-cart-drawer]');
    const backdrop = document.querySelector('[data-cart-backdrop]');
    if (drawer) {
      drawer.classList.remove('is-open');
      if (restoreFocus) restoreOverlayOpener(drawer);
      else overlayOpeners.delete(drawer);
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) backdrop.classList.remove('is-open');
    syncOverlayLock();
  }

  function addToCart(variantId, quantity = 1) {
    const id = Number(variantId);
    if (!Number.isInteger(id) || id <= 0) return false;
    const lines = readCart();
    const existing = lines.find((line) => line.variantId === id);
    const wanted = Math.max(1, Math.min(MAX_QTY, Number(quantity) || 1));
    if (existing) existing.quantity = Math.min(MAX_QTY, existing.quantity + wanted);
    else lines.push({ variantId: id, quantity: wanted });
    writeCart(lines);
    document.dispatchEvent(new CustomEvent('se:cart-changed', { detail: { items: readCart() } }));
    return true;
  }

  function addManyToCart(entries) {
    const lines = readCart();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const id = Number(entry && (entry.variantId || entry.id));
      const quantity = Math.max(1, Math.min(MAX_QTY, Number(entry && entry.quantity) || 1));
      if (!Number.isInteger(id) || id <= 0) continue;
      const existing = lines.find((line) => line.variantId === id);
      if (existing) existing.quantity = Math.min(MAX_QTY, existing.quantity + quantity);
      else lines.push({ variantId: id, quantity });
    }
    writeCart(lines);
    document.dispatchEvent(new CustomEvent('se:cart-changed', { detail: { items: readCart() } }));
  }

  function adjustCartLine(variantId, action) {
    const id = Number(variantId);
    const lines = readCart();
    const line = lines.find((entry) => entry.variantId === id);
    if (!line) return;
    if (action === 'remove') {
      const index = lines.indexOf(line);
      lines.splice(index, 1);
      writeCart(lines);
      syncCartDrawer();
      toast(strings.itemRemoved || ui.removed);
      return;
    }
    if (action === 'increase') line.quantity = Math.min(MAX_QTY, line.quantity + 1);
    if (action === 'decrease') line.quantity = Math.max(1, line.quantity - 1);
    writeCart(lines);
    syncCartDrawer();
  }

  function syncCartDrawer() {
    if (document.querySelector('[data-cart-drawer].is-open')) resolveCart();
    else {
      updateCartBadges();
      document.dispatchEvent(new CustomEvent('se:cart-changed', { detail: { items: readCart() } }));
    }
  }

  /* ---------------------------------------------------------------------
     Wishlist
     --------------------------------------------------------------------- */

  function normalizeWishlistProduct(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = Number(raw.id || raw.productId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const variants = Array.isArray(raw.variants) ? raw.variants : [];
    let defaultVariant = raw.defaultVariant || null;
    if (!defaultVariant && variants.length) {
      defaultVariant = variants.find((variant) => variant.available !== false && Number(variant.stock) > 0)
        || variants[0];
    }
    const totalStock = raw.totalStock != null
      ? Number(raw.totalStock)
      : variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
    return {
      id,
      slug: raw.slug || '',
      name: raw.name || '',
      category: raw.category || '',
      categoryLabel: raw.categoryLabel || raw.category || '',
      collection: raw.collection || '',
      collectionLabel: raw.collectionLabel || '',
      priceCents: Number(raw.priceCents || 0),
      maxPriceCents: Number(raw.maxPriceCents || raw.priceCents || 0),
      hasPriceRange: Boolean(raw.hasPriceRange),
      imageA: raw.imageA || raw.image || '',
      imageB: raw.imageB || raw.imageA || raw.image || '',
      badgeLabel: raw.badgeLabel || '',
      totalStock,
      lowStock: raw.lowStock != null ? Boolean(raw.lowStock) : totalStock > 0 && totalStock <= 8,
      soldOut: raw.soldOut != null ? Boolean(raw.soldOut) : totalStock <= 0,
      defaultVariant: defaultVariant ? {
        id: Number(defaultVariant.id),
        label: defaultVariant.label || '',
        priceCents: Number(defaultVariant.priceCents || raw.priceCents || 0),
        stock: Number(defaultVariant.stock || 0)
      } : null,
      variants: variants.map((variant) => ({
        id: Number(variant.id),
        label: variant.label || '',
        priceCents: Number(variant.priceCents || raw.priceCents || 0),
        stock: Number(variant.stock || 0),
        available: variant.available !== false && Number(variant.stock) > 0
      })),
      url: raw.url || `/product/${raw.slug || ''}`
    };
  }

  function guestWishlist() {
    const raw = readStorage(WISHLIST_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeWishlistProduct).filter(Boolean);
  }

  function saveGuestWishlist(items) {
    writeStorage(WISHLIST_KEY, items.map(normalizeWishlistProduct).filter(Boolean));
    state.wishlistIds = items.map((item) => Number(item.id)).filter(Boolean);
    updateWishlistBadges();
    updateWishlistButtons();
  }

  function wishlistIds() {
    return Array.isArray(state.wishlistIds) ? state.wishlistIds.map(Number) : [];
  }

  function isWishlisted(productId) {
    return wishlistIds().includes(Number(productId));
  }

  function updateWishlistBadges() {
    const count = state.user ? wishlistIds().length : guestWishlist().length;
    document.querySelectorAll('[data-wishlist-count]').forEach((node) => {
      node.textContent = count > 0 ? String(count) : '';
    });
  }

  function updateWishlistButtons() {
    document.querySelectorAll('[data-wishlist-toggle]').forEach((button) => {
      const card = button.closest('[data-product-card]');
      const id = Number(button.dataset.productId || (card && card.dataset.productId));
      if (!Number.isInteger(id) || id <= 0) return;
      const saved = isWishlisted(id);
      button.classList.toggle('is-saved', saved);
      button.setAttribute('aria-pressed', saved ? 'true' : 'false');
    });
  }

  function productFromElement(element) {
    if (!element) return null;
    const target = element.closest('[data-product-json]') || element.closest('[data-product-card]');
    if (!target) return null;
    const raw = target.dataset.productJson;
    if (raw) {
      try { return normalizeWishlistProduct(JSON.parse(raw)); } catch (_) { return null; }
    }
    const card = element.closest('[data-product-card]');
    return null;
  }

  async function toggleWishlist(product, button) {
    const item = normalizeWishlistProduct(product);
    if (!item) return;
    const saved = isWishlisted(item.id);
    if (button) button.disabled = true;
    try {
      if (state.user) {
        const data = saved
          ? await apiFetch(`/api/wishlist/${item.id}`, { method: 'DELETE' })
          : await apiFetch('/api/wishlist', { method: 'POST', body: { productId: item.id } });
        state.wishlistIds = Array.isArray(data.ids) ? data.ids.map(Number) : [];
        updateWishlistBadges();
        updateWishlistButtons();
        toast(saved ? (strings.wishlistRemoved || ui.wishlistRemoved) : (strings.wishlistAdded || ui.wishlistAdded));
        document.dispatchEvent(new CustomEvent('se:wishlist-changed', {
          detail: { ids: state.wishlistIds, items: data.items || [], product: item, saved: !saved }
        }));
      } else {
        const list = guestWishlist();
        const index = list.findIndex((entry) => entry.id === item.id);
        if (index >= 0) list.splice(index, 1);
        else list.unshift(item);
        saveGuestWishlist(list);
        toast(saved ? (strings.wishlistRemoved || ui.wishlistRemoved) : (strings.wishlistAdded || ui.wishlistAdded));
        document.dispatchEvent(new CustomEvent('se:wishlist-changed', {
          detail: { ids: state.wishlistIds, items: guestWishlist(), product: item, saved: !saved }
        }));
      }
    } catch (error) {
      if (error.code === 'auth_required') {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      toast(error.message || ui.genericError, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  /* ---------------------------------------------------------------------
     Product cards (used by wishlist, shop load-more and search)
     --------------------------------------------------------------------- */

  function cardPayload(product) {
    const item = normalizeWishlistProduct(product);
    if (!item) return null;
    return {
      id: item.id,
      slug: item.slug,
      name: item.name,
      category: item.category,
      categoryLabel: item.categoryLabel,
      collection: item.collection,
      priceCents: item.priceCents,
      imageA: item.imageA,
      imageB: item.imageB,
      totalStock: item.totalStock,
      lowStock: item.lowStock,
      soldOut: item.soldOut,
      badgeLabel: item.badgeLabel,
      hasPriceRange: item.hasPriceRange,
      defaultVariant: item.defaultVariant,
      variants: item.variants
    };
  }

  function productCardHTML(product) {
    const card = cardPayload(product);
    if (!card) return '';
    const saved = isWishlisted(card.id);
    const badge = card.badgeLabel
      ? `<span class="product-badge">${escapeHTML(card.badgeLabel)}</span>`
      : card.lowStock
        ? `<span class="product-badge product-badge--quiet">${escapeHTML(ui.lowStock)}</span>`
        : '';
    const quickAdd = !card.soldOut && card.defaultVariant
      ? `<button class="quick-add" type="button" data-quick-add>
           <span>${escapeHTML(strings.addToBag || 'Add to bag')}</span><span aria-hidden="true">+</span>
         </button>`
      : `<span class="quick-add quick-add--disabled">${escapeHTML(strings.soldOut || ui.soldOut)}</span>`;
    return `
      <article class="product-card" data-product-card data-product-id="${card.id}" data-product-json="${escapeAttr(JSON.stringify(card))}">
        <div class="product-card-media">
          <a href="${escapeAttr(card.url)}" class="product-image-wrap" aria-label="${escapeAttr(card.name)}">
            <img class="product-image product-image--a" src="${escapeAttr(card.imageA)}" alt="${escapeAttr(card.name)}" loading="lazy" decoding="async">
            <img class="product-image product-image--b" src="${escapeAttr(card.imageB)}" alt="" loading="lazy" decoding="async">
          </a>
          ${badge}
          <button class="wishlist-toggle${saved ? ' is-saved' : ''}" type="button" data-wishlist-toggle aria-label="${escapeAttr(strings.wishlist || ui.wishlistAdded)}" aria-pressed="${saved ? 'true' : 'false'}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2S4.2 15.4 4.2 9.4A4.2 4.2 0 0 1 12 6.6a4.2 4.2 0 0 1 7.8 2.8c0 6-7.8 10.8-7.8 10.8Z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
          </button>
          ${quickAdd}
        </div>
        <div class="product-card-info">
          <div>
            <p class="product-card-category">${escapeHTML(card.categoryLabel)}</p>
            <h3><a href="${escapeAttr(card.url)}">${escapeHTML(card.name)}</a></h3>
          </div>
          <p class="product-card-price">
            ${card.hasPriceRange ? `<span>${escapeHTML(ui.from)}</span>` : ''}
            <span>${formatMoney(card.priceCents)}</span>
          </p>
        </div>
      </article>`;
  }

  function renderPagination(container, page, totalPages, onPage) {
    if (!container) return;
    container.innerHTML = '';
    if (!totalPages || totalPages <= 1) return;
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'admin-page-button';
    previous.textContent = ui.previous;
    previous.disabled = page <= 1;
    previous.addEventListener('click', () => onPage(page - 1));
    const label = document.createElement('span');
    label.textContent = interpolate(ui.page, { page, total: totalPages });
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'admin-page-button';
    next.textContent = ui.next;
    next.disabled = page >= totalPages;
    next.addEventListener('click', () => onPage(page + 1));
    container.append(previous, label, next);
  }

  /* ---------------------------------------------------------------------
     Search & navigation overlays
     --------------------------------------------------------------------- */

  function openSearch() {
    const overlay = document.querySelector('[data-search-overlay]');
    if (!overlay) return;
    const opener = captureOverlayOpener(overlay);
    closeMenu(false);
    closeCart(false);
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    rememberOverlayOpener(overlay, opener);
    syncOverlayLock();
    window.setTimeout(() => {
      const input = overlay.querySelector('[data-search-input]');
      if (input) input.focus({ preventScroll: true });
    }, 80);
  }

  function closeSearch(restoreFocus = true) {
    const overlay = document.querySelector('[data-search-overlay]');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    if (restoreFocus) restoreOverlayOpener(overlay);
    else overlayOpeners.delete(overlay);
    overlay.setAttribute('aria-hidden', 'true');
    syncOverlayLock();
  }

  function searchResultsHTML(products) {
    if (!products.length) {
      return `<div class="search-empty"><h3>${escapeHTML(ui.searchNoResults)}</h3><p>${escapeHTML(ui.searchNoResultsText)}</p></div>`;
    }
    return products.map((product) => `
      <a class="search-result" href="${escapeAttr(product.url || `/product/${product.slug}`)}">
        <img src="${escapeAttr(product.imageA)}" alt="" loading="lazy">
        <div><h3>${escapeHTML(product.name)}</h3><p>${escapeHTML(product.categoryLabel || product.category || '')}</p></div>
        <span>${formatMoney(product.priceCents)}</span>
      </a>`).join('');
  }

  async function runSearch(value) {
    const results = document.querySelector('[data-search-results]');
    const suggestions = document.querySelector('[data-search-suggestions]');
    const viewAll = document.querySelector('[data-search-view-all]');
    if (!results) return;
    const query = String(value || '').trim();
    if (query.length < 2) {
      results.innerHTML = '';
      if (suggestions) suggestions.hidden = false;
      if (viewAll) viewAll.hidden = true;
      return;
    }
    if (suggestions) suggestions.hidden = true;
    const sequence = ++searchSequence;
    results.innerHTML = `<p class="summary-loading">${escapeHTML(strings.loading || ui.loading)}…</p>`;
    try {
      const data = await apiFetch(`/api/products?search=${encodeURIComponent(query)}&limit=8`);
      if (sequence !== searchSequence) return;
      results.innerHTML = searchResultsHTML(data.items || []);
      if (viewAll) {
        viewAll.hidden = false;
        viewAll.href = `/shop?search=${encodeURIComponent(query)}`;
      }
    } catch (error) {
      if (sequence !== searchSequence) return;
      results.innerHTML = `<div class="search-empty"><h3>${escapeHTML(ui.searchNoResults)}</h3><p>${escapeHTML(error.message || ui.genericError)}</p></div>`;
    }
  }

  function openMenu() {
    const menu = document.querySelector('[data-mobile-menu]');
    const shade = document.querySelector('[data-page-shade]');
    const toggle = document.querySelector('[data-menu-toggle]');
    if (!menu) return;
    const opener = captureOverlayOpener(menu);
    closeSearch(false);
    closeCart(false);
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    if (shade) shade.classList.add('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    rememberOverlayOpener(menu, opener);
    syncOverlayLock();
    window.setTimeout(() => {
      const close = menu.querySelector('[data-menu-close]');
      if (close) close.focus({ preventScroll: true });
    }, 60);
  }

  function closeMenu(restoreFocus = true) {
    const menu = document.querySelector('[data-mobile-menu]');
    const shade = document.querySelector('[data-page-shade]');
    const toggle = document.querySelector('[data-menu-toggle]');
    if (!menu) return;
    menu.classList.remove('is-open');
    if (restoreFocus) restoreOverlayOpener(menu);
    else overlayOpeners.delete(menu);
    menu.setAttribute('aria-hidden', 'true');
    if (shade) shade.classList.remove('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    syncOverlayLock();
  }

  /* ---------------------------------------------------------------------
     Account / feedback / forms
     --------------------------------------------------------------------- */

  async function logout(button) {
    if (button) button.disabled = true;
    try {
      const data = await apiFetch('/api/auth/logout', {
        method: 'POST',
        body: {}
      });
      window.location.assign(data.redirect || '/');
    } catch (error) {
      toast(error.message || ui.genericError, 'error');
      if (button) button.disabled = false;
    }
  }

  function setFormAlert(element, message, success = false) {
    if (!element) return;
    element.textContent = message || '';
    element.hidden = !message;
    element.classList.toggle('is-success', Boolean(success));
  }

  function showNewsletterFeedback(form, message, success) {
    const feedback = form.querySelector('[data-newsletter-feedback]');
    if (feedback) {
      feedback.textContent = message || '';
      feedback.classList.toggle('is-success', Boolean(success));
    }
  }

  async function handleNewsletter(form) {
    const input = form.querySelector('input[type="email"]');
    if (!input) return;
    const email = input.value.trim();
    if (!email || !input.checkValidity()) {
      showNewsletterFeedback(form, ui.emailRequired, false);
      input.focus();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      await apiFetch('/api/newsletter', {
        method: 'POST',
        body: { email, lang }
      });
      form.reset();
      showNewsletterFeedback(form, strings.newsletterSuccess || ui.newsletterSuccess, true);
    } catch (error) {
      showNewsletterFeedback(form, error.message || ui.genericError, false);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function initReveal() {
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!nodes.length) return;
    document.documentElement.classList.add('reveal-ready');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-revealed'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach((node) => observer.observe(node));
  }

  function syncHeaderOnScroll() {
    const header = document.querySelector('[data-site-header]');
    if (!header) return;
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 20);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  function initCursorNote() {
    const note = document.querySelector('.cursor-note');
    if (!note || !window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = null;
    let x = 0;
    let y = 0;
    document.addEventListener('pointermove', (event) => {
      x = event.clientX;
      y = event.clientY;
      note.classList.add('is-visible');
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        note.style.transform = `translate3d(${x + 16}px, ${y + 16}px, 0)`;
        raf = null;
      });
    }, { passive: true });
    document.addEventListener('pointerleave', () => note.classList.remove('is-visible'));
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest('[data-cart-open]')) {
        event.preventDefault();
        openCart();
        return;
      }
      if (target.closest('[data-cart-close]') || target.closest('[data-cart-backdrop]')) {
        event.preventDefault();
        closeCart();
        return;
      }
      const cartAction = target.closest('[data-cart-action]');
      if (cartAction) {
        event.preventDefault();
        adjustCartLine(cartAction.dataset.variantId, cartAction.dataset.cartAction);
        return;
      }
      if (target.closest('[data-search-open]')) {
        event.preventDefault();
        openSearch();
        return;
      }
      if (target.closest('[data-search-close]')) {
        event.preventDefault();
        closeSearch();
        return;
      }
      if (target === document.querySelector('[data-search-overlay]')) {
        closeSearch();
        return;
      }
      if (target.closest('[data-menu-toggle]')) {
        event.preventDefault();
        openMenu();
        return;
      }
      if (target.closest('[data-menu-close]') || target.closest('[data-page-shade]')) {
        event.preventDefault();
        closeMenu();
        return;
      }
      const wishlistButton = target.closest('[data-wishlist-toggle]');
      if (wishlistButton) {
        event.preventDefault();
        const product = productFromElement(wishlistButton);
        if (product) toggleWishlist(product, wishlistButton);
        return;
      }
      const quickAdd = target.closest('[data-quick-add]');
      if (quickAdd) {
        event.preventDefault();
        const card = quickAdd.closest('[data-product-card]');
        const product = card ? productFromElement(card) : null;
        if (!product) return;
        if (!product.defaultVariant || product.defaultVariant.stock <= 0) {
          window.location.assign(product.url || `/product/${product.slug}`);
          return;
        }
        addToCart(product.defaultVariant.id, 1);
        toast(interpolate(ui.addedVariantToBag, { name: product.name, label: product.defaultVariant.label }));
        closeMenu();
        openCart();
        return;
      }
      const logoutButton = target.closest('[data-logout]');
      if (logoutButton) {
        event.preventDefault();
        logout(logoutButton);
      }
    });

    const searchForm = document.querySelector('[data-search-form]');
    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = searchForm.querySelector('[data-search-input]');
        const query = input ? input.value.trim() : '';
        if (query.length < 2) {
          if (input) input.focus();
          return;
        }
        window.location.assign(`/shop?search=${encodeURIComponent(query)}`);
      });
    }

    const searchInput = document.querySelector('[data-search-input]');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        const value = searchInput.value;
        searchTimer = window.setTimeout(() => runSearch(value), 240);
      });
    }

    document.querySelectorAll('[data-newsletter-form]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        handleNewsletter(form);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        const overlay = currentOverlay();
        if (!overlay) return;
        const focusables = focusableElements(overlay);
        if (!focusables.length) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!overlay.contains(active)) {
          event.preventDefault();
          first.focus({ preventScroll: true });
          return;
        }
        if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
        return;
      }
      if (event.key !== 'Escape') return;
      if (document.querySelector('.search-overlay.is-open')) {
        closeSearch();
        return;
      }
      if (document.querySelector('[data-cart-drawer].is-open')) {
        closeCart();
        return;
      }
      if (document.querySelector('.mobile-menu.is-open')) closeMenu();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1080) {
        closeMenu();
        const filters = document.querySelector('[data-shop-filters-panel].is-open');
        if (filters) {
          filters.classList.remove('is-open');
          syncOverlayLock();
        }
      }
    });
  }

  async function init() {
    if (!hasDOM) return;
    if (state.user) {
      state.wishlistIds = Array.isArray(state.wishlistIds) ? state.wishlistIds.map(Number) : [];
    } else {
      state.wishlistIds = guestWishlist().map((item) => item.id);
    }

    if (body.dataset.clearCart === '1') {
      removeStorage(CART_KEY);
      updateCartBadges(0);
    }

    updateCartBadges();
    updateWishlistBadges();
    updateWishlistButtons();
    bindEvents();
    initReveal();
    syncHeaderOnScroll();
    initCursorNote();

    if (document.querySelector('[data-cart-drawer].is-open')) resolveCart();
  }

  window.SEApp = {
    state,
    ui,
    apiFetch,
    toast,
    formatMoney,
    formatIdrNumber,
    escapeHTML,
    escapeAttr,
    interpolate,
    setFormAlert,
    productCardHTML,
    normalizeWishlistProduct,
    normalizeProduct: normalizeWishlistProduct,
    cardPayload,
    openCart,
    closeCart,
    openSearch,
    closeSearch,
    openMenu,
    closeMenu,
    addToCart,
    addManyToCart,
    readCart,
    writeCart,
    updateCartBadges,
    syncCartDrawer,
    resolveCart,
    guestWishlist,
    saveGuestWishlist,
    updateWishlistBadges,
    updateWishlistButtons,
    toggleWishlist,
    isWishlisted,
    productFromElement,
    renderPagination,
    syncOverlayLock,
    logout
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
