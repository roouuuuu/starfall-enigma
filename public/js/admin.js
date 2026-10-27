'use strict';

(function () {
  const state = window.SE = window.SE || {};
  const admin = window.Admin = window.Admin || {};
  const body = document.body;
  const isAdminShell = document.querySelector('.admin-shell');

  const STATUS = {
    paid: 'Dibayar',
    processing: 'Diproses',
    shipped: 'Dikirim',
    completed: 'Selesai',
    cancelled: 'Dibatalkan'
  };
  const CHANNELS = {
    website: 'Website',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    shopee: 'Shopee',
    offline: 'Offline'
  };
  const MOVEMENTS = {
    opening: 'Stok awal',
    in: 'Stok masuk',
    sale: 'Penjualan',
    return: 'Pengembalian',
    adjustment: 'Penyesuaian'
  };
  let badgeCache = 0;
  let catalogCache = null;
  let catalogPromise = null;

  const idr = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  });
  const number = new Intl.NumberFormat('id-ID');
  const decimal = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
  const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });
  const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  });
  const timeFormatter = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  });

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

  function money(value) {
    return idr.format(Number(value || 0));
  }

  function formatNumber(value) {
    return number.format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(`${value}T12:00:00+07:00`)
      : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return dateFormatter.format(date);
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return formatDate(value);
    return dateTimeFormatter.format(date);
  }

  function formatTime(value) {
    if (!value) return '—';
    return timeFormatter.format(new Date(value)) + ' WIB';
  }

  function today() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  }

  function shortMoney(value) {
    const amount = Number(value || 0);
    const abs = Math.abs(amount);
    if (abs >= 1000000000) return `${decimal.format(amount / 1000000000)} M`;
    if (abs >= 1000000) return `${decimal.format(amount / 1000000)} jt`;
    if (abs >= 1000) return `${decimal.format(amount / 1000)} rb`;
    return number.format(amount);
  }

  function initials(first, last) {
    return `${String(first || 'S').slice(0, 1)}${String(last || 'E').slice(0, 1)}`.toUpperCase();
  }

  function statusBadge(status) {
    return `<span class="admin-status admin-status--${escapeAttr(status)}">${escapeHTML(STATUS[status] || status || '—')}</span>`;
  }

  function channelLabel(channel) {
    return CHANNELS[channel] || channel || '—';
  }

  function movementLabel(type) {
    return MOVEMENTS[type] || type || '—';
  }

  function debounce(fn, delay = 250) {
    let timer = null;
    return function debounced(...args) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn.apply(this, args), delay);
    };
  }

  async function api(url, options = {}) {
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
      const error = new Error('Koneksi ke server terputus. Periksa jaringan lalu coba lagi.');
      error.code = 'network';
      throw error;
    }
    const type = response.headers.get('content-type') || '';
    let data = null;
    if (type.includes('application/json')) {
      try { data = await response.json(); } catch (_) { data = null; }
    } else {
      try { data = await response.text(); } catch (_) { data = null; }
    }
    if (!response.ok) {
      const error = new Error(
        data && data.error && data.error.message
          ? data.error.message
          : 'Permintaan tidak dapat diproses. Silakan coba lagi.'
      );
      error.status = response.status;
      error.code = data && data.error ? data.error.code : '';
      error.data = data;
      throw error;
    }
    return data;
  }

  function toast(message, type = 'success') {
    if (!message) return;
    const stack = document.querySelector('[data-admin-toast]');
    if (!stack) return;
    const node = document.createElement('div');
    node.className = `admin-toast${type === 'error' ? ' is-error' : ''}`;
    node.setAttribute('role', 'status');
    node.innerHTML = `<span aria-hidden="true">${type === 'error' ? '!' : '✦'}</span><span>${escapeHTML(message)}</span>`;
    stack.appendChild(node);
    window.setTimeout(() => {
      node.style.opacity = '0';
      node.style.transform = 'translateY(8px)';
      node.style.transition = 'opacity .24s ease, transform .24s ease';
      window.setTimeout(() => node.remove(), 260);
    }, 3600);
  }

  function setAlert(element, message, success = false) {
    if (!element) return;
    element.textContent = message || '';
    element.hidden = !message;
    element.classList.toggle('is-success', Boolean(success));
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      if (label) button.textContent = label;
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    }
  }

  function formObject(form) {
    const data = new FormData(form);
    const result = {};
    for (const [key, value] of data.entries()) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value];
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  function queryFromForm(form) {
    const data = formObject(form);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) value.forEach((item) => { if (item !== '') params.append(key, item); });
      else if (value !== '' && value != null) params.set(key, value);
    }
    return params;
  }

  /* Dialog helpers ------------------------------------------------------ */

  function openDialog(dialog) {
    const node = typeof dialog === 'string' ? document.querySelector(dialog) : dialog;
    if (!node) return null;
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', '');
    return node;
  }

  function closeDialog(dialog) {
    const node = typeof dialog === 'string' ? document.querySelector(dialog) : dialog;
    if (!node) return;
    if (typeof node.close === 'function' && node.open) node.close();
    else node.removeAttribute('open');
  }

  function bindDialogs() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-dialog-close]')) {
        const dialog = target.closest('dialog');
        if (dialog) closeDialog(dialog);
      }
    });
    document.querySelectorAll('dialog.admin-dialog, dialog.form-dialog').forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) closeDialog(dialog);
      });
    });
  }

  /* Pagination ---------------------------------------------------------- */

  function renderPagination(container, page, totalPages, onChange) {
    if (!container) return;
    container.innerHTML = '';
    const total = Math.max(1, Number(totalPages) || 1);
    if (total <= 1) return;
    const current = Math.min(total, Math.max(1, Number(page) || 1));
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'admin-page-button';
    previous.textContent = '← Sebelumnya';
    previous.disabled = current <= 1;
    previous.addEventListener('click', () => onChange(current - 1));
    const label = document.createElement('span');
    label.className = 'admin-page-current';
    label.textContent = `Halaman ${current} dari ${total}`;
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'admin-page-button';
    next.textContent = 'Berikutnya →';
    next.disabled = current >= total;
    next.addEventListener('click', () => onChange(current + 1));
    container.append(previous, label, next);
  }

  /* Graphs --------------------------------------------------------------- */

  function renderChart(container, options = {}) {
    if (!container) return;
    const labels = Array.isArray(options.labels) ? options.labels : [];
    const series = (Array.isArray(options.series) ? options.series : []).filter((item) => Array.isArray(item.values));
    if (!labels.length || !series.length) {
      container.innerHTML = '<p class="admin-empty-text">Belum ada data untuk ditampilkan.</p>';
      return;
    }
    const width = 760;
    const height = 300;
    const margin = { top: 18, right: 16, bottom: 38, left: 58 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    let maxValue = 0;
    let minValue = 0;
    series.forEach((item) => item.values.forEach((value) => {
      maxValue = Math.max(maxValue, Number(value) || 0);
      minValue = Math.min(minValue, Number(value) || 0);
    }));
    if (maxValue === 0 && minValue === 0) {
      container.innerHTML = '<p class="admin-empty-text">Belum ada nilai pada periode ini.</p>';
      return;
    }
    maxValue = Math.max(maxValue * 1.12, 1);
    minValue = minValue < 0 ? minValue * 1.12 : 0;
    const range = maxValue - minValue || 1;
    const y = (value) => margin.top + ((maxValue - Number(value || 0)) / range) * plotH;
    const zeroY = y(0);
    const groupWidth = plotW / labels.length;
    const barSeries = series.filter((item) => item.type !== 'line');
    const lineSeries = series.filter((item) => item.type === 'line');
    const barSlot = groupWidth * 0.68;
    const barWidth = Math.max(2, Math.min(16, barSlot / Math.max(1, barSeries.length) - 2));
    const step = Math.max(1, Math.ceil(labels.length / 8));

    let svg = `<svg class="admin-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(options.title || 'Grafik data')}">`;
    for (let i = 0; i <= 4; i += 1) {
      const tickValue = minValue + (range * i) / 4;
      const yPos = y(tickValue);
      svg += `<line class="chart-grid-line" x1="${margin.left}" y1="${yPos}" x2="${width - margin.right}" y2="${yPos}"></line>`;
      svg += `<text class="chart-label chart-label--y" x="${margin.left - 9}" y="${yPos + 3}" text-anchor="end">${escapeHTML(shortMoney(tickValue))}</text>`;
    }
    if (minValue < 0) {
      svg += `<line class="chart-zero-line" x1="${margin.left}" y1="${zeroY}" x2="${width - margin.right}" y2="${zeroY}"></line>`;
    }
    labels.forEach((label, index) => {
      const center = margin.left + groupWidth * index + groupWidth / 2;
      if (index % step === 0) {
        svg += `<text class="chart-label chart-label--x" x="${center}" y="${height - 15}" text-anchor="middle">${escapeHTML(label)}</text>`;
      }
      barSeries.forEach((item, seriesIndex) => {
        const value = Number(item.values[index]) || 0;
        const baseY = zeroY;
        const valueY = y(value);
        const xPos = center - (barSeries.length * (barWidth + 2)) / 2 + seriesIndex * (barWidth + 2);
        const yPos = Math.min(baseY, valueY);
        const heightValue = Math.max(1, Math.abs(baseY - valueY));
        svg += `<rect class="chart-bar chart-series-${seriesIndex}" x="${xPos}" y="${yPos}" width="${barWidth}" height="${heightValue}" rx="1"><title>${escapeHTML(`${label} · ${item.name}: ${money(value)}`)}</title></rect>`;
      });
    });
    lineSeries.forEach((item, lineIndex) => {
      const points = item.values.map((value, index) => {
        const xPos = margin.left + groupWidth * index + groupWidth / 2;
        return `${xPos},${y(value)}`;
      }).join(' ');
      svg += `<polyline class="chart-line chart-series-line-${lineIndex}" points="${points}" fill="none"></polyline>`;
      item.values.forEach((value, index) => {
        const xPos = margin.left + groupWidth * index + groupWidth / 2;
        svg += `<circle class="chart-dot chart-series-line-${lineIndex}" cx="${xPos}" cy="${y(value)}" r="2.5"><title>${escapeHTML(`${labels[index]} · ${item.name}: ${money(value)}`)}</title></circle>`;
      });
    });
    svg += `<text class="chart-label chart-label--x" x="${margin.left}" y="${height - 2}">${escapeHTML(options.footnote || '')}</text>`;
    svg += '</svg>';
    container.innerHTML = svg;
  }

  /* Shell --------------------------------------------------------------- */

  let adminMenuOpener = null;
  const adminSidebarQuery = window.matchMedia ? window.matchMedia('(max-width: 980px)') : null;

  function syncAdminSidebarA11y() {
    const sidebar = document.querySelector('[data-admin-sidebar]');
    const toggle = document.querySelector('[data-admin-menu]');
    if (!sidebar) return;
    const mobile = adminSidebarQuery ? adminSidebarQuery.matches : false;
    const open = sidebar.classList.contains('is-open');
    if (mobile) {
      sidebar.setAttribute('aria-hidden', open ? 'false' : 'true');
      sidebar.inert = !open;
    } else {
      sidebar.removeAttribute('aria-hidden');
      sidebar.inert = false;
    }
    if (toggle) toggle.setAttribute('aria-expanded', String(mobile && open));
  }

  function setAdminMenu(open) {
    const sidebar = document.querySelector('[data-admin-sidebar]');
    const scrim = document.querySelector('[data-admin-scrim]');
    if (!sidebar) return;
    const wasOpen = sidebar.classList.contains('is-open');
    if (open && !wasOpen) adminMenuOpener = document.activeElement;
    sidebar.classList.toggle('is-open', open);
    if (scrim) scrim.classList.toggle('is-open', open);
    body.classList.toggle('admin-menu-open', open);
    syncAdminSidebarA11y();
    if (open && !wasOpen) {
      window.setTimeout(() => {
        const close = sidebar.querySelector('[data-admin-menu-close]');
        if (close) close.focus({ preventScroll: true });
      }, 60);
    } else if (!open && wasOpen) {
      const opener = adminMenuOpener;
      adminMenuOpener = null;
      if (opener && document.contains(opener) && opener.getClientRects().length) opener.focus({ preventScroll: true });
    }
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST', body: {} });
      window.location.assign('/admin/login');
    } catch (error) {
      toast(error.message || 'Gagal keluar.', 'error');
    }
  }

  async function refreshBadges(force = false) {
    if (!isAdminShell) return;
    if (!force && Date.now() - badgeCache < 30000) return;
    try {
      const data = await api('/api/admin/dashboard');
      badgeCache = Date.now();
      updateBadges(data.summary || {});
    } catch (_) {
      /* Sidebar badges are supplementary. */
    }
  }

  function updateBadges(summary = {}) {
    const openOrders = document.querySelector('[data-admin-open-orders]');
    const lowStock = document.querySelector('[data-admin-low-stock]');
    if (openOrders && summary.openOrders !== undefined) {
      openOrders.textContent = Number(summary.openOrders || 0) > 0 ? String(summary.openOrders) : '';
    }
    if (lowStock && summary.lowStock !== undefined) {
      lowStock.textContent = Number(summary.lowStock || 0) > 0 ? String(summary.lowStock) : '';
    }
  }

  async function getCatalog(force = false) {
    if (!force && catalogCache) return catalogCache;
    if (!force && catalogPromise) return catalogPromise;
    catalogPromise = api('/api/admin/catalog')
      .then((data) => {
        catalogCache = data;
        return data;
      })
      .finally(() => { catalogPromise = null; });
    return catalogPromise;
  }

  function initShell() {
    if (!isAdminShell) return;
    bindDialogs();
    document.querySelectorAll('[data-admin-menu]').forEach((button) => {
      button.addEventListener('click', () => setAdminMenu(true));
    });
    document.querySelectorAll('[data-admin-menu-close], [data-admin-scrim]').forEach((button) => {
      button.addEventListener('click', () => setAdminMenu(false));
    });
    document.addEventListener('keydown', (event) => {
      const sidebar = document.querySelector('[data-admin-sidebar]');
      if (event.key === 'Tab' && sidebar && sidebar.classList.contains('is-open')) {
        const focusables = [...sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter((element) => element.getClientRects().length > 0);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!sidebar.contains(document.activeElement)) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
        return;
      }
      if (event.key === 'Escape') setAdminMenu(false);
    });
    document.querySelectorAll('[data-admin-logout]').forEach((button) => {
      button.addEventListener('click', () => logout());
    });
    syncAdminSidebarA11y();
    if (adminSidebarQuery && adminSidebarQuery.addEventListener) {
      adminSidebarQuery.addEventListener('change', syncAdminSidebarA11y);
    }

    const updateClock = () => {
      const clock = document.querySelector('[data-admin-clock]');
      if (clock) clock.textContent = timeFormatter.format(new Date());
    };
    updateClock();
    window.setInterval(updateClock, 30000);
    refreshBadges();

    document.querySelectorAll('form').forEach((form) => {
      form.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        if (event.target instanceof HTMLTextAreaElement) return;
        if (event.target instanceof HTMLSelectElement) return;
        if (event.target instanceof HTMLButtonElement) return;
        if (form.matches('[data-orders-filter], [data-inventory-filter], [data-movements-filter], [data-finance-filter], [data-customers-filter]')) {
          event.preventDefault();
          if (typeof form.requestSubmit === 'function') form.requestSubmit();
        }
      });
    });
  }

  admin.api = api;
  admin.toast = toast;
  admin.escapeHTML = escapeHTML;
  admin.escapeAttr = escapeAttr;
  admin.money = money;
  admin.number = formatNumber;
  admin.date = formatDate;
  admin.dateTime = formatDateTime;
  admin.time = formatTime;
  admin.today = today;
  admin.shortMoney = shortMoney;
  admin.initials = initials;
  admin.statusBadge = statusBadge;
  admin.channelLabel = channelLabel;
  admin.movementLabel = movementLabel;
  admin.STATUS = STATUS;
  admin.CHANNELS = CHANNELS;
  admin.debounce = debounce;
  admin.setAlert = setAlert;
  admin.setBusy = setBusy;
  admin.formObject = formObject;
  admin.queryFromForm = queryFromForm;
  admin.openDialog = openDialog;
  admin.closeDialog = closeDialog;
  admin.bindDialogs = bindDialogs;
  admin.renderPagination = renderPagination;
  admin.renderChart = renderChart;
  admin.refreshBadges = refreshBadges;
  admin.updateBadges = updateBadges;
  admin.getCatalog = getCatalog;
  admin.logout = logout;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initShell, { once: true });
  else initShell();
}());
