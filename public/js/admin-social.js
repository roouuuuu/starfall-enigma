'use strict';

(function () {
  const admin = window.Admin;
  if (!admin || !document.body.matches('[data-admin-page="admin-social"]')) return;

  const form = document.querySelector('[data-social-form]');
  const errorEl = document.querySelector('[data-social-error]');
  const chartEl = document.querySelector('[data-social-chart]');
  const recentEl = document.querySelector('[data-social-recent]');
  const totalEl = document.querySelector('[data-social-total]');
  const platforms = ['instagram', 'tiktok', 'shopee'];
  const labels = { instagram: 'Instagram', tiktok: 'TikTok', shopee: 'Shopee' };
  let saving = false;

  function validHttpUrl(value) {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function syncTestLink(platform) {
    const urlInput = document.querySelector(`[data-social-url="${platform}"]`);
    const test = document.querySelector(`[data-social-test="${platform}"]`);
    if (!urlInput || !test) return;
    const value = urlInput.value.trim();
    if (validHttpUrl(value)) {
      test.href = value;
      test.hidden = false;
    } else {
      test.hidden = true;
      test.removeAttribute('href');
    }
  }

  function render(data) {
    const linkMap = new Map((data.links || []).map((link) => [link.platform, link]));
    const clickMap = new Map((data.clicks || []).map((click) => [click.platform, click.count]));
    platforms.forEach((platform) => {
      const link = linkMap.get(platform);
      const urlInput = document.querySelector(`[data-social-url="${platform}"]`);
      const activeInput = document.querySelector(`[data-social-active="${platform}"]`);
      const clicks = document.querySelector(`[data-social-clicks="${platform}"]`);
      if (urlInput) urlInput.value = link?.url || '';
      if (activeInput) activeInput.checked = Boolean(link?.active);
      if (clicks) clicks.textContent = admin.number(clickMap.get(platform) || 0);
      syncTestLink(platform);
    });
    if (totalEl) totalEl.textContent = admin.number(data.totalClicks || 0);
    renderChart(data.chart || []);
    renderRecent(data.recentClicks || []);
  }

  function renderChart(rows) {
    if (!chartEl) return;
    admin.renderChart(chartEl, {
      title: 'Klik tautan sosial 14 hari terakhir',
      labels: rows.map((row) => {
        const date = new Date(`${row.date}T12:00:00+07:00`);
        return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit' }).format(date);
      }),
      series: [
        { name: 'Instagram', values: rows.map((row) => Number(row.values?.instagram || 0)) },
        { name: 'TikTok', values: rows.map((row) => Number(row.values?.tiktok || 0)) },
        { name: 'Shopee', values: rows.map((row) => Number(row.values?.shopee || 0)) }
      ],
      footnote: 'Klik keluar nyata · tanpa bot'
    });
  }

  function renderRecent(clicks) {
    if (!recentEl) return;
    if (!clicks.length) {
      recentEl.innerHTML = '<p class="admin-empty-text">Belum ada klik keluar yang tercatat.</p>';
      return;
    }
    recentEl.innerHTML = clicks.map((click) => `
      <div class="admin-click-row">
        <span class="admin-click-platform">${admin.escapeHTML((labels[click.platform] || click.platform || '?').slice(0, 2).toUpperCase())}</span>
        <div>
          <strong>${admin.escapeHTML(labels[click.platform] || click.platform)}</strong>
          <small>${admin.escapeHTML(click.path || '—')}${click.user ? ` · ${admin.escapeHTML(click.user)}` : ''}</small>
        </div>
        <time>${admin.escapeHTML(admin.dateTime(click.clickedAt))}</time>
      </div>`).join('');
  }

  async function loadSocial() {
    try {
      const data = await admin.api('/api/admin/social');
      render(data);
    } catch (error) {
      admin.setAlert(errorEl, error.message || 'Data sosial tidak dapat dimuat.', false);
      admin.toast(error.message || 'Data sosial tidak dapat dimuat.', 'error');
    }
  }

  platforms.forEach((platform) => {
    const input = document.querySelector(`[data-social-url="${platform}"]`);
    if (input) input.addEventListener('input', () => syncTestLink(platform));
  });

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving) return;
      admin.setAlert(errorEl, '');
      const links = {};
      for (const platform of platforms) {
        const urlInput = document.querySelector(`[data-social-url="${platform}"]`);
        const activeInput = document.querySelector(`[data-social-active="${platform}"]`);
        const url = urlInput ? urlInput.value.trim() : '';
        const active = Boolean(activeInput && activeInput.checked);
        if (url && !validHttpUrl(url)) {
          admin.setAlert(errorEl, `URL ${labels[platform]} harus berupa tautan http(s) yang valid.`, false);
          urlInput?.focus();
          return;
        }
        if (active && !url) {
          admin.setAlert(errorEl, `Isi URL ${labels[platform]} sebelum mengaktifkan tautan.`, false);
          urlInput?.focus();
          return;
        }
        links[platform] = { url, active };
      }
      saving = true;
      const button = document.querySelector('button[form="social-form"][type="submit"]');
      admin.setBusy(button, true);
      try {
        await admin.api('/api/admin/social', { method: 'PUT', body: { links } });
        admin.setAlert(errorEl, 'Tautan sosial disimpan.', true);
        admin.toast('Tautan sosial diperbarui.');
        await loadSocial();
      } catch (error) {
        admin.setAlert(errorEl, error.message || 'Tautan sosial tidak dapat disimpan.', false);
      } finally {
        saving = false;
        admin.setBusy(button, false);
      }
    });
  }

  loadSocial();
}());
