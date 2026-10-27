'use strict';

(function () {
  const app = window.SEApp;
  const state = window.SE || {};
  if (!app) return;

  const page = document.querySelector('[data-wishlist-page]');
  if (!page) return;

  const lang = state.lang === 'id' ? 'id' : 'en';
  const signedIn = page.dataset.signedIn === '1';
  const grid = page.querySelector('[data-wishlist-grid]');
  const empty = page.querySelector('[data-wishlist-empty]');
  const countLabel = page.querySelector('[data-wishlist-count-label]');
  const moveAll = page.querySelector('[data-wishlist-move-all]');
  const copy = {
    en: {
      noVariant: 'Some saved pieces need a size. Open each piece to choose before adding.',
      nothing: 'There are no pieces in your wishlist yet.',
      addedAll: 'Available saved pieces were added to your bag.',
      partially: 'Some pieces were added. Others need a size or are sold out.'
    },
    id: {
      noVariant: 'Beberapa karya tersimpan perlu ukuran. Buka karya untuk memilih sebelum menambahkan.',
      nothing: 'Belum ada karya dalam wishlist Anda.',
      addedAll: 'Karya tersimpan yang tersedia ditambahkan ke tas Anda.',
      partially: 'Sebagian karya ditambahkan. Sisanya perlu ukuran atau sudah habis.'
    }
  }[lang];

  function itemsFromDOM() {
    return Array.from(grid ? grid.querySelectorAll('[data-product-card]') : []).map((card) => {
      try { return JSON.parse(card.dataset.productJson || '{}'); } catch (_) { return null; }
    }).filter(Boolean);
  }

  function guestItems() {
    return app.guestWishlist();
  }

  function currentItems() {
    return signedIn ? itemsFromDOM() : guestItems();
  }

  function render(items) {
    const list = (items || []).map(app.normalizeProduct).filter(Boolean);
    if (grid) grid.innerHTML = list.map(app.productCardHTML).join('');
    if (empty) empty.hidden = list.length > 0;
    if (countLabel) countLabel.textContent = String(list.length);
    if (moveAll) moveAll.hidden = list.length === 0;
    page.dataset.initialCount = String(list.length);
    app.state.wishlistIds = list.map((item) => item.id);
    app.updateWishlistBadges();
    app.updateWishlistButtons();
  }

  function addAllToCart() {
    const items = currentItems();
    if (!items.length) {
      app.toast(copy.nothing, 'error');
      return;
    }
    const lines = [];
    let skipped = 0;
    for (const raw of items) {
      const item = app.normalizeProduct(raw);
      if (!item || !item.defaultVariant || !item.defaultVariant.id || item.defaultVariant.stock <= 0) {
        skipped += 1;
        continue;
      }
      lines.push({ variantId: item.defaultVariant.id, quantity: 1 });
    }
    if (!lines.length) {
      app.toast(copy.noVariant, 'error');
      return;
    }
    app.addManyToCart(lines);
    app.openCart();
    app.toast(skipped ? copy.partially : copy.addedAll);
  }

  if (moveAll) moveAll.addEventListener('click', addAllToCart);

  document.addEventListener('se:wishlist-changed', (event) => {
    const detail = event.detail || {};
    if (Array.isArray(detail.items)) {
      render(detail.items);
    } else if (signedIn) {
      render(itemsFromDOM());
    } else {
      render(guestItems());
    }
  });

  if (!signedIn) {
    render(guestItems());
  } else {
    render(itemsFromDOM());
  }
}());
