'use strict';

(function () {
  const admin = window.Admin;
  if (!admin || !document.body.matches('[data-admin-page="admin-customers"]')) return;

  const form = document.querySelector('[data-customers-filter]');
  const tbody = document.querySelector('[data-customers-tbody]');
  const pagination = document.querySelector('[data-customers-pagination]');
  const countEl = document.querySelector('[data-customers-count]');
  const pageLabel = document.querySelector('[data-customers-page-label]');
  const subscribersEl = document.querySelector('[data-subscribers]');
  const subscribersTotal = document.querySelector('[data-subscribers-total]');
  const initialQuery = new URLSearchParams(window.location.search);
  let search = initialQuery.get('search') || '';
  let page = 1;
  let loading = false;

  function render(data) {
    const customers = Array.isArray(data.customers) ? data.customers : [];
    const stats = data.stats || {};
    const set = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = admin.number(value);
    };
    set('[data-customers-total]', stats.total);
    set('[data-customers-repeat]', stats.repeat);
    set('[data-customers-subscribers]', stats.subscribers);
    if (countEl) countEl.textContent = `(${admin.number(data.total)})`;
    if (pageLabel) {
      const start = data.total ? (data.page - 1) * data.limit + 1 : 0;
      const end = Math.min(data.total, data.page * data.limit);
      pageLabel.textContent = `${admin.number(start)}–${admin.number(end)} dari ${admin.number(data.total)}`;
    }
    if (!customers.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="admin-empty-cell">Tidak ada pelanggan yang cocok.</td></tr>';
    } else {
      tbody.innerHTML = customers.map((customer) => {
        const name = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Pelanggan';
        const orderSearch = encodeURIComponent(customer.email || '');
        return `
          <tr>
            <td><div class="admin-customer-cell"><span class="admin-avatar admin-avatar--small">${admin.escapeHTML(admin.initials(customer.firstName, customer.lastName))}</span><strong>${admin.escapeHTML(name)}</strong></div></td>
            <td><a class="admin-email-link" href="mailto:${admin.escapeAttr(customer.email || '')}">${admin.escapeHTML(customer.email || '—')}</a><small class="admin-cell-sub">${admin.escapeHTML(customer.phone || 'Tanpa telepon')}</small></td>
            <td>${admin.escapeHTML(admin.date(customer.createdAt))}</td>
            <td>${customer.orderCount ? `<a class="admin-order-link" href="/admin/orders?search=${orderSearch}">${admin.number(customer.orderCount)} pesanan</a>` : '<span class="admin-cell-muted">Belum ada</span>'}</td>
            <td class="is-right"><strong>${admin.money(customer.spend)}</strong></td>
            <td>${customer.lastOrder ? admin.escapeHTML(admin.dateTime(customer.lastOrder)) : '<span class="admin-cell-muted">—</span>'}</td>
            <td class="is-right"><a class="admin-icon-button" href="/admin/orders?search=${orderSearch}" aria-label="Lihat pesanan ${admin.escapeAttr(name)}">↗</a></td>
          </tr>`;
      }).join('');
    }
    admin.renderPagination(pagination, data.page, data.totalPages, (nextPage) => loadCustomers(nextPage));

    if (subscribersEl) {
      const subscribers = Array.isArray(data.subscribers) ? data.subscribers : [];
      subscribersEl.innerHTML = subscribers.length
        ? subscribers.map((subscriber) => `
            <div class="admin-subscriber-row">
              <div><strong>${admin.escapeHTML(subscriber.email)}</strong><small>${subscriber.locale === 'id' ? 'Bahasa Indonesia' : 'English'} · ${admin.escapeHTML(admin.date(subscriber.createdAt))}</small></div>
              <span class="admin-type-badge admin-type-badge--neutral">Surat</span>
            </div>`).join('')
        : '<p class="admin-empty-text">Belum ada surat terdaftar.</p>';
    }
    if (subscribersTotal) subscribersTotal.textContent = admin.number(stats.subscribers);
  }

  async function loadCustomers(nextPage = 1) {
    if (loading) return;
    loading = true;
    page = Math.max(1, Number(nextPage) || 1);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="admin-empty-cell">Memuat pelanggan…</td></tr>';
    const button = form ? form.querySelector('button[type="submit"]') : null;
    admin.setBusy(button, true);
    try {
      const data = await admin.api(`/api/admin/customers?${params.toString()}`);
      render(data);
      try {
        const url = new URL(window.location.href);
        if (search) url.searchParams.set('search', search);
        else url.searchParams.delete('search');
        if (page > 1) url.searchParams.set('page', String(page));
        else url.searchParams.delete('page');
        window.history.replaceState(null, '', `${url.pathname}${url.search}`);
      } catch (_) { /* noop */ }
    } catch (error) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="admin-empty-cell">${admin.escapeHTML(error.message || 'Pelanggan tidak dapat dimuat.')}</td></tr>`;
      admin.toast(error.message || 'Pelanggan tidak dapat dimuat.', 'error');
    } finally {
      loading = false;
      admin.setBusy(button, false);
    }
  }

  if (form) {
    const searchInput = form.elements.namedItem('search');
    if (searchInput) searchInput.value = search;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      search = String(form.elements.namedItem('search')?.value || '').trim();
      loadCustomers(1);
    });
  }

  loadCustomers(Number(initialQuery.get('page')) || 1);
}());
