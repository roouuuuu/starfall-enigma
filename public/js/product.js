'use strict';

(function () {
  const app = window.SEApp;
  const state = window.SE || {};
  if (!app) return;

  const form = document.querySelector('[data-product-form]');
  const gallery = document.querySelector('[data-product-gallery]');
  if (!form && !gallery) return;

  const lang = state.lang === 'id' ? 'id' : 'en';
  const copy = {
    en: {
      available: 'Available to ship',
      low: '{count} left — low stock',
      soldOut: 'Sold out',
      choose: 'Choose an available size to continue.',
      added: 'Added to your bag.',
      copy: 'Link copied.',
      copyError: 'Copy the link from your address bar.',
      zoom: 'Enlarged product image'
    },
    id: {
      available: 'Tersedia untuk dikirim',
      low: 'Tersisa {count} — stok terbatas',
      soldOut: 'Habis',
      choose: 'Pilih ukuran yang tersedia untuk melanjutkan.',
      added: 'Ditambahkan ke tas Anda.',
      copy: 'Tautan disalin.',
      copyError: 'Salin tautan dari bilah alamat Anda.',
      zoom: 'Gambar produk diperbesar'
    }
  }[lang];

  let product = null;
  let selectedId = null;

  try {
    product = form ? JSON.parse(form.dataset.productJson || '{}') : null;
  } catch (_) {
    product = null;
  }

  if (product && (!Array.isArray(product.variants) || !product.variants.length)) product = null;
  if (product) {
    product.variants = product.variants.map((variant) => ({
      id: Number(variant.id),
      label: variant.label || '',
      priceCents: Number(variant.priceCents || 0),
      stock: Number(variant.stock || 0),
      available: variant.available !== false && Number(variant.stock) > 0,
      sku: variant.sku || ''
    }));
    const active = form.querySelector('.variant-option.is-selected:not(:disabled)');
    selectedId = active ? Number(active.dataset.variantId) : (product.variants.find((variant) => variant.available) || {}).id || null;
  }

  const priceEl = form ? form.closest('.product-details')?.querySelector('[data-product-price]') : null;
  const stockEl = form ? form.querySelector('[data-product-stock]') : null;
  const qtyInput = form ? form.querySelector('input[name="quantity"]') : null;
  const addButton = form ? form.querySelector('[data-add-to-bag]') : null;
  const feedback = form ? form.querySelector('[data-product-feedback]') : null;

  function selectedVariant() {
    if (!product) return null;
    return product.variants.find((variant) => variant.id === selectedId) || null;
  }

  function setFeedback(message) {
    if (!feedback) return;
    feedback.textContent = message || '';
  }

  function refreshPrice(variant, initial = false) {
    if (!priceEl || !variant) return;
    if (initial && product && product.variants.length > 1) {
      priceEl.innerHTML = `<span>${lang === 'id' ? 'Dari' : 'From'}</span><strong>${app.formatMoney(Math.min(...product.variants.map((item) => item.priceCents)))}</strong>`;
      return;
    }
    priceEl.innerHTML = `<strong>${app.formatMoney(variant.priceCents)}</strong>`;
  }

  function refreshStock(variant) {
    if (!stockEl) return;
    if (!variant || !variant.available) {
      stockEl.innerHTML = `<span class="stock-dot stock-dot--out"></span> ${app.escapeHTML(copy.soldOut)}`;
      return;
    }
    if (variant.stock <= 5) {
      stockEl.innerHTML = `<span class="stock-dot stock-dot--low"></span> ${app.escapeHTML(app.interpolate(copy.low, { count: variant.stock }))}`;
      return;
    }
    stockEl.innerHTML = `<span class="stock-dot"></span> ${app.escapeHTML(copy.available)}`;
  }

  function refreshQuantity(variant) {
    if (!qtyInput) return;
    const max = Math.max(1, Math.min(Number(variant && variant.stock) || 0, 10));
    qtyInput.max = String(max);
    const current = Math.max(1, Number.parseInt(qtyInput.value, 10) || 1);
    qtyInput.value = String(Math.min(current, max));
    qtyInput.disabled = !variant || !variant.available;
    if (addButton) addButton.disabled = !variant || !variant.available;
  }

  function selectVariant(variantId, initial = false) {
    if (!product) return;
    const variant = product.variants.find((item) => item.id === Number(variantId));
    if (!variant || !variant.available) return;
    selectedId = variant.id;
    form.querySelectorAll('[data-variant-option]').forEach((button) => {
      const active = Number(button.dataset.variantId) === selectedId;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    refreshPrice(variant, initial);
    refreshStock(variant);
    refreshQuantity(variant);
    setFeedback('');
  }

  if (form && product) {
    form.querySelectorAll('[data-variant-option]').forEach((button) => {
      if (button.disabled) return;
      button.addEventListener('click', () => selectVariant(button.dataset.variantId));
    });

    const initial = selectedVariant();
    if (initial) {
      refreshStock(initial);
      refreshQuantity(initial);
      refreshPrice(initial, true);
    }

    form.querySelectorAll('[data-qty-minus], [data-qty-plus]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!qtyInput || qtyInput.disabled) return;
        const max = Number(qtyInput.max) || 1;
        const value = Number.parseInt(qtyInput.value, 10) || 1;
        qtyInput.value = String(button.hasAttribute('data-qty-minus')
          ? Math.max(1, value - 1)
          : Math.min(max, value + 1));
      });
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const variant = selectedVariant();
      if (!variant || !variant.available) {
        setFeedback(copy.choose);
        return;
      }
      const quantity = Math.max(1, Math.min(Number(qtyInput && qtyInput.value) || 1, variant.stock, 10));
      if (qtyInput) qtyInput.value = String(quantity);
      app.addToCart(variant.id, quantity);
      setFeedback(copy.added);
      app.toast(app.interpolate(app.ui.addedVariantToBag || '{name} added to your bag.', {
        name: product.name,
        label: variant.label
      }));
      app.openCart();
    });
  }

  if (gallery) {
    const mainImage = gallery.querySelector('[data-product-main-image]');
    const thumbs = Array.from(gallery.querySelectorAll('[data-gallery-thumb]'));
    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        thumbs.forEach((item) => item.classList.toggle('is-active', item === thumb));
        if (mainImage) mainImage.src = thumb.dataset.src || '';
        const dialogImage = document.querySelector('[data-image-dialog-img]');
        if (dialogImage) dialogImage.src = thumb.dataset.src || '';
      });
    });

    const zoom = gallery.querySelector('[data-gallery-zoom]');
    const dialog = document.querySelector('[data-image-dialog]');
    if (zoom && dialog && mainImage) {
      zoom.addEventListener('click', () => {
        const image = dialog.querySelector('[data-image-dialog-img]');
        if (image) image.src = mainImage.src;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      });
    }
    if (dialog) {
      const close = dialog.querySelector('[data-image-dialog-close]');
      if (close) close.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener('cancel', () => dialog.close());
    }
  }

  const share = document.querySelector('[data-share-copy]');
  if (share) {
    share.addEventListener('click', async () => {
      const feedbackEl = document.querySelector('[data-share-feedback]');
      const url = window.location.href;
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(url);
          copied = true;
        }
      } catch (_) {
        copied = false;
      }
      if (!copied) {
        const field = document.createElement('textarea');
        field.value = url;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
        field.remove();
      }
      if (feedbackEl) feedbackEl.textContent = copied ? copy.copy : copy.copyError;
    });
  }
}());
