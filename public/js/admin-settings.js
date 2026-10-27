'use strict';

(function () {
  const admin = window.Admin;
  const state = window.SE || {};
  if (!admin || !document.body.matches('[data-admin-page="admin-settings"]')) return;

  const settingsForm = document.querySelector('[data-settings-form]');
  const settingsError = document.querySelector('[data-settings-error]');
  const passwordForm = document.querySelector('[data-admin-password-form]');
  const passwordFeedback = document.querySelector('[data-admin-password-feedback]');
  const rateInput = document.querySelector('#setting-rate');
  const ratePreview = document.querySelector('[data-rate-preview]');

  function field(name) {
    return settingsForm ? settingsForm.elements.namedItem(name) : null;
  }

  function updateRatePreview() {
    if (!ratePreview || !rateInput) return;
    const rate = Number(rateInput.value);
    if (!Number.isFinite(rate) || rate <= 0) {
      ratePreview.textContent = 'Masukkan nilai tukar untuk melihat contoh konversi.';
      return;
    }
    ratePreview.textContent = `1 USD = ${admin.money(rate)} · contoh US$100 = ${admin.money(rate * 100)}`;
  }

  function fillSettings(settings) {
    if (!settingsForm || !settings) return;
    for (const key of ['exchange_rate', 'brand_email', 'support_phone', 'announcement_en', 'announcement_id', 'promo_code', 'promo_percent', 'low_stock_threshold']) {
      const input = field(key);
      if (input) input.value = settings[key] == null ? '' : String(settings[key]);
    }
    updateRatePreview();
  }

  async function loadSettings() {
    try {
      const data = await admin.api('/api/admin/settings');
      fillSettings(data.settings || {});
      const counts = data.counts || {};
      const set = (selector, value) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = admin.number(value);
      };
      set('[data-setting-products]', counts.products);
      set('[data-setting-variants]', counts.variants);
      set('[data-setting-orders]', counts.orders);
      set('[data-setting-admins]', counts.admins);
      const name = data.admin?.name || '—';
      const avatar = document.querySelector('[data-admin-avatar]');
      const nameEl = document.querySelector('[data-admin-name]');
      const emailEl = document.querySelector('[data-admin-email]');
      if (nameEl) nameEl.textContent = name;
      if (emailEl) emailEl.textContent = data.admin?.email || '—';
      if (avatar) {
        const parts = name.split(/\s+/).filter(Boolean);
        avatar.textContent = `${(parts[0] || 'S').slice(0, 1)}${(parts[1] || 'E').slice(0, 1)}`.toUpperCase();
      }
    } catch (error) {
      admin.setAlert(settingsError, error.message || 'Pengaturan tidak dapat dimuat.', false);
      admin.toast(error.message || 'Pengaturan tidak dapat dimuat.', 'error');
    }
  }

  if (rateInput) rateInput.addEventListener('input', updateRatePreview);

  if (settingsForm) {
    settingsForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!settingsForm.reportValidity()) return;
      admin.setAlert(settingsError, '');
      const data = new FormData(settingsForm);
      const payload = {
        exchange_rate: Number(data.get('exchange_rate')),
        brand_email: String(data.get('brand_email') || '').trim(),
        support_phone: String(data.get('support_phone') || '').trim(),
        announcement_en: String(data.get('announcement_en') || '').trim(),
        announcement_id: String(data.get('announcement_id') || '').trim(),
        promo_code: String(data.get('promo_code') || '').trim().toUpperCase(),
        promo_percent: Number(data.get('promo_percent') || 0),
        low_stock_threshold: Number(data.get('low_stock_threshold') || 0)
      };
      const buttons = Array.from(settingsForm.querySelectorAll('button[type="submit"]'));
      buttons.forEach((button) => admin.setBusy(button, true));
      try {
        const response = await admin.api('/api/admin/settings', { method: 'PUT', body: payload });
        fillSettings(response.settings || payload);
        admin.setAlert(settingsError, 'Pengaturan storefront disimpan.', true);
        admin.toast('Pengaturan storefront diperbarui.');
        admin.refreshBadges(true);
      } catch (error) {
        admin.setAlert(settingsError, error.message || 'Pengaturan tidak dapat disimpan.', false);
      } finally {
        buttons.forEach((button) => admin.setBusy(button, false));
      }
    });
  }

  if (passwordForm) {
    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      admin.setAlert(passwordFeedback, '');
      const current = passwordForm.elements.namedItem('currentPassword');
      const next = passwordForm.elements.namedItem('newPassword');
      const confirm = passwordForm.elements.namedItem('confirmPassword');
      if (!current || !current.value) {
        admin.setAlert(passwordFeedback, 'Masukkan kata sandi saat ini.', false);
        current?.focus();
        return;
      }
      if (!next || next.value.length < 10) {
        admin.setAlert(passwordFeedback, 'Kata sandi baru minimal 10 karakter.', false);
        next?.focus();
        return;
      }
      if (!confirm || confirm.value !== next.value) {
        admin.setAlert(passwordFeedback, 'Konfirmasi kata sandi baru tidak cocok.', false);
        confirm?.focus();
        return;
      }
      const button = passwordForm.querySelector('button[type="submit"]');
      admin.setBusy(button, true);
      try {
        const data = await admin.api('/api/admin/settings/password', {
          method: 'POST',
          body: {
            currentPassword: current.value,
            newPassword: next.value,
            confirmPassword: confirm.value
          }
        });
        if (data.csrfToken) {
          state.csrfToken = data.csrfToken;
          window.SE.csrfToken = data.csrfToken;
        }
        passwordForm.reset();
        admin.setAlert(passwordFeedback, 'Kata sandi administrator diperbarui.', true);
        admin.toast('Kata sandi diperbarui. Sesi diamankan ulang.');
      } catch (error) {
        admin.setAlert(passwordFeedback, error.message || 'Kata sandi tidak dapat diperbarui.', false);
      } finally {
        admin.setBusy(button, false);
      }
    });
  }

  loadSettings();
}());
