'use strict';

(function () {
  const state = window.SE || {};
  const form = document.querySelector('[data-admin-auth]');
  if (!form) return;

  const mode = form.dataset.adminAuth === 'setup' ? 'setup' : 'login';
  const errorEl = form.querySelector('[data-admin-auth-error]');
  const submit = form.querySelector('[data-admin-auth-submit]');
  const originalHtml = submit ? submit.innerHTML : '';
  let busy = false;

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }

  function setBusy(value) {
    busy = value;
    if (!submit) return;
    submit.disabled = value;
    if (value) submit.textContent = mode === 'setup' ? 'Membuat akun…' : 'Memeriksa akses…';
    else submit.innerHTML = originalHtml;
  }

  document.querySelectorAll('[data-admin-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.closest('.admin-password-field');
      const input = field ? field.querySelector('input') : null;
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? '◑' : '◐';
      button.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
      button.setAttribute('aria-pressed', show ? 'true' : 'false');
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    showError('');
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const payload = { email, password };

    if (mode === 'setup') {
      const confirm = String(data.get('confirmPassword') || '');
      const firstName = String(data.get('firstName') || '').trim();
      if (!firstName) {
        showError('Nama depan wajib diisi.');
        return;
      }
      if (password.length < 10) {
        showError('Kata sandi administrator minimal 10 karakter.');
        return;
      }
      if (password !== confirm) {
        showError('Konfirmasi kata sandi tidak cocok.');
        return;
      }
      payload.firstName = firstName;
      payload.lastName = String(data.get('lastName') || '').trim();
      payload.confirmPassword = confirm;
    }

    setBusy(true);
    try {
      const response = await fetch(mode === 'setup' ? '/api/setup' : '/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': String(state.csrfToken || '')
        },
        body: JSON.stringify(payload)
      });
      let result = null;
      try { result = await response.json(); } catch (_) { result = null; }
      if (!response.ok) {
        const message = result && result.error && result.error.message
          ? result.error.message
          : 'Akses tidak dapat diproses. Silakan coba lagi.';
        throw new Error(message);
      }
      window.location.assign((result && result.redirect) || '/admin');
    } catch (error) {
      showError(error.message || 'Tidak dapat terhubung ke server.');
      setBusy(false);
      const passwordField = form.querySelector('input[name="password"]');
      if (passwordField) passwordField.focus();
    }
  });
}());
