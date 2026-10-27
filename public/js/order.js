'use strict';

(function () {
  const button = document.querySelector('[data-print-order]');
  if (!button) return;
  button.addEventListener('click', () => window.print());
}());
