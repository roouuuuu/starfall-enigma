'use strict';

const express = require('express');
const { requireAdmin, getAdminCount } = require('../auth');

const router = express.Router();

function templateUser(user) {
  if (!user) return null;
  return {
    id: Number(user.id),
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name || '',
    phone: user.phone || '',
    role: user.role,
    created_at: user.created_at
  };
}

const ADMIN_PAGES = {
  dashboard: {
    path: '/admin',
    title: 'Ringkasan',
    subtitle: 'Pulsa bisnis malam ini.',
    view: 'admin/dashboard',
    script: 'admin-dashboard.js'
  },
  orders: {
    path: '/admin/orders',
    title: 'Pesanan',
    subtitle: 'Pesanan online, pembatalan, dan penjualan manual.',
    view: 'admin/orders',
    script: 'admin-orders.js'
  },
  inventory: {
    path: '/admin/inventory',
    title: 'Stok & Inventaris',
    subtitle: 'Stok per varian, penerimaan, penyesuaian, dan jejak audit.',
    view: 'admin/inventory',
    script: 'admin-inventory.js'
  },
  finance: {
    path: '/admin/finance',
    title: 'Keuangan',
    subtitle: 'Buku kas dalam IDR. Pemasukan, pengeluaran, dan laba bersih.',
    view: 'admin/finance',
    script: 'admin-finance.js'
  },
  social: {
    path: '/admin/social',
    title: 'Sosial & Klik',
    subtitle: 'Tautan keluar, pelacakan klik nyata, tanpa lalu lintas palsu.',
    view: 'admin/social',
    script: 'admin-social.js'
  },
  customers: {
    path: '/admin/customers',
    title: 'Pelanggan',
    subtitle: 'Akun, nilai belanja, dan daftar korespondensi.',
    view: 'admin/customers',
    script: 'admin-customers.js'
  },
  settings: {
    path: '/admin/settings',
    title: 'Pengaturan',
    subtitle: 'Identitas toko, nilai tukar, promo, dan keamanan akun.',
    view: 'admin/settings',
    script: 'admin-settings.js'
  }
};

router.get('/setup', (req, res) => {
  const db = req.app.get('db');
  if (getAdminCount(db) > 0) {
    const adminBase = req.app.get('adminBase');
    return res.redirect(req.user?.role === 'admin' ? adminBase : `${adminBase}/login`);
  }
  res.render('admin/setup', {
    pageTitle: 'Penyiapan Administrator — Starfall Enigma',
    bodyClass: 'admin-auth-body',
    pageKey: 'admin-setup',
    noindex: true,
    adminUser: null,
    setup: true
  });
});

router.get('/admin/login', (req, res) => {
  const db = req.app.get('db');
  const adminBase = req.app.get('adminBase');
  if (getAdminCount(db) === 0) return res.redirect(`${adminBase}/setup`);
  if (req.user?.role === 'admin') return res.redirect(adminBase);
  res.render('admin/login', {
    pageTitle: 'Masuk Dasbor — Starfall Enigma',
    bodyClass: 'admin-auth-body',
    pageKey: 'admin-login',
    noindex: true,
    adminUser: null,
    setup: false
  });
});

router.get('/admin', requireAdmin, (req, res) => {
  res.render(ADMIN_PAGES.dashboard.view, {
    pageTitle: 'Ringkasan — Starfall Enigma',
    bodyClass: 'admin-body',
    pageKey: 'admin-dashboard',
    noindex: true,
    adminUser: templateUser(req.user),
    adminSection: 'dashboard',
    adminTitle: ADMIN_PAGES.dashboard.title,
    adminSubtitle: ADMIN_PAGES.dashboard.subtitle,
    adminScript: ADMIN_PAGES.dashboard.script
  });
});

for (const [section, page] of Object.entries(ADMIN_PAGES)) {
  if (section === 'dashboard') continue;
  router.get(page.path, requireAdmin, (req, res) => {
    res.render(page.view, {
      pageTitle: `${page.title} — Starfall Enigma`,
      bodyClass: 'admin-body',
      pageKey: `admin-${section}`,
      noindex: true,
      adminUser: templateUser(req.user),
      adminSection: section,
      adminTitle: page.title,
      adminSubtitle: page.subtitle,
      adminScript: page.script
    });
  });
}

module.exports = router;
