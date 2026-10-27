'use strict';

(function () {
  const admin = window.Admin;
  if (!admin || !document.body.matches('[data-admin-page="admin-inventory"]')) return;

  const inventoryForm = document.querySelector('[data-inventory-filter]');
  const movementsForm = document.querySelector('[data-movements-filter]');
  const inventoryBody = document.querySelector('[data-inventory-tbody]');
  const movementsBody = document.querySelector('[data-movements-tbody]');
  const inventoryPagination = document.querySelector('[data-inventory-pagination]');
  const movementsPagination = document.querySelector('[data-movements-pagination]');
  const inventoryCount = document.querySelector('[data-inventory-count]');
  const inventoryPageLabel = document.querySelector('[data-inventory-page-label]');
  const stockDialog = document.querySelector('[data-stock-dialog]');
  const stockForm = document.querySelector('[data-stock-form]');
  const stockError = document.querySelector('[data-stock-error]');
  const stockSubmit = document.querySelector('[data-stock-submit]');
  const stockActionInput = document.querySelector('[data-stock-action-input]');
  const stockVariantInput = document.querySelector('[data-stock-variant-id]');
  const stockQuantity = stockDialog ? stockDialog.querySelector('input[name="quantity"]') : null;
  const stockQtyLabel = document.querySelector('[data-stock-qty-label]');
  const stockSupplier = stockDialog ? stockDialog.querySelector('input[name="supplier"]') : null;
  const stockCost = stockDialog ? stockDialog.querySelector('input[name="unitCostIdr"]') : null;
  const stockNote = stockDialog ? stockDialog.querySelector('textarea[name="note"]') : null;
  const stockExpense = stockDialog ? stockDialog.querySelector('input[name="recordExpense"]') : null;
  const stockCostField = document.querySelector('[data-stock-cost-field]');
  const stockExpenseField = document.querySelector('[data-stock-expense-field]');
  const stockProduct = document.querySelector('[data-stock-product]');
  const stockMeta = document.querySelector('[data-stock-meta]');
  const stockCurrent = document.querySelector('[data-stock-current]');
  const stockThreshold = document.querySelector('[data-stock-threshold]');
  const stockSku = document.querySelector('[data-stock-sku]');

  const initialQuery = new URLSearchParams(window.location.search);
  let inventoryFilters = {
    search: initialQuery.get('search') || '',
    filter: initialQuery.get('filter') || 'all'
  };
  let movementFilters = { search: '', type: '' };
  let inventoryPage = 1;
  let movementPage = 1;
  let activeVariant = null;
  let inventoryMap = new Map();
  let stockLoading = false;

  function usd(cents) {
    const amount = Number(cents || 0) / 100;
    return `US$ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)}`;
  }

  function syncInventoryForm() {
    if (!inventoryForm) return;
    const search = inventoryForm.elements.namedItem('search');
    const filter = inventoryForm.elements.namedItem('filter');
    if (search) search.value = inventoryFilters.search;
    if (filter) filter.value = ['all', 'low', 'out'].includes(inventoryFilters.filter) ? inventoryFilters.filter : 'all';
  }

  function syncMovementForm() {
    if (!movementsForm) return;
    const search = movementsForm.elements.namedItem('search');
    const type = movementsForm.elements.namedItem('type');
    if (search) search.value = movementFilters.search;
    if (type) type.value = movementFilters.type;
  }

  function stockState(stock, threshold) {
    if (stock <= 0) return { id: 'out', label: 'Habis' };
    if (stock <= threshold) return { id: 'low', label: 'Menipis' };
    return { id: 'in', label: 'Aman' };
  }

  function renderSummary(data) {
    const summary = data.summary || {};
    const text = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = admin.number(value);
    };
    text('[data-inventory-variants]', summary.variants);
    text('[data-inventory-units]', summary.units);
    text('[data-inventory-low]', summary.low);
    text('[data-inventory-out]', summary.out);
    admin.updateBadges({ lowStock: summary.low });
  }

  function renderInventory(data) {
    const items = Array.isArray(data.items) ? data.items : [];
    inventoryMap = new Map(items.map((item) => [item.variantId, item]));
    if (inventoryCount) inventoryCount.textContent = `(${admin.number(data.total)})`;
    if (inventoryPageLabel) {
      const start = data.total ? (data.page - 1) * data.limit + 1 : 0;
      const end = Math.min(data.total, data.page * data.limit);
      inventoryPageLabel.textContent = `${admin.number(start)}–${admin.number(end)} dari ${admin.number(data.total)} varian`;
    }
    if (!items.length) {
      inventoryBody.innerHTML = '<tr><td colspan="8" class="admin-empty-cell">Tidak ada varian yang cocok.</td></tr>';
    } else {
      inventoryBody.innerHTML = items.map((item) => {
        const state = stockState(item.stock, item.threshold);
        return `
          <tr>
            <td><div class="admin-product-cell"><img src="${admin.escapeAttr(item.image)}" alt="" loading="lazy"><div><strong>${admin.escapeHTML(item.name)}</strong><small>${admin.escapeHTML(item.category || '')}</small></div></div></td>
            <td class="admin-mono">${admin.escapeHTML(item.sku)}</td>
            <td>${admin.escapeHTML(item.label)}</td>
            <td><strong class="admin-stock-count is-${state.id}">${admin.number(item.stock)}</strong></td>
            <td>${admin.number(item.threshold)}</td>
            <td><span class="admin-status admin-status--stock-${state.id}">${state.label}</span></td>
            <td>${usd(item.priceCents)}</td>
            <td class="is-right"><button class="admin-button admin-button--small" type="button" data-stock-open="${item.variantId}">Sesuaikan</button></td>
          </tr>`;
      }).join('');
    }
    admin.renderPagination(inventoryPagination, data.page, data.totalPages, (nextPage) => loadInventory(nextPage));
    renderSummary(data);
  }

  async function loadInventory(nextPage = 1) {
    inventoryPage = Math.max(1, Number(nextPage) || 1);
    const params = new URLSearchParams();
    if (inventoryFilters.search) params.set('search', inventoryFilters.search);
    if (inventoryFilters.filter && inventoryFilters.filter !== 'all') params.set('filter', inventoryFilters.filter);
    params.set('page', String(inventoryPage));
    if (inventoryBody) inventoryBody.innerHTML = '<tr><td colspan="8" class="admin-empty-cell">Memuat stok…</td></tr>';
    try {
      const data = await admin.api(`/api/admin/inventory?${params.toString()}`);
      renderInventory(data);
    } catch (error) {
      if (inventoryBody) inventoryBody.innerHTML = `<tr><td colspan="8" class="admin-empty-cell">${admin.escapeHTML(error.message || 'Stok tidak dapat dimuat.')}</td></tr>`;
      admin.toast(error.message || 'Stok tidak dapat dimuat.', 'error');
    }
  }

  function renderMovements(data) {
    const movements = Array.isArray(data.movements) ? data.movements : [];
    if (!movements.length) {
      movementsBody.innerHTML = '<tr><td colspan="7" class="admin-empty-cell">Belum ada pergerakan stok.</td></tr>';
    } else {
      movementsBody.innerHTML = movements.map((movement) => {
        const positive = Number(movement.qtyChange) > 0;
        const movementType = ['opening', 'in', 'sale', 'return', 'adjustment'].includes(movement.type) ? movement.type : 'adjustment';
        return `
          <tr>
            <td>${admin.escapeHTML(admin.date(movement.createdAt))}<small class="admin-cell-sub">${admin.escapeHTML(admin.time(movement.createdAt))}</small></td>
            <td><strong>${admin.escapeHTML(movement.name)}</strong><small class="admin-cell-sub">${admin.escapeHTML(movement.label)} · ${admin.escapeHTML(movement.sku)}</small></td>
            <td><span class="admin-type-badge admin-type-badge--${movementType}">${admin.escapeHTML(admin.movementLabel(movement.type))}</span></td>
            <td><strong class="admin-qty-change ${positive ? 'is-positive' : 'is-negative'}">${positive ? '+' : ''}${admin.number(movement.qtyChange)}</strong></td>
            <td>${admin.number(movement.stockAfter)}</td>
            <td>${admin.escapeHTML(movement.reference || '—')}${movement.supplier ? `<small class="admin-cell-sub">${admin.escapeHTML(movement.supplier)}</small>` : ''}${movement.note ? `<small class="admin-cell-sub">${admin.escapeHTML(movement.note)}</small>` : ''}</td>
            <td>${admin.escapeHTML(movement.createdBy || 'Sistem')}</td>
          </tr>`;
      }).join('');
    }
    admin.renderPagination(movementsPagination, data.page, data.totalPages, (nextPage) => loadMovements(nextPage));
  }

  async function loadMovements(nextPage = 1) {
    movementPage = Math.max(1, Number(nextPage) || 1);
    const params = new URLSearchParams();
    if (movementFilters.search) params.set('search', movementFilters.search);
    if (movementFilters.type) params.set('type', movementFilters.type);
    params.set('page', String(movementPage));
    if (movementsBody) movementsBody.innerHTML = '<tr><td colspan="7" class="admin-empty-cell">Memuat pergerakan…</td></tr>';
    try {
      const data = await admin.api(`/api/admin/inventory/movements?${params.toString()}`);
      renderMovements(data);
    } catch (error) {
      if (movementsBody) movementsBody.innerHTML = `<tr><td colspan="7" class="admin-empty-cell">${admin.escapeHTML(error.message || 'Pergerakan stok tidak dapat dimuat.')}</td></tr>`;
      admin.toast(error.message || 'Pergerakan stok tidak dapat dimuat.', 'error');
    }
  }

  if (inventoryForm) {
    inventoryForm.addEventListener('submit', (event) => {
      event.preventDefault();
      inventoryFilters = {
        search: String(inventoryForm.elements.namedItem('search')?.value || '').trim(),
        filter: String(inventoryForm.elements.namedItem('filter')?.value || 'all')
      };
      loadInventory(1);
    });
  }

  if (movementsForm) {
    movementsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      movementFilters = {
        search: String(movementsForm.elements.namedItem('search')?.value || '').trim(),
        type: String(movementsForm.elements.namedItem('type')?.value || '')
      };
      loadMovements(1);
    });
  }

  /* Stock dialog -------------------------------------------------------- */

  function setStockAction(action) {
    const nextAction = action === 'set' ? 'set' : 'receive';
    if (stockActionInput) stockActionInput.value = nextAction;
    document.querySelectorAll('[data-stock-action]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.stockAction === nextAction);
    });
    if (stockQtyLabel) stockQtyLabel.textContent = nextAction === 'set' ? 'Stok baru' : 'Jumlah diterima';
    if (stockQuantity) {
      stockQuantity.min = nextAction === 'set' ? '0' : '1';
      if (nextAction === 'set' && activeVariant) stockQuantity.value = String(activeVariant.stock);
      else if (nextAction === 'receive') stockQuantity.value = '1';
    }
    if (stockCostField) stockCostField.hidden = nextAction !== 'receive';
    if (stockExpenseField) stockExpenseField.hidden = nextAction !== 'receive';
    if (stockExpense && nextAction !== 'receive') stockExpense.checked = false;
  }

  function openStock(id) {
    const item = inventoryMap.get(Number(id));
    if (!item || !stockDialog || !stockForm) return;
    activeVariant = item;
    admin.setAlert(stockError, '');
    stockForm.reset();
    if (stockVariantInput) stockVariantInput.value = String(item.variantId);
    if (stockProduct) stockProduct.textContent = item.name;
    if (stockMeta) stockMeta.textContent = `${item.label} · ${item.sku}`;
    if (stockCurrent) stockCurrent.textContent = admin.number(item.stock);
    if (stockThreshold) stockThreshold.textContent = admin.number(item.threshold);
    if (stockSku) stockSku.textContent = item.sku;
    if (stockSupplier) stockSupplier.value = '';
    if (stockCost) stockCost.value = '';
    if (stockNote) stockNote.value = '';
    if (stockExpense) stockExpense.checked = false;
    setStockAction('receive');
    admin.openDialog(stockDialog);
    window.setTimeout(() => stockQuantity?.focus(), 80);
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('[data-stock-open]');
    if (button) {
      event.preventDefault();
      openStock(button.dataset.stockOpen);
      return;
    }
    const action = target.closest('[data-stock-action]');
    if (action) {
      event.preventDefault();
      setStockAction(action.dataset.stockAction);
    }
  });

  if (stockForm) {
    stockForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (stockLoading || !activeVariant) return;
      const quantity = Math.round(Number(stockQuantity ? stockQuantity.value : 0));
      const action = stockActionInput ? stockActionInput.value : 'receive';
      if (action === 'receive' && (!Number.isFinite(quantity) || quantity < 1)) {
        admin.setAlert(stockError, 'Jumlah stok masuk minimal 1.', false);
        return;
      }
      if (action === 'set' && (!Number.isInteger(quantity) || quantity < 0)) {
        admin.setAlert(stockError, 'Stok baru tidak valid.', false);
        return;
      }
      const recordExpense = Boolean(stockExpense && stockExpense.checked);
      const unitCostIdr = Math.max(0, Number(stockCost ? stockCost.value : 0) || 0);
      if (recordExpense && (!unitCostIdr || unitCostIdr <= 0)) {
        admin.setAlert(stockError, 'Isi biaya satuan untuk mencatat pengeluaran pembelian.', false);
        return;
      }
      admin.setAlert(stockError, '');
      stockLoading = true;
      admin.setBusy(stockSubmit, true);
      try {
        const data = await admin.api('/api/admin/inventory/stock', {
          method: 'POST',
          body: {
            variantId: activeVariant.variantId,
            action,
            quantity,
            supplier: stockSupplier ? stockSupplier.value.trim() : '',
            unitCostIdr,
            recordExpense,
            note: stockNote ? stockNote.value.trim() : ''
          }
        });
        const note = data.financeAmount > 0
          ? ` Stok menjadi ${data.newStock}; pengeluaran ${admin.money(data.financeAmount)} dicatat.`
          : ` Stok baru: ${data.newStock}.`;
        admin.toast(`Stok ${activeVariant.name} diperbarui.${note}`);
        admin.closeDialog(stockDialog);
        admin.refreshBadges(true);
        await Promise.all([loadInventory(inventoryPage), loadMovements(1)]);
      } catch (error) {
        admin.setAlert(stockError, error.message || 'Stok tidak dapat diperbarui.', false);
      } finally {
        stockLoading = false;
        admin.setBusy(stockSubmit, false);
      }
    });
  }

  syncInventoryForm();
  syncMovementForm();
  loadInventory(1);
  loadMovements(1);
}());
