'use strict';

(function () {
  const app = window.SEApp;
  const state = window.SE || {};
  if (!app) return;

  const form = document.querySelector('[data-checkout-form]');
  if (!form) return;

  const lang = state.lang === 'id' ? 'id' : 'en';
  const strings = state.strings || {};
  const copy = {
    en: {
      empty: 'Your bag is empty. Add a piece before continuing.',
      summaryEmpty: 'There are no pieces in this demo order.',
      unavailable: 'One or more pieces are unavailable in the requested quantity. Return to your bag to adjust.',
      promoEmpty: 'Add a piece to your bag before applying a promo.',
      contact: 'Please complete the required contact and delivery fields.',
      terms: 'Please accept the terms to continue.',
      failure: 'The order could not be created. Please try again.',
      stock: 'Stock changed while you were checking out. Review your bag and try again.',
      promo: 'Promo applied: {code} · {percent}% off.',
      promoInvalid: 'That promo code is not valid.',
      subtotal: 'Subtotal',
      shipping: 'Shipping'
    },
    id: {
      empty: 'Tas Anda kosong. Tambahkan karya sebelum melanjutkan.',
      summaryEmpty: 'Belum ada karya dalam pesanan demo ini.',
      unavailable: 'Satu atau beberapa karya tidak tersedia dalam jumlah yang diminta. Kembali ke tas untuk menyesuaikan.',
      promoEmpty: 'Tambahkan karya ke tas sebelum memakai promo.',
      contact: 'Lengkapi kolom kontak dan pengiriman yang wajib.',
      terms: 'Setujui syarat untuk melanjutkan.',
      failure: 'Pesanan tidak dapat dibuat. Silakan coba lagi.',
      stock: 'Stok berubah saat Anda checkout. Periksa tas dan coba lagi.',
      promo: 'Promo diterapkan: {code} · diskon {percent}%.',
      promoInvalid: 'Kode promo tidak valid.',
      subtotal: 'Subtotal',
      shipping: 'Pengiriman'
    }
  }[lang];

  const itemsEl = form.querySelector('[data-checkout-items]') || document.querySelector('[data-checkout-items]');
  const errorEl = form.querySelector('[data-checkout-error]');
  const submit = form.querySelector('[data-checkout-submit]');
  const submitLabel = form.querySelector('[data-checkout-submit-label]');
  const subtotalEl = document.querySelector('[data-summary-subtotal]');
  const discountRow = document.querySelector('[data-summary-discount-row]');
  const discountEl = document.querySelector('[data-summary-discount]');
  const totalEl = document.querySelector('[data-summary-total]');
  const promoForm = document.querySelector('[data-promo-form]');
  const promoMessage = document.querySelector('[data-promo-message]');
  const promoInput = promoForm ? promoForm.querySelector('input[name="promoCode"]') : null;
  const currencyLabel = document.querySelector('[data-checkout-currency]');
  const currency = (document.body.dataset.currency || state.currency || 'USD').toUpperCase();
  const originalSubmitLabel = submitLabel ? submitLabel.textContent : '';
  let resolved = { items: [], subtotalCents: 0 };
  let promo = { code: '', percent: 0, discountCents: 0 };
  let placing = false;

  if (currencyLabel) currencyLabel.textContent = currency;

  function setError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
    errorEl.classList.remove('is-success');
  }

  function lineHTML(item) {
    const warning = !item.available
      ? `<p class="summary-line-warning">${app.escapeHTML(interpolate(copy.unavailable))}</p>`
      : '';
    return `
      <div class="summary-line">
        <img src="${app.escapeAttr(item.image)}" alt="" loading="lazy">
        <div>
          <h3>${app.escapeHTML(item.name)}</h3>
          <p>${app.escapeHTML(item.label)} · × ${item.quantity}</p>
        </div>
        <span>${app.formatMoney(item.lineTotalCents)}</span>
        ${warning}
      </div>`;
  }

  function interpolate(template) {
    return app.interpolate(template, promo);
  }

  function updateTotals() {
    const discount = promo.discountCents || 0;
    const subtotal = resolved.subtotalCents || 0;
    if (subtotalEl) subtotalEl.textContent = app.formatMoney(subtotal);
    if (discountRow) discountRow.hidden = discount <= 0;
    if (discountEl) discountEl.textContent = discount > 0 ? `− ${app.formatMoney(discount)}` : '—';
    if (totalEl) totalEl.textContent = app.formatMoney(Math.max(0, subtotal - discount));
  }

  function renderSummary(data) {
    resolved = {
      items: Array.isArray(data.items) ? data.items : [],
      subtotalCents: Number(data.subtotalCents || 0)
    };
    if (promo.discountCents && resolved.subtotalCents) {
      promo.discountCents = Math.round(resolved.subtotalCents * (promo.percent / 100));
    }
    const hasItems = resolved.items.length > 0;
    const blocked = resolved.items.some((item) => !item.available);
    if (itemsEl) {
      itemsEl.innerHTML = hasItems
        ? resolved.items.map(lineHTML).join('')
        : `<p class="summary-loading">${app.escapeHTML(copy.summaryEmpty)} <a href="/shop">${lang === 'id' ? 'Kembali ke arsip' : 'Return to the archive'} ↗</a></p>`;
    }
    if (submit) {
      submit.disabled = !hasItems || blocked || placing;
    }
    if (submit && hasItems && blocked) {
      // Keep the control available for a retry after the customer edits their bag,
      // but explain why a submission is blocked on this page.
    }
    if (hasItems && blocked) setError(copy.unavailable);
    else if (errorEl && !placing) setError('');
    updateTotals();
    const promoBox = promoForm ? promoForm.closest('form') || promoForm : null;
    if (promoBox) promoBox.hidden = !hasItems;
  }

  async function loadCart() {
    const items = app.readCart();
    if (!items.length) {
      renderSummary({ items: [], subtotalCents: 0 });
      setError(copy.empty);
      return;
    }
    try {
      const data = await app.apiFetch('/api/cart/resolve', { method: 'POST', body: { items } });
      const ids = new Set((data.items || []).map((item) => Number(item.variantId)));
      const pruned = items.filter((line) => ids.has(Number(line.variantId)));
      if (pruned.length !== items.length) app.writeCart(pruned);
      renderSummary(data);
    } catch (error) {
      setError(error.message || copy.failure);
      if (itemsEl) itemsEl.innerHTML = `<p class="summary-loading">${app.escapeHTML(error.message || copy.failure)}</p>`;
      if (submit) submit.disabled = true;
    }
  }

  if (promoForm) {
    promoForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const code = promoInput ? promoInput.value.trim() : '';
      if (promoMessage) {
        promoMessage.textContent = '';
        promoMessage.classList.remove('is-error');
      }
      if (!code) {
        if (promoMessage) promoMessage.textContent = copy.promoInvalid;
        return;
      }
      if (!resolved.items.length) {
        if (promoMessage) promoMessage.textContent = copy.promoEmpty;
        return;
      }
      const button = promoForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        const data = await app.apiFetch('/api/promo', {
          method: 'POST',
          body: { code, subtotalCents: resolved.subtotalCents }
        });
        promo = {
          code: data.code || code.toUpperCase(),
          percent: Number(data.percent || 0),
          discountCents: Number(data.discountCents || 0)
        };
        if (promoInput) promoInput.value = promo.code;
        if (promoMessage) {
          promoMessage.classList.add('is-success');
          promoMessage.textContent = interpolate(copy.promo);
        }
        updateTotals();
        setError('');
      } catch (error) {
        promo = { code: '', percent: 0, discountCents: 0 };
        if (promoMessage) {
          promoMessage.classList.remove('is-success');
          promoMessage.textContent = error.message || copy.promoInvalid;
        }
        updateTotals();
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (placing) return;
    setError('');

    const hasItems = resolved.items.length > 0;
    if (!hasItems) {
      setError(copy.empty);
      return;
    }
    if (resolved.items.some((item) => !item.available)) {
      setError(copy.unavailable);
      return;
    }
    const terms = form.querySelector('input[name="terms"]');
    if (terms && !terms.checked) {
      setError(copy.terms);
      if (terms) terms.focus();
      return;
    }
    const required = ['email', 'firstName', 'phone', 'address1', 'city', 'postalCode', 'country'];
    for (const name of required) {
      const field = form.querySelector(`[name="${name}"]`);
      if (!field || !String(field.value || '').trim() || (field.type === 'email' && !field.checkValidity())) {
        setError(copy.contact);
        if (field) field.focus();
        return;
      }
    }

    const data = new FormData(form);
    const payload = {
      email: String(data.get('email') || '').trim(),
      firstName: String(data.get('firstName') || '').trim(),
      lastName: String(data.get('lastName') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      address1: String(data.get('address1') || '').trim(),
      address2: String(data.get('address2') || '').trim(),
      city: String(data.get('city') || '').trim(),
      region: String(data.get('region') || '').trim(),
      postalCode: String(data.get('postalCode') || '').trim(),
      country: String(data.get('country') || '').trim(),
      note: String(data.get('note') || '').trim(),
      items: resolved.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
      promoCode: promo.code || '',
      currency
    };

    placing = true;
    if (submit) submit.disabled = true;
    if (submitLabel) submitLabel.textContent = strings.demoOrderPlacing || (lang === 'id' ? 'Membuat pesanan…' : 'Placing your order…');
    try {
      const response = await app.apiFetch('/api/orders', { method: 'POST', body: payload });
      app.writeCart([]);
      app.updateCartBadges(0);
      window.location.assign(response.redirect || '/');
    } catch (error) {
      const message = error.code === 'stock'
        ? copy.stock
        : error.message || copy.failure;
      setError(message);
      toastOrderError(message);
      await loadCart();
      placing = false;
      if (submitLabel) submitLabel.textContent = originalSubmitLabel;
      if (submit) submit.disabled = !resolved.items.length || resolved.items.some((item) => !item.available);
    }
  });

  function toastOrderError(message) {
    app.toast(message, 'error');
  }

  loadCart();
}());
