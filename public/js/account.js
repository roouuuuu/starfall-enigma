'use strict';

(function () {
  const app = window.SEApp;
  const state = window.SE || {};
  if (!app) return;

  const page = document.querySelector('[data-account-page]');
  if (!page) return;

  const lang = state.lang === 'id' ? 'id' : 'en';
  const strings = state.strings || {};
  const tabs = Array.from(page.querySelectorAll('[data-account-tab]'));
  const panels = Array.from(page.querySelectorAll('[data-account-panel]'));
  const copy = {
    en: {
      mismatch: 'The new passwords do not match.',
      short: 'Use at least 8 characters for your new password.',
      current: 'Enter your current password.',
      saved: 'Your details have been saved.',
      addressSaved: 'Address added.',
      addressDeleted: 'Address deleted.',
      defaultSaved: 'Default address updated.',
      confirmDelete: 'Delete this address? This cannot be undone.',
      addressRequired: 'Please complete the required address fields.',
      profile: 'Personal details',
      noAddresses: 'No addresses saved',
      noAddressesText: 'Add an address to speed up your next checkout.',
      makeDefault: 'Make default',
      delete: 'Delete address',
      defaultLabel: 'Default',
      order: 'Order',
      failure: 'The request could not be completed. Please try again.'
    },
    id: {
      mismatch: 'Kata sandi baru tidak cocok.',
      short: 'Gunakan minimal 8 karakter untuk kata sandi baru.',
      current: 'Masukkan kata sandi saat ini.',
      saved: 'Detail Anda telah disimpan.',
      addressSaved: 'Alamat ditambahkan.',
      addressDeleted: 'Alamat dihapus.',
      defaultSaved: 'Alamat utama diperbarui.',
      confirmDelete: 'Hapus alamat ini? Tindakan ini tidak dapat dibatalkan.',
      addressRequired: 'Lengkapi kolom alamat yang wajib.',
      profile: 'Detail pribadi',
      noAddresses: 'Belum ada alamat tersimpan',
      noAddressesText: 'Tambahkan alamat agar checkout berikutnya lebih cepat.',
      makeDefault: 'Jadikan utama',
      delete: 'Hapus alamat',
      defaultLabel: 'Utama',
      order: 'Pesanan',
      failure: 'Permintaan tidak dapat diselesaikan. Silakan coba lagi.'
    }
  }[lang];

  function activateTab(name) {
    const safe = panels.some((panel) => panel.dataset.accountPanel === name) ? name : 'profile';
    tabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.accountTab === safe));
    panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.accountPanel === safe));
    page.dataset.activeTab = safe;
    try {
      if (window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        if (safe === 'profile') url.searchParams.delete('tab');
        else url.searchParams.set('tab', safe);
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch (_) { /* noop */ }
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.accountTab));
  });

  const requestedTab = new URLSearchParams(window.location.search).get('tab')
    || (window.location.hash ? window.location.hash.slice(1) : '');
  if (requestedTab) activateTab(requestedTab);

  function setFeedback(el, message, success) {
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
    el.classList.toggle('is-success', Boolean(success));
  }

  /* Profile ------------------------------------------------------------- */

  const profileForm = page.querySelector('[data-profile-form]');
  if (profileForm) {
    const feedback = page.querySelector('[data-profile-feedback]');
    profileForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFeedback(feedback, '');
      if (!profileForm.reportValidity()) return;
      const data = new FormData(profileForm);
      const button = profileForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        const response = await app.apiFetch('/api/account/profile', {
          method: 'POST',
          body: {
            firstName: String(data.get('firstName') || '').trim(),
            lastName: String(data.get('lastName') || '').trim(),
            phone: String(data.get('phone') || '').trim()
          }
        });
        setFeedback(feedback, strings.profileSaved || copy.saved, true);
        const userName = [response.user && response.user.first_name, response.user && response.user.last_name].filter(Boolean).join(' ');
        if (userName) {
          const greeting = page.querySelector('.account-hero h1');
          if (greeting) {
            greeting.textContent = lang === 'id' ? `Halo, ${response.user.first_name}.` : `Hello, ${response.user.first_name}.`;
          }
          const cardName = document.querySelector('[data-admin-name]');
          if (cardName) cardName.textContent = userName;
        }
      } catch (error) {
        setFeedback(feedback, error.message || copy.failure, false);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  /* Password ------------------------------------------------------------ */

  const passwordForm = page.querySelector('[data-password-form]');
  if (passwordForm) {
    const feedback = page.querySelector('[data-password-feedback]');
    const current = passwordForm.querySelector('input[name="currentPassword"]');
    const next = passwordForm.querySelector('input[name="newPassword"]');
    const confirm = passwordForm.querySelector('input[name="confirmPassword"]');

    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFeedback(feedback, '');
      if (!current || !String(current.value).trim()) {
        setFeedback(feedback, copy.current, false);
        if (current) current.focus();
        return;
      }
      if (!next || next.value.length < 8) {
        setFeedback(feedback, copy.short, false);
        if (next) next.focus();
        return;
      }
      if (!confirm || confirm.value !== next.value) {
        setFeedback(feedback, copy.mismatch, false);
        if (confirm) confirm.focus();
        return;
      }
      const button = passwordForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        const response = await app.apiFetch('/api/account/password', {
          method: 'POST',
          body: {
            currentPassword: current.value,
            newPassword: next.value,
            confirmPassword: confirm.value
          }
        });
        if (response.csrfToken) {
          state.csrfToken = response.csrfToken;
          window.SE.csrfToken = response.csrfToken;
        }
        passwordForm.reset();
        setFeedback(feedback, strings.passwordChanged || copy.saved, true);
      } catch (error) {
        setFeedback(feedback, error.message || copy.failure, false);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  /* Addresses ------------------------------------------------------------ */

  const addressDialog = document.querySelector('[data-address-dialog]');
  const addressForm = document.querySelector('[data-address-form]');
  const addressList = page.querySelector('[data-address-list]');
  const addressFeedback = page.querySelector('[data-address-feedback]');
  const dialogError = document.querySelector('[data-address-dialog-error]');
  const addAddressButton = page.querySelector('[data-address-open]');
  const addressTabCount = page.querySelector('[data-account-tab="addresses"] small');

  function addressHTML(address) {
    return `
      <article class="address-card" data-address-id="${Number(address.id)}">
        <div class="address-card-head">
          <span class="address-label">${app.escapeHTML(address.label || '')}</span>
          ${address.is_default ? `<span class="address-default">${app.escapeHTML(copy.defaultLabel)}</span>` : ''}
        </div>
        <p class="address-name">${app.escapeHTML(`${address.first_name || ''} ${address.last_name || ''}`.trim())}</p>
        <address>
          <span>${app.escapeHTML(address.address1 || '')}</span>
          ${address.address2 ? `<span>${app.escapeHTML(address.address2)}</span>` : ''}
          <span>${app.escapeHTML(`${address.city || ''}${address.region ? `, ${address.region}` : ''} ${address.postal_code || ''}`.trim())}</span>
          <span>${app.escapeHTML(address.country || '')}</span>
          <span>${app.escapeHTML(address.phone || '')}</span>
        </address>
        <div class="address-actions">
          ${!address.is_default ? `<button class="text-button" type="button" data-address-default="${Number(address.id)}">${app.escapeHTML(copy.makeDefault)}</button>` : ''}
          <button class="text-button text-button--muted" type="button" data-address-delete="${Number(address.id)}">${app.escapeHTML(copy.delete)}</button>
        </div>
      </article>`;
  }

  function renderAddresses(addresses) {
    if (!addressList) return;
    const list = Array.isArray(addresses) ? addresses : [];
    addressList.innerHTML = list.length
      ? list.map(addressHTML).join('')
      : `<div class="account-empty account-empty--compact">
          <span aria-hidden="true">✦</span>
          <h3>${app.escapeHTML(copy.noAddresses)}</h3>
          <p>${app.escapeHTML(copy.noAddressesText)}</p>
        </div>`;
    if (addressTabCount) addressTabCount.textContent = String(list.length);
  }

  async function loadAddresses() {
    const data = await app.apiFetch('/api/account/addresses');
    renderAddresses(data.addresses || []);
    return data.addresses || [];
  }

  function openAddressDialog() {
    if (!addressDialog || !addressForm) return;
    setFeedback(dialogError, '');
    addressForm.reset();
    const firstName = page.querySelector('#account-first');
    const lastName = page.querySelector('#account-last');
    const phone = page.querySelector('#account-phone');
    const first = addressForm.querySelector('#address-first');
    const last = addressForm.querySelector('#address-last');
    const tel = addressForm.querySelector('#address-phone');
    const country = addressForm.querySelector('#address-country');
    if (first && firstName) first.value = firstName.value;
    if (last && lastName) last.value = lastName.value;
    if (tel && phone) tel.value = phone.value;
    if (country && !country.value) country.value = 'Indonesia';
    if (typeof addressDialog.showModal === 'function') addressDialog.showModal();
    else addressDialog.setAttribute('open', '');
    const field = addressForm.querySelector('#address-line1');
    if (field) window.setTimeout(() => field.focus(), 60);
  }

  function closeAddressDialog() {
    if (!addressDialog) return;
    if (typeof addressDialog.close === 'function') addressDialog.close();
    else addressDialog.removeAttribute('open');
  }

  if (addAddressButton) addAddressButton.addEventListener('click', openAddressDialog);
  page.querySelectorAll('[data-address-close]').forEach((button) => button.addEventListener('click', closeAddressDialog));
  if (addressDialog) {
    addressDialog.addEventListener('click', (event) => {
      if (event.target === addressDialog) closeAddressDialog();
    });
    addressDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeAddressDialog();
    });
  }

  if (addressForm) {
    addressForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFeedback(dialogError, '');
      const data = new FormData(addressForm);
      const required = ['firstName', 'address1', 'city', 'postalCode'];
      for (const name of required) {
        if (!String(data.get(name) || '').trim()) {
          setFeedback(dialogError, copy.addressRequired, false);
          const field = addressForm.querySelector(`[name="${name}"]`);
          if (field) field.focus();
          return;
        }
      }
      const button = addressForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        await app.apiFetch('/api/account/addresses', {
          method: 'POST',
          body: {
            label: String(data.get('label') || '').trim(),
            firstName: String(data.get('firstName') || '').trim(),
            lastName: String(data.get('lastName') || '').trim(),
            country: String(data.get('country') || '').trim(),
            address1: String(data.get('address1') || '').trim(),
            address2: String(data.get('address2') || '').trim(),
            city: String(data.get('city') || '').trim(),
            region: String(data.get('region') || '').trim(),
            postalCode: String(data.get('postalCode') || '').trim(),
            phone: String(data.get('phone') || '').trim(),
            isDefault: Boolean(data.get('isDefault'))
          }
        });
        await loadAddresses();
        closeAddressDialog();
        setFeedback(addressFeedback, strings.addressAdded || copy.addressSaved, true);
      } catch (error) {
        setFeedback(dialogError, error.message || copy.failure, false);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  if (addressList) {
    addressList.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const defaultButton = target.closest('[data-address-default]');
      const deleteButton = target.closest('[data-address-delete]');
      if (!defaultButton && !deleteButton) return;
      const id = Number(defaultButton ? defaultButton.dataset.addressDefault : deleteButton.dataset.addressDelete);
      if (!Number.isInteger(id) || id <= 0) return;
      if (deleteButton && !window.confirm(copy.confirmDelete)) return;
      const active = defaultButton || deleteButton;
      active.disabled = true;
      try {
        if (defaultButton) {
          await app.apiFetch(`/api/account/addresses/${id}/default`, { method: 'POST', body: {} });
          setFeedback(addressFeedback, copy.defaultSaved, true);
        } else {
          await app.apiFetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
          setFeedback(addressFeedback, strings.addressDeleted || copy.addressDeleted, true);
        }
        await loadAddresses();
      } catch (error) {
        setFeedback(addressFeedback, error.message || copy.failure, false);
        active.disabled = false;
      }
    });
  }
}());
