'use strict';

(function () {
  const app = window.SEApp;
  const state = window.SE || {};
  if (!app) return;

  const form = document.querySelector('[data-auth-form]');
  if (!form) return;

  const mode = form.dataset.authForm === 'register' ? 'register' : 'login';
  const lang = state.lang === 'id' ? 'id' : 'en';
  const errorEl = form.querySelector('[data-auth-error]');
  const submit = form.querySelector('[data-auth-submit]');
  const originalLabel = submit ? submit.innerHTML : '';
  const copy = {
    en: {
      mismatch: 'The passwords do not match.',
      short: 'Use at least 8 characters for your password.',
      required: 'Please complete all required fields.',
      email: 'Enter a valid email address.',
      invalid: 'Email or password is incorrect.'
    },
    id: {
      mismatch: 'Konfirmasi kata sandi tidak cocok.',
      short: 'Gunakan minimal 8 karakter untuk kata sandi Anda.',
      required: 'Lengkapi semua kolom wajib.',
      email: 'Masukkan alamat email yang valid.',
      invalid: 'Email atau kata sandi salah.'
    }
  }[lang];

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }

  function setLoading(loading) {
    if (!submit) return;
    submit.disabled = loading;
    if (loading) submit.innerHTML = `${app.escapeHTML(app.ui.loading || 'Loading')}…`;
    else submit.innerHTML = originalLabel;
  }

  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.closest('.password-field');
      const input = field ? field.querySelector('input') : null;
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', show ? 'true' : 'false');
      button.textContent = show ? '◑' : '◐';
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const payload = {
      email,
      password,
      lang,
      next: form.dataset.next || '/account',
      wishlistProductIds: app.guestWishlist().map((item) => Number(item.id)).filter(Boolean)
    };

    if (mode === 'register') {
      const confirmPassword = String(data.get('confirmPassword') || '');
      if (password.length < 8) {
        showError(copy.short);
        return;
      }
      if (password !== confirmPassword) {
        showError(copy.mismatch);
        return;
      }
      payload.firstName = String(data.get('firstName') || '').trim();
      payload.lastName = String(data.get('lastName') || '').trim();
      payload.confirmPassword = confirmPassword;
      payload.subscribe = Boolean(data.get('subscribe'));
    }

    setLoading(true);
    try {
      const response = await app.apiFetch(mode === 'register' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: payload
      });
      app.saveGuestWishlist([]);
      window.location.assign(response.redirect || (mode === 'register' ? '/account' : '/account'));
    } catch (error) {
      const message = error.code === 'email_taken'
        ? (state.strings && state.strings.emailTaken) || error.message
        : error.code === 'confirm_password' || error.code === 'password'
          ? error.message || copy.mismatch
          : error.message || copy.invalid;
      showError(message);
      setLoading(false);
      const passwordField = form.querySelector('input[name="password"]');
      if (passwordField && error.code === 'invalid_credentials') passwordField.focus();
    }
  });
}());
