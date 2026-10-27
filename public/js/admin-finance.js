'use strict';

(function () {
  const admin = window.Admin;
  if (!admin || !document.body.matches('[data-admin-page="admin-finance"]')) return;

  const filterForm = document.querySelector('[data-finance-filter]');
  const tbody = document.querySelector('[data-finance-tbody]');
  const pagination = document.querySelector('[data-finance-pagination]');
  const countEl = document.querySelector('[data-finance-count]');
  const pageLabel = document.querySelector('[data-finance-page-label]');
  const categoriesEl = document.querySelector('[data-finance-categories]');
  const exportButton = document.querySelector('[data-finance-export]');
  const newButton = document.querySelector('[data-finance-open]');
  const dialog = document.querySelector('[data-finance-dialog]');
  const form = document.querySelector('[data-finance-form]');
  const errorEl = document.querySelector('[data-finance-error]');
  const submit = document.querySelector('[data-finance-submit]');
  const title = document.querySelector('[data-finance-dialog-title]');
  const typeInput = document.querySelector('[data-finance-type-input]');
  const idInput = document.querySelector('[data-finance-id]');
  const amountInput = document.querySelector('#finance-amount');
  const dateInput = document.querySelector('#finance-date');
  const categoryInput = document.querySelector('#finance-category');
  const sourceInput = document.querySelector('#finance-source');
  const methodInput = document.querySelector('#finance-method');
  const descriptionInput = document.querySelector('#finance-description');
  const noteInput = document.querySelector('#finance-note');
  const datalist = document.querySelector('#finance-categories-list');
  const initialQuery = new URLSearchParams(window.location.search);
  let filters = {
    from: initialQuery.get('from') || '',
    to: initialQuery.get('to') || '',
    type: initialQuery.get('type') || '',
    search: initialQuery.get('search') || ''
  };
  let page = 1;
  let entries = new Map();
  let loading = false;
  let lastPeriod = { from: '', to: '' };

  function syncFilterForm() {
    if (!filterForm) return;
    for (const key of Object.keys(filters)) {
      const field = filterForm.elements.namedItem(key);
      if (field) field.value = filters[key];
    }
  }

  function queryParams(includePage = false) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    if (includePage && page > 1) params.set('page', String(page));
    return params;
  }

  function renderSummary(data) {
    const summary = data.summary || {};
    const set = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = admin.money(value);
    };
    set('[data-finance-income]', summary.income);
    set('[data-finance-expense]', summary.expense);
    set('[data-finance-net]', summary.net);
    const netEl = document.querySelector('[data-finance-net]');
    if (netEl) netEl.classList.toggle('is-negative', Number(summary.net) < 0);
  }

  function renderEntries(data) {
    entries = new Map((data.entries || []).map((entry) => [entry.id, entry]));
    if (countEl) countEl.textContent = `(${admin.number(data.total)})`;
    if (pageLabel) {
      const start = data.total ? (data.page - 1) * data.limit + 1 : 0;
      const end = Math.min(data.total, data.page * data.limit);
      pageLabel.textContent = `${admin.number(start)}–${admin.number(end)} dari ${admin.number(data.total)}`;
    }
    if (!Array.isArray(data.entries) || !data.entries.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="admin-empty-cell">Tidak ada transaksi pada filter ini.</td></tr>';
    } else {
      tbody.innerHTML = data.entries.map((entry) => {
        const income = entry.type === 'income';
        return `
          <tr>
            <td>${admin.escapeHTML(admin.date(entry.entryDate))}</td>
            <td><span class="admin-type-badge admin-type-badge--${admin.escapeAttr(entry.type)}">${income ? 'Masuk' : 'Keluar'}</span></td>
            <td><strong>${admin.escapeHTML(entry.description)}</strong>${entry.note ? `<small class="admin-cell-sub">${admin.escapeHTML(entry.note)}</small>` : ''}</td>
            <td>${admin.escapeHTML(entry.source || '—')}<small class="admin-cell-sub">${admin.escapeHTML(entry.paymentMethod || '')}</small></td>
            <td>${entry.orderNumber ? `<a class="admin-order-link" href="${admin.url(`/orders?search=${encodeURIComponent(entry.orderNumber)}`)}">${admin.escapeHTML(entry.orderNumber)}</a>` : '<span class="admin-cell-muted">Manual</span>'}</td>
            <td class="is-right"><strong class="admin-money ${income ? 'is-positive' : 'is-negative'}">${income ? '+' : '−'} ${admin.money(entry.amountIdr)}</strong></td>
            <td class="is-right">${entry.isManual ? `<span class="admin-row-actions"><button class="admin-icon-button" type="button" data-finance-edit="${entry.id}" aria-label="Ubah transaksi">✎</button><button class="admin-icon-button admin-icon-button--danger" type="button" data-finance-delete="${entry.id}" aria-label="Hapus transaksi">×</button></span>` : '<span class="admin-lock-mark" title="Entri otomatis terkunci">⌁</span>'}</td>
          </tr>`;
      }).join('');
    }
    admin.renderPagination(pagination, data.page, data.totalPages, (nextPage) => loadFinance(nextPage));

    if (categoriesEl) {
      const rows = Array.isArray(data.byCategory) ? data.byCategory : [];
      if (!rows.length) {
        categoriesEl.innerHTML = '<p class="admin-empty-text">Belum ada kategori pada periode ini.</p>';
      } else {
        const max = Math.max(1, ...rows.map((row) => Number(row.total || 0)));
        categoriesEl.innerHTML = rows.slice(0, 9).map((row) => `
          <div class="admin-category-row">
            <div><span>${admin.escapeHTML(row.category)}</span><small>${row.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</small></div>
            <strong>${admin.money(row.total)}</strong>
            <span class="admin-category-bar admin-category-bar--${admin.escapeAttr(row.type)}"><i style="width:${Math.max(3, Math.round((row.total / max) * 100))}%"></i></span>
          </div>`).join('');
      }
    }

    if (datalist && Array.isArray(data.categories)) {
      const current = Array.from(datalist.querySelectorAll('option')).map((option) => option.value);
      data.categories.forEach((category) => {
        if (current.includes(category)) return;
        const option = document.createElement('option');
        option.value = category;
        datalist.appendChild(option);
        current.push(category);
      });
    }
  }

  async function loadFinance(nextPage = 1) {
    if (loading) return;
    loading = true;
    page = Math.max(1, Number(nextPage) || 1);
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="admin-empty-cell">Memuat buku kas…</td></tr>';
    const params = queryParams(true);
    const submitButton = filterForm ? filterForm.querySelector('button[type="submit"]') : null;
    admin.setBusy(submitButton, true);
    try {
      const data = await admin.api(`/api/admin/finance?${params.toString()}`);
      lastPeriod = data.period || lastPeriod;
      if (filterForm) {
        const fromField = filterForm.elements.namedItem('from');
        const toField = filterForm.elements.namedItem('to');
        if (fromField && !fromField.value && lastPeriod.from) fromField.value = lastPeriod.from;
        if (toField && !toField.value && lastPeriod.to) toField.value = lastPeriod.to;
      }
      renderSummary(data);
      renderEntries(data);
    } catch (error) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="admin-empty-cell">${admin.escapeHTML(error.message || 'Buku kas tidak dapat dimuat.')}</td></tr>`;
      admin.toast(error.message || 'Buku kas tidak dapat dimuat.', 'error');
    } finally {
      loading = false;
      admin.setBusy(submitButton, false);
    }
  }

  if (filterForm) {
    filterForm.addEventListener('submit', (event) => {
      event.preventDefault();
      filters = {
        from: String(filterForm.elements.namedItem('from')?.value || ''),
        to: String(filterForm.elements.namedItem('to')?.value || ''),
        type: String(filterForm.elements.namedItem('type')?.value || ''),
        search: String(filterForm.elements.namedItem('search')?.value || '').trim()
      };
      loadFinance(1);
    });
  }

  if (exportButton) {
    exportButton.addEventListener('click', () => {
      const params = new URLSearchParams();
      if (filterForm) {
        for (const key of ['from', 'to', 'type', 'search']) {
          const value = String(filterForm.elements.namedItem(key)?.value || '').trim();
          if (value) params.set(key, value);
        }
      }
      window.location.assign(admin.url(`/api/admin/finance/export${params.toString() ? `?${params}` : ''}`));
    });
  }

  /* Dialog --------------------------------------------------------- */

  function setType(type) {
    const safe = type === 'expense' ? 'expense' : 'income';
    if (typeInput) typeInput.value = safe;
    document.querySelectorAll('[data-finance-type]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.financeType === safe);
    });
    const category = safe === 'expense' ? 'Biaya Operasional' : 'Penjualan Manual';
    if (categoryInput && !categoryInput.value) categoryInput.value = category;
  }

  function openCreateDialog(type = 'income') {
    if (!dialog || !form) return;
    form.reset();
    admin.setAlert(errorEl, '');
    if (idInput) idInput.value = '';
    if (title) title.textContent = 'Catat transaksi';
    if (dateInput) dateInput.value = admin.today();
    if (categoryInput) categoryInput.value = '';
    setType(type);
    admin.openDialog(dialog);
    window.setTimeout(() => amountInput?.focus(), 80);
  }

  function openEditDialog(entry) {
    if (!dialog || !form || !entry) return;
    form.reset();
    admin.setAlert(errorEl, '');
    if (idInput) idInput.value = String(entry.id);
    if (title) title.textContent = 'Ubah transaksi';
    setType(entry.type);
    if (amountInput) amountInput.value = String(entry.amountIdr);
    if (dateInput) dateInput.value = entry.entryDate;
    if (categoryInput) categoryInput.value = entry.category || '';
    if (sourceInput) sourceInput.value = entry.source || '';
    if (methodInput) methodInput.value = entry.paymentMethod || '';
    if (descriptionInput) descriptionInput.value = entry.description || '';
    if (noteInput) noteInput.value = entry.note || '';
    admin.openDialog(dialog);
  }

  if (newButton) newButton.addEventListener('click', () => openCreateDialog('income'));
  document.querySelectorAll('[data-finance-type]').forEach((button) => {
    button.addEventListener('click', () => setType(button.dataset.financeType));
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const edit = target.closest('[data-finance-edit]');
    if (edit) {
      const entry = entries.get(Number(edit.dataset.financeEdit));
      if (entry) openEditDialog(entry);
      return;
    }
    const remove = target.closest('[data-finance-delete]');
    if (remove) {
      const entry = entries.get(Number(remove.dataset.financeDelete));
      if (!entry) return;
      if (!window.confirm(`Hapus transaksi "${entry.description}"? Tindakan ini tidak dapat dibatalkan.`)) return;
      admin.setBusy(remove, true);
      admin.api(`/api/admin/finance/${entry.id}`, { method: 'DELETE' })
        .then(() => {
          admin.toast('Transaksi manual dihapus.');
          admin.refreshBadges(true);
          loadFinance(page);
        })
        .catch((error) => admin.toast(error.message || 'Transaksi tidak dapat dihapus.', 'error'))
        .finally(() => admin.setBusy(remove, false));
    }
  });

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const amount = Math.round(Number(amountInput ? amountInput.value : 0));
      const description = descriptionInput ? descriptionInput.value.trim() : '';
      const category = categoryInput ? categoryInput.value.trim() : '';
      const entryDate = dateInput ? dateInput.value : '';
      if (!Number.isFinite(amount) || amount <= 0) {
        admin.setAlert(errorEl, 'Nominal transaksi harus lebih dari nol.', false);
        amountInput?.focus();
        return;
      }
      if (!category) {
        admin.setAlert(errorEl, 'Kategori wajib diisi.', false);
        categoryInput?.focus();
        return;
      }
      if (!description) {
        admin.setAlert(errorEl, 'Deskripsi wajib diisi.', false);
        descriptionInput?.focus();
        return;
      }
      if (!entryDate) {
        admin.setAlert(errorEl, 'Tanggal transaksi wajib diisi.', false);
        dateInput?.focus();
        return;
      }
      const id = idInput ? Number(idInput.value) : 0;
      const payload = {
        type: typeInput ? typeInput.value : 'income',
        amountIdr: amount,
        entryDate,
        category,
        source: sourceInput ? sourceInput.value.trim() : '',
        paymentMethod: methodInput ? methodInput.value.trim() : '',
        description,
        note: noteInput ? noteInput.value.trim() : ''
      };
      admin.setAlert(errorEl, '');
      admin.setBusy(submit, true);
      try {
        if (id) await admin.api(`/api/admin/finance/${id}`, { method: 'PUT', body: payload });
        else await admin.api('/api/admin/finance', { method: 'POST', body: payload });
        admin.toast(id ? 'Transaksi diperbarui.' : 'Transaksi dicatat.');
        admin.closeDialog(dialog);
        admin.refreshBadges(true);
        await loadFinance(id ? page : 1);
      } catch (error) {
        admin.setAlert(errorEl, error.message || 'Transaksi tidak dapat disimpan.', false);
      } finally {
        admin.setBusy(submit, false);
      }
    });
  }

  syncFilterForm();
  loadFinance(1);
  if (initialQuery.get('new') === 'expense' || initialQuery.get('new') === 'income') {
    window.setTimeout(() => openCreateDialog(initialQuery.get('new')), 120);
  }
}());
