'use strict';

(function () {
  const admin = window.Admin;
  if (!admin || !document.body.matches('[data-admin-page="admin-dashboard"]')) return;

  const rangeForm = document.querySelector('[data-dashboard-range]');
  const fromInput = document.querySelector('#dashboard-from');
  const toInput = document.querySelector('#dashboard-to');
  const updated = document.querySelector('[data-dashboard-updated]');
  const refresh = document.querySelector('[data-dashboard-refresh]');
  const chart = document.querySelector('[data-finance-chart]');
  const statusList = document.querySelector('[data-status-list]');
  const statusTotal = document.querySelector('[data-status-total]');
  const recentOrders = document.querySelector('[data-recent-orders]');
  const lowStockList = document.querySelector('[data-low-stock-list]');
  const channelList = document.querySelector('[data-channel-list]');
  let loading = false;

  function text(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value == null ? '—' : String(value);
  }

  function shortDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00+07:00`);
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date);
  }

  function periodLabel(period) {
    if (!period) return 'Periode';
    return `${shortDate(period.from)} — ${shortDate(period.to)}`;
  }

  function renderSummary(data) {
    const summary = data.summary || {};
    text('[data-kpi-income]', admin.money(summary.income));
    text('[data-kpi-expense]', admin.money(summary.expense));
    text('[data-kpi-net]', admin.money(summary.net));
    const netEl = document.querySelector('[data-kpi-net]');
    if (netEl) netEl.classList.toggle('is-negative', Number(summary.net) < 0);
    text('[data-kpi-orders]', admin.number(summary.orderCount));
    text('[data-kpi-paid]', admin.number(summary.paidOrders));
    text('[data-kpi-units]', admin.number(summary.unitsSold));
    text('[data-kpi-open]', admin.number(summary.openOrders));
    text('[data-kpi-low]', admin.number(summary.lowStock));
    text('[data-kpi-out]', admin.number(summary.outOfStock));
    text('[data-kpi-customers]', admin.number(summary.customers));
    text('[data-kpi-subscribers]', admin.number(summary.subscribers));
    text('[data-kpi-social]', admin.number(summary.socialClicks));
    text('[data-kpi-stock]', admin.number(summary.stockUnits));
    text('[data-kpi-variants]', admin.number(summary.variants));
    text('[data-kpi-period]', periodLabel(data.period));
    admin.updateBadges(summary);
  }

  function renderStatus(data) {
    if (!statusList) return;
    const counts = data.statusCounts || {};
    const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
    const order = ['paid', 'processing', 'shipped', 'completed', 'cancelled'];
    const max = Math.max(1, ...order.map((status) => Number(counts[status] || 0)));
    statusList.innerHTML = order.map((status) => {
      const count = Number(counts[status] || 0);
      const width = Math.max(4, Math.round((count / max) * 100));
      return `<a class="admin-status-row" href="${admin.url(`/orders?status=${status}`)}">
        <span class="admin-status-dot admin-status-dot--${admin.escapeAttr(status)}"></span>
        <span class="admin-status-name">${admin.escapeHTML(admin.STATUS[status])}</span>
        <span class="admin-status-bar"><i style="width:${width}%"></i></span>
        <strong>${admin.number(count)}</strong>
      </a>`;
    }).join('');
    if (statusTotal) statusTotal.textContent = admin.number(total);
  }

  function renderChart(data) {
    const rows = Array.isArray(data.chart) ? data.chart : [];
    admin.renderChart(chart, {
      title: 'Arus kas 14 hari terakhir',
      labels: rows.map((row) => {
        const date = new Date(`${row.date}T12:00:00+07:00`);
        return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit' }).format(date);
      }),
      series: [
        { name: 'Pemasukan', values: rows.map((row) => Number(row.income || 0)), type: 'bar' },
        { name: 'Pengeluaran', values: rows.map((row) => Number(row.expense || 0)), type: 'bar' },
        { name: 'Bersih', values: rows.map((row) => Number(row.net || 0)), type: 'line' }
      ],
      footnote: 'IDR · arus kas aktual'
    });
  }

  function renderRecent(orders) {
    if (!recentOrders) return;
    if (!orders || !orders.length) {
      recentOrders.innerHTML = '<tr><td colspan="5" class="admin-empty-cell">Belum ada pesanan.</td></tr>';
      return;
    }
    recentOrders.innerHTML = orders.map((order) => `
      <tr>
        <td><a class="admin-order-link" href="${admin.url(`/orders?search=${encodeURIComponent(order.number)}`)}">${admin.escapeHTML(order.number)}</a><small class="admin-cell-sub">${admin.escapeHTML(admin.date(order.createdAt))}</small></td>
        <td>${admin.escapeHTML(order.customerName || order.email || '—')}<small class="admin-cell-sub">${admin.escapeHTML(order.email || '')}</small></td>
        <td>${admin.escapeHTML(admin.channelLabel(order.channel))}</td>
        <td>${admin.statusBadge(order.status)}</td>
        <td class="is-right">${admin.money(order.totalIdr)}</td>
      </tr>`).join('');
  }

  function renderLowStock(items) {
    if (!lowStockList) return;
    if (!items || !items.length) {
      lowStockList.innerHTML = '<p class="admin-empty-text">Semua varian berada di atas ambang.</p>';
      return;
    }
    lowStockList.innerHTML = items.map((item) => `
      <a class="admin-low-row" href="${admin.url(`/inventory?search=${encodeURIComponent(item.sku || '')}`)}">
        <img src="${admin.escapeAttr(item.image)}" alt="" loading="lazy">
        <span class="admin-low-copy">
          <strong>${admin.escapeHTML(item.name)}</strong>
          <small>${admin.escapeHTML(item.label)} · ${admin.escapeHTML(item.sku)}</small>
        </span>
        <span class="admin-low-count ${item.stock === 0 ? 'is-out' : ''}">${admin.number(item.stock)}</span>
      </a>`).join('');
  }

  function renderChannels(channels) {
    if (!channelList) return;
    if (!channels || !channels.length) {
      channelList.innerHTML = '<p class="admin-empty-text">Belum ada penjualan pada periode ini.</p>';
      return;
    }
    const max = Math.max(1, ...channels.map((channel) => Number(channel.revenue || 0)));
    channelList.innerHTML = channels.map((channel) => `
      <div class="admin-channel-row">
        <div><span>${admin.escapeHTML(admin.channelLabel(channel.channel))}</span><small>${admin.number(channel.orders)} pesanan</small></div>
        <strong>${admin.money(channel.revenue)}</strong>
        <span class="admin-channel-bar"><i style="width:${Math.max(3, Math.round((channel.revenue / max) * 100))}%"></i></span>
      </div>`).join('');
  }

  function setLoading(value) {
    loading = value;
    document.querySelector('.admin-content')?.setAttribute('aria-busy', value ? 'true' : 'false');
    if (refresh) refresh.disabled = value;
    if (updated && value) updated.textContent = 'Memuat data terbaru…';
  }

  async function load(params) {
    if (loading) return;
    setLoading(true);
    const query = new URLSearchParams();
    if (params) {
      for (const [key, value] of params.entries()) {
        if (value) query.set(key, value);
      }
    }
    try {
      const data = await admin.api(`/api/admin/dashboard${query.toString() ? `?${query}` : ''}`);
      if (fromInput) fromInput.value = data.period?.from || '';
      if (toInput) toInput.value = data.period?.to || '';
      renderSummary(data);
      renderStatus(data);
      renderChart(data);
      renderRecent(data.recentOrders);
      renderLowStock(data.lowStock);
      renderChannels(data.channels);
      if (updated) updated.textContent = `Diperbarui ${admin.time(new Date().toISOString())} · ${periodLabel(data.period)}`;
    } catch (error) {
      if (updated) updated.textContent = error.message || 'Data tidak dapat dimuat.';
      admin.toast(error.message || 'Data dashboard tidak dapat dimuat.', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (rangeForm) {
    rangeForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const params = new URLSearchParams();
      if (fromInput && fromInput.value) params.set('from', fromInput.value);
      if (toInput && toInput.value) params.set('to', toInput.value);
      load(params);
    });
  }

  if (refresh) refresh.addEventListener('click', () => {
    const params = new URLSearchParams();
    if (fromInput && fromInput.value) params.set('from', fromInput.value);
    if (toInput && toInput.value) params.set('to', toInput.value);
    load(params);
  });

  load(new URLSearchParams());
}());
