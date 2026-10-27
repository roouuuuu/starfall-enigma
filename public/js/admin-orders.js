'use strict';

(function () {
  const admin = window.Admin;
  if (!admin || !document.body.matches('[data-admin-page="admin-orders"]')) return;

  const filterForm = document.querySelector('[data-orders-filter]');
  const tbody = document.querySelector('[data-orders-tbody]');
  const pagination = document.querySelector('[data-orders-pagination]');
  const countEl = document.querySelector('[data-orders-count]');
  const pageLabel = document.querySelector('[data-orders-page-label]');
  const titleEl = document.querySelector('[data-orders-title]');
  const manualDialog = document.querySelector('[data-manual-sale-dialog]');
  const manualForm = document.querySelector('[data-manual-sale-form]');
  const manualLines = document.querySelector('[data-manual-lines]');
  const manualAdd = document.querySelector('[data-manual-add-line]');
  const manualTotal = document.querySelector('[data-manual-total]');
  const manualError = document.querySelector('[data-manual-error]');
  const manualSubmit = document.querySelector('[data-manual-submit]');
  const lineTemplate = document.querySelector('#manual-line-template');
  const orderDialog = document.querySelector('[data-order-dialog]');
  const orderDetail = document.querySelector('[data-order-detail]');
  const orderTitle = document.querySelector('[data-order-dialog-title]');
  const orderSubtitle = document.querySelector('[data-order-dialog-subtitle]');
  const statusSelect = document.querySelector('[data-order-status-select]');
  const statusSave = document.querySelector('[data-order-status-save]');
  const cancelReason = document.querySelector('[data-order-cancel-reason]');
  const cancelButton = document.querySelector('[data-order-cancel]');
  const statusControls = document.querySelector('.admin-order-status-controls');
  const cancelControls = document.querySelector('.admin-order-cancel-controls');

  const initialQuery = new URLSearchParams(window.location.search);
  let filters = {
    search: initialQuery.get('search') || '',
    status: initialQuery.get('status') || '',
    channel: initialQuery.get('channel') || '',
    from: initialQuery.get('from') || '',
    to: initialQuery.get('to') || ''
  };
  let page = 1;
  let totalPages = 1;
  let currentOrderId = null;
  let currentOrder = null;
  let loadingOrders = false;
  let manualCatalog = null;
  let manualLoading = false;

  function syncForm() {
    if (!filterForm) return;
    for (const key of Object.keys(filters)) {
      const field = filterForm.elements.namedItem(key);
      if (field) field.value = filters[key];
    }
  }

  function syncQuery() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    if (page > 1) params.set('page', String(page));
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`);
    } catch (_) { /* noop */ }
  }

  function renderOrders(data) {
    const orders = Array.isArray(data.orders) ? data.orders : [];
    if (!tbody) return;
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="admin-empty-cell">Tidak ada pesanan yang cocok dengan filter ini.</td></tr>';
    } else {
      tbody.innerHTML = orders.map((order) => `
        <tr>
          <td><button class="admin-order-link" type="button" data-order-open="${order.id}">${admin.escapeHTML(order.number)}</button></td>
          <td>${admin.escapeHTML(admin.date(order.createdAt))}<small class="admin-cell-sub">${admin.escapeHTML(admin.time(order.createdAt))}</small></td>
          <td>${admin.escapeHTML(order.customerName || '—')}<small class="admin-cell-sub">${admin.escapeHTML(order.email || '')}</small></td>
          <td>${admin.escapeHTML(admin.channelLabel(order.channel))}</td>
          <td>${admin.statusBadge(order.status)}</td>
          <td>${admin.number(order.units)} <small class="admin-cell-sub">unit</small></td>
          <td class="is-right">${admin.money(order.totalIdr)}</td>
          <td class="is-right"><button class="admin-icon-button" type="button" data-order-open="${order.id}" aria-label="Buka detail ${admin.escapeAttr(order.number)}">↗</button></td>
        </tr>`).join('');
    }
    if (countEl) countEl.textContent = `(${admin.number(data.total)})`;
    if (titleEl) titleEl.textContent = filters.status ? admin.STATUS[filters.status] || 'Pesanan' : 'Semua pesanan';
    if (pageLabel) {
      const start = data.total ? (data.page - 1) * data.limit + 1 : 0;
      const end = Math.min(data.total, data.page * data.limit);
      pageLabel.textContent = `${admin.number(start)}–${admin.number(end)} dari ${admin.number(data.total)}`;
    }
    admin.renderPagination(pagination, data.page, data.totalPages, (nextPage) => loadOrders(nextPage));
  }

  async function loadOrders(nextPage = 1) {
    if (loadingOrders) return;
    loadingOrders = true;
    page = Math.max(1, Number(nextPage) || 1);
    tbody.innerHTML = '<tr><td colspan="8" class="admin-empty-cell">Memuat pesanan…</td></tr>';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    params.set('page', String(page));
    const submit = filterForm ? filterForm.querySelector('button[type="submit"]') : null;
    admin.setBusy(submit, true);
    try {
      const data = await admin.api(`/api/admin/orders?${params.toString()}`);
      totalPages = data.totalPages || 1;
      if (page > totalPages) return loadOrders(totalPages);
      renderOrders(data);
      syncQuery();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="8" class="admin-empty-cell">${admin.escapeHTML(error.message || 'Pesanan tidak dapat dimuat.')}</td></tr>`;
      admin.toast(error.message || 'Pesanan tidak dapat dimuat.', 'error');
    } finally {
      loadingOrders = false;
      admin.setBusy(submit, false);
    }
  }

  if (filterForm) {
    filterForm.addEventListener('submit', (event) => {
      event.preventDefault();
      filters = {
        search: String(filterForm.elements.namedItem('search')?.value || '').trim(),
        status: String(filterForm.elements.namedItem('status')?.value || ''),
        channel: String(filterForm.elements.namedItem('channel')?.value || ''),
        from: String(filterForm.elements.namedItem('from')?.value || ''),
        to: String(filterForm.elements.namedItem('to')?.value || '')
      };
      loadOrders(1);
    });
  }

  /* Order detail -------------------------------------------------------- */

  function renderOrderDetail(order) {
    const address = [
      order.address1,
      order.address2,
      [order.city, order.region, order.postalCode].filter(Boolean).join(', '),
      order.country
    ].filter(Boolean);
    const items = Array.isArray(order.items) ? order.items : [];
    const finance = Array.isArray(order.financeEntries) ? order.financeEntries : [];
    const rate = Number(order.exchangeRate || 0);
    const itemsHtml = items.map((item) => `
      <tr>
        <td><img class="admin-order-thumb" src="${admin.escapeAttr(item.image)}" alt="" loading="lazy"></td>
        <td><strong>${admin.escapeHTML(item.name)}</strong><small class="admin-cell-sub">${admin.escapeHTML(item.label)}</small></td>
        <td>${admin.number(item.quantity)}</td>
        <td class="is-right">${admin.money(Math.round((item.unitPriceUsdCents / 100) * rate))}</td>
        <td class="is-right">${admin.money(Math.round((item.totalUsdCents / 100) * rate))}</td>
      </tr>`).join('');
    const financeHtml = finance.length
      ? `<div class="admin-order-finance">${finance.map((entry) => `
          <div class="admin-order-finance-row">
            <span class="admin-type-badge admin-type-badge--${admin.escapeAttr(entry.type)}">${entry.type === 'income' ? 'Masuk' : 'Keluar'}</span>
            <span>${admin.escapeHTML(entry.category)}<small class="admin-cell-sub">${admin.escapeHTML(admin.date(entry.entryDate))}</small></span>
            <strong>${entry.type === 'expense' ? '−' : '+'} ${admin.money(entry.amountIdr)}</strong>
          </div>`).join('')}</div>`
      : '<p class="admin-empty-text">Belum ada entri keuangan terkait.</p>';

    orderDetail.innerHTML = `
      <div class="admin-order-overview">
        <div class="admin-order-facts">
          <div><span>Status</span>${admin.statusBadge(order.status)}</div>
          <div><span>Kanal</span><strong>${admin.escapeHTML(admin.channelLabel(order.channel))}</strong></div>
          <div><span>Dibuat</span><strong>${admin.escapeHTML(admin.dateTime(order.createdAt))}</strong></div>
          <div><span>Total</span><strong>${admin.money(order.totalIdr)}</strong></div>
        </div>
        <div class="admin-order-sections">
          <section>
            <h3>Pelanggan</h3>
            <p>${admin.escapeHTML(`${order.firstName || ''} ${order.lastName || ''}`.trim())}</p>
            <p>${admin.escapeHTML(order.email || '—')}</p>
            <p>${admin.escapeHTML(order.phone || '—')}</p>
          </section>
          <section>
            <h3>Pengiriman</h3>
            ${address.length ? address.map((line) => `<p>${admin.escapeHTML(line)}</p>`).join('') : '<p>Penjualan manual / tanpa alamat.</p>'}
          </section>
          <section>
            <h3>Pembayaran</h3>
            <p>Demo checkout · ${admin.escapeHTML(order.currency)}</p>
            <p>Subtotal ${admin.money(order.totalIdr + Math.round((order.discountUsdCents / 100) * rate))}</p>
            ${order.discountUsdCents > 0 ? `<p>Diskon ${admin.money(Math.round((order.discountUsdCents / 100) * rate))}${order.promoCode ? ` · ${admin.escapeHTML(order.promoCode)}` : ''}</p>` : ''}
            <p><strong>Total ${admin.money(order.totalIdr)}</strong></p>
          </section>
        </div>
      </div>
      <div class="admin-order-items">
        <h3>Karya dalam pesanan</h3>
        <div class="admin-table-wrap">
          <table class="admin-table admin-table--compact">
            <thead><tr><th></th><th>Karya</th><th>Qty</th><th class="is-right">Harga</th><th class="is-right">Total</th></tr></thead>
            <tbody>${itemsHtml || '<tr><td colspan="5" class="admin-empty-cell">Tidak ada baris.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      ${order.note ? `<section class="admin-order-note"><h3>Catatan</h3><p>${admin.escapeHTML(order.note)}</p></section>` : ''}
      <section class="admin-order-note"><h3>Jejak keuangan</h3>${financeHtml}</section>`;

    if (orderTitle) orderTitle.textContent = order.number;
    if (orderSubtitle) orderSubtitle.textContent = `${admin.channelLabel(order.channel)} · ${admin.dateTime(order.createdAt)}`;
    const cancelled = order.status === 'cancelled';
    if (statusControls) statusControls.hidden = cancelled;
    if (cancelControls) cancelControls.hidden = cancelled;
    if (statusSelect) {
      statusSelect.value = order.status;
      statusSelect.disabled = cancelled;
    }
    if (statusSave) statusSave.disabled = cancelled;
    if (cancelButton) cancelButton.disabled = cancelled;
    if (cancelReason) {
      cancelReason.value = '';
      cancelReason.disabled = cancelled;
    }
  }

  async function openOrder(id) {
    currentOrderId = Number(id);
    currentOrder = null;
    if (!orderDialog || !orderDetail) return;
    if (orderTitle) orderTitle.textContent = 'Pesanan';
    if (orderSubtitle) orderSubtitle.textContent = 'Memuat detail…';
    orderDetail.innerHTML = '<p class="admin-empty-text">Memuat detail pesanan…</p>';
    admin.openDialog(orderDialog);
    try {
      const data = await admin.api(`/api/admin/orders/${currentOrderId}`);
      currentOrder = data.order;
      renderOrderDetail(currentOrder);
    } catch (error) {
      orderDetail.innerHTML = `<p class="admin-empty-text">${admin.escapeHTML(error.message || 'Detail tidak dapat dimuat.')}</p>`;
      admin.toast(error.message || 'Detail pesanan tidak dapat dimuat.', 'error');
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const open = target.closest('[data-order-open]');
    if (open) {
      event.preventDefault();
      openOrder(open.dataset.orderOpen);
    }
  });

  if (statusSave) {
    statusSave.addEventListener('click', async () => {
      if (!currentOrderId || !statusSelect) return;
      const status = statusSelect.value;
      admin.setBusy(statusSave, true);
      try {
        await admin.api(`/api/admin/orders/${currentOrderId}/status`, {
          method: 'PATCH',
          body: { status }
        });
        admin.toast(`Status pesanan diubah menjadi ${admin.STATUS[status] || status}.`);
        await loadOrders(page);
        await openOrder(currentOrderId);
      } catch (error) {
        admin.toast(error.message || 'Status tidak dapat diubah.', 'error');
      } finally {
        admin.setBusy(statusSave, false);
      }
    });
  }

  if (cancelButton) {
    cancelButton.addEventListener('click', async () => {
      if (!currentOrderId) return;
      if (!window.confirm('Batalkan pesanan ini? Stok akan dikembalikan dan pemasukan dibalik.')) return;
      admin.setBusy(cancelButton, true);
      try {
        await admin.api(`/api/admin/orders/${currentOrderId}/status`, {
          method: 'PATCH',
          body: { status: 'cancelled', reason: cancelReason ? cancelReason.value.trim() : '' }
        });
        admin.toast('Pesanan dibatalkan. Stok dan buku kas telah disesuaikan.');
        await loadOrders(page);
        await openOrder(currentOrderId);
        admin.refreshBadges(true);
      } catch (error) {
        admin.toast(error.message || 'Pesanan tidak dapat dibatalkan.', 'error');
      } finally {
        admin.setBusy(cancelButton, false);
      }
    });
  }

  /* Manual sale --------------------------------------------------------- */

  function variantRetailIdr(product, variant) {
    if (!product || !variant || !manualCatalog) return 0;
    return Math.round(((Number(product.priceCents) + Number(variant.priceCents)) / 100) * Number(manualCatalog.exchangeRate || 0));
  }

  function updateManualTotal() {
    if (!manualLines || !manualTotal) return;
    let total = 0;
    manualLines.querySelectorAll('[data-manual-line]').forEach((line) => {
      const qty = Math.max(0, Number.parseInt(line.querySelector('[data-manual-qty]')?.value, 10) || 0);
      const price = Math.max(0, Number(line.querySelector('[data-manual-price]')?.value) || 0);
      total += qty * price;
      const lineTotal = line.querySelector('[data-manual-line-total]');
      if (lineTotal) lineTotal.textContent = admin.money(qty * price);
    });
    manualTotal.textContent = admin.money(total);
  }

  function updateLineStock(line) {
    if (!line || !manualCatalog) return;
    const productSelect = line.querySelector('[data-manual-product]');
    const variantSelect = line.querySelector('[data-manual-variant]');
    const stock = line.querySelector('[data-manual-stock]');
    const product = manualCatalog.products.find((item) => item.id === Number(productSelect?.value));
    const variant = product ? product.variants.find((item) => item.id === Number(variantSelect?.value)) : null;
    if (stock) {
      if (!variant) stock.textContent = 'Tidak ada varian dengan stok tersedia.';
      else stock.textContent = `Stok tersedia: ${admin.number(variant.stock)} · ${variant.sku}`;
      stock.classList.toggle('is-empty', !variant || variant.stock === 0);
    }
    if (variant) {
      const qty = line.querySelector('[data-manual-qty]');
      if (qty) qty.max = String(Math.max(1, variant.stock));
    }
  }

  function populateVariants(line, keepPrice = false) {
    const productSelect = line.querySelector('[data-manual-product]');
    const variantSelect = line.querySelector('[data-manual-variant]');
    const priceInput = line.querySelector('[data-manual-price]');
    if (!manualCatalog || !productSelect || !variantSelect) return;
    const product = manualCatalog.products.find((item) => item.id === Number(productSelect.value));
    const available = product ? product.variants.filter((variant) => variant.stock > 0) : [];
    variantSelect.innerHTML = available.length
      ? available.map((variant) => `<option value="${variant.id}">${admin.escapeHTML(variant.label)} · stok ${admin.number(variant.stock)}</option>`).join('')
      : '<option value="">Tidak ada stok</option>';
    variantSelect.disabled = !available.length;
    if (available.length && priceInput && !keepPrice) {
      priceInput.value = String(variantRetailIdr(product, available[0]));
    }
    updateLineStock(line);
    updateManualTotal();
  }

  function bindLine(line) {
    const productSelect = line.querySelector('[data-manual-product]');
    const variantSelect = line.querySelector('[data-manual-variant]');
    const qty = line.querySelector('[data-manual-qty]');
    const price = line.querySelector('[data-manual-price]');
    const remove = line.querySelector('[data-manual-remove]');
    productSelect?.addEventListener('change', () => populateVariants(line));
    variantSelect?.addEventListener('change', () => {
      if (!manualCatalog) return;
      const product = manualCatalog.products.find((item) => item.id === Number(productSelect.value));
      const variant = product?.variants.find((item) => item.id === Number(variantSelect.value));
      if (price) price.value = String(variantRetailIdr(product, variant));
      updateLineStock(line);
      updateManualTotal();
    });
    qty?.addEventListener('input', () => {
      const max = Number(qty.max) || 20;
      if (Number(qty.value) > max) qty.value = String(max);
      if (Number(qty.value) < 1) qty.value = '1';
      updateManualTotal();
    });
    price?.addEventListener('input', updateManualTotal);
    remove?.addEventListener('click', () => {
      line.remove();
      updateManualTotal();
    });
  }

  function addManualLine() {
    if (!manualCatalog || !manualLines || !lineTemplate) return;
    const fragment = lineTemplate.content.cloneNode(true);
    const line = fragment.querySelector('[data-manual-line]');
    const productSelect = line.querySelector('[data-manual-product]');
    if (!productSelect) return;
    productSelect.innerHTML = manualCatalog.products.map((product) => {
      const hasStock = product.variants.some((variant) => variant.stock > 0);
      return `<option value="${product.id}"${hasStock ? '' : ' disabled'}>${admin.escapeHTML(product.name)}${hasStock ? '' : ' — habis'}</option>`;
    }).join('');
    const firstAvailable = manualCatalog.products.find((product) => product.variants.some((variant) => variant.stock > 0));
    if (firstAvailable) productSelect.value = String(firstAvailable.id);
    manualLines.appendChild(fragment);
    bindLine(line);
    populateVariants(line);
  }

  async function ensureManualCatalog() {
    if (manualCatalog || manualLoading) return;
    manualLoading = true;
    if (manualLines) manualLines.innerHTML = '<p class="admin-empty-text">Memuat katalog…</p>';
    try {
      manualCatalog = await admin.getCatalog();
    } catch (error) {
      if (manualLines) manualLines.innerHTML = `<p class="admin-empty-text">${admin.escapeHTML(error.message || 'Katalog tidak dapat dimuat.')}</p>`;
      admin.toast(error.message || 'Katalog tidak dapat dimuat.', 'error');
    } finally {
      manualLoading = false;
    }
  }

  async function openManualSale() {
    if (!manualDialog || !manualForm) return;
    manualForm.reset();
    admin.setAlert(manualError, '');
    if (manualLines) manualLines.innerHTML = '';
    if (manualTotal) manualTotal.textContent = admin.money(0);
    admin.openDialog(manualDialog);
    await ensureManualCatalog();
    if (manualCatalog && manualLines) {
      manualLines.innerHTML = '';
      addManualLine();
    }
  }

  document.querySelectorAll('[data-manual-sale-open]').forEach((button) => {
    button.addEventListener('click', () => openManualSale());
  });

  if (manualAdd) manualAdd.addEventListener('click', () => addManualLine());
  if (manualLines) manualLines.addEventListener('input', updateManualTotal);

  if (manualForm) {
    manualForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!manualCatalog) {
        admin.setAlert(manualError, 'Katalog belum siap.', false);
        return;
      }
      const data = new FormData(manualForm);
      const customerName = String(data.get('customerName') || '').trim();
      if (!customerName) {
        admin.setAlert(manualError, 'Nama pelanggan wajib diisi.', false);
        return;
      }
      const lines = Array.from(manualLines ? manualLines.querySelectorAll('[data-manual-line]') : []);
      if (!lines.length) {
        admin.setAlert(manualError, 'Tambahkan minimal satu karya.', false);
        return;
      }
      const items = [];
      const seen = new Set();
      for (const line of lines) {
        const productSelect = line.querySelector('[data-manual-product]');
        const variantSelect = line.querySelector('[data-manual-variant]');
        const variantId = Number(variantSelect?.value);
        const quantity = Math.max(1, Number.parseInt(line.querySelector('[data-manual-qty]')?.value, 10) || 0);
        const unitPriceIdr = Math.max(0, Math.round(Number(line.querySelector('[data-manual-price]')?.value) || 0));
        if (!Number.isInteger(variantId) || variantId <= 0) {
          admin.setAlert(manualError, 'Setiap baris membutuhkan varian dengan stok tersedia.', false);
          return;
        }
        if (seen.has(variantId)) {
          admin.setAlert(manualError, 'Varian yang sama muncul lebih dari sekali. Gunakan satu baris per varian.', false);
          return;
        }
        seen.add(variantId);
        if (!quantity || quantity <= 0) {
          admin.setAlert(manualError, 'Jumlah setiap baris minimal 1.', false);
          return;
        }
        const product = manualCatalog.products.find((item) => item.id === Number(productSelect?.value));
        const variant = product?.variants.find((item) => item.id === variantId);
        if (!variant || variant.stock < quantity) {
          admin.setAlert(manualError, `Stok ${product?.name || 'karya'} tidak mencukupi.`, false);
          return;
        }
        if (unitPriceIdr <= 0) {
          admin.setAlert(manualError, 'Harga satuan harus lebih dari nol.', false);
          return;
        }
        items.push({ variantId, quantity, unitPriceIdr });
      }
      const reference = String(data.get('reference') || '').trim();
      const note = String(data.get('note') || '').trim();
      const payload = {
        customerName,
        customerEmail: String(data.get('email') || '').trim(),
        channel: String(data.get('channel') || ''),
        items,
        note: reference ? `${reference}${note ? ` · ${note}` : ''}` : note
      };
      admin.setAlert(manualError, '');
      admin.setBusy(manualSubmit, true);
      try {
        const response = await admin.api('/api/admin/orders/manual', { method: 'POST', body: payload });
        admin.toast(`Penjualan ${response.orderNumber} tersimpan (${admin.money(response.totalIdr)}).`);
        admin.closeDialog(manualDialog);
        admin.refreshBadges(true);
        currentOrderId = response.id;
        await loadOrders(1);
        if (currentOrderId) openOrder(currentOrderId);
      } catch (error) {
        admin.setAlert(manualError, error.message || 'Penjualan manual tidak dapat disimpan.', false);
      } finally {
        admin.setBusy(manualSubmit, false);
      }
    });
  }

  /* Init ---------------------------------------------------------------- */

  syncForm();
  loadOrders(Number(initialQuery.get('page')) || 1);
  if (initialQuery.get('manual') === '1') {
    window.setTimeout(openManualSale, 80);
  }
}());
