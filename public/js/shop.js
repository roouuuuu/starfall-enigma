'use strict';

(function () {
  const app = window.SEApp;
  const state = window.SE || {};
  if (!app) return;

  const lang = state.lang === 'id' ? 'id' : 'en';
  const copy = {
    en: {
      showing: 'Showing {shown} of {total}',
      allPieces: 'All pieces',
      search: 'Search',
      category: 'Category',
      collection: 'Collection',
      material: 'Material',
      size: 'Size',
      availability: 'Availability',
      price: 'Price',
      from: 'from',
      to: 'to',
      clear: 'Clear',
      loading: 'Loading the next pieces…',
      error: 'The archive could not be loaded. Please try again.',
      applied: 'Filter applied',
      inStock: 'In stock',
      lowStock: 'Low stock',
      soldOut: 'Sold out'
    },
    id: {
      showing: 'Menampilkan {shown} dari {total}',
      allPieces: 'Semua karya',
      search: 'Pencarian',
      category: 'Kategori',
      collection: 'Koleksi',
      material: 'Material',
      size: 'Ukuran',
      availability: 'Ketersediaan',
      price: 'Harga',
      from: 'dari',
      to: 'sampai',
      clear: 'Hapus',
      loading: 'Memuat karya berikutnya…',
      error: 'Arsip tidak dapat dimuat. Silakan coba lagi.',
      applied: 'Filter diterapkan',
      inStock: 'Tersedia',
      lowStock: 'Stok terbatas',
      soldOut: 'Habis'
    }
  }[lang];

  const root = document.querySelector('[data-shop-root]');
  if (!root) return;

  const grid = root.querySelector('[data-shop-grid]');
  const loadMore = root.querySelector('[data-shop-load-more]');
  const endNote = root.querySelector('[data-shop-end-note]');
  const resultLabel = root.querySelector('[data-shop-result-label]');
  const filtersPanel = root.querySelector('[data-shop-filters-panel]');
  const filterForm = root.querySelector('[data-shop-filters]');
  const filterToggle = root.querySelector('[data-filter-toggle]');
  const sortSelect = root.querySelector('[data-shop-sort]');
  const chipsWrap = root.querySelector('[data-active-filters]');
  const empty = root.querySelector('[data-shop-empty]');
  const categoryFromPath = root.dataset.category || '';
  const initialShown = grid ? grid.querySelectorAll('[data-product-card]').length : 0;
  let page = 1;
  let total = initialShown;
  let totalPages = 1;
  let loading = false;
  let filterOpener = null;

  function moneyLabel(value) {
    if (!value) return '';
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    if ((document.body.dataset.currency || state.currency) === 'IDR') {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
    }
    return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(number)}`;
  }

  function labelFor(name, value) {
    if (!filterForm) return value;
    const input = filterForm.querySelector(`[name="${name}"][value="${CSS.escape ? CSS.escape(value) : value}"]`);
    if (!input) return value;
    const wrapper = input.closest('label');
    if (wrapper) {
      const span = wrapper.querySelector('span');
      if (span) return span.textContent.trim();
    }
    const option = input.tagName === 'OPTION' ? input : filterForm.querySelector(`select[name="${name}"] option[value="${CSS.escape ? CSS.escape(value) : value}"]`);
    return option ? option.textContent.replace(/\s*\(\d+\)\s*$/, '').trim() : value;
  }

  function currentParams(includePage) {
    const params = new URLSearchParams();
    const source = new URLSearchParams(window.location.search);
    const add = (key, value) => {
      if (value == null || value === '') return;
      params.append(key, value);
    };
    ['search', 'material', 'size', 'availability', 'minPrice', 'maxPrice', 'sort', 'new'].forEach((key) => add(key, source.get(key)));
    const categoryValues = source.getAll('category').filter(Boolean);
    const categories = categoryValues.length ? categoryValues : (categoryFromPath ? [categoryFromPath] : []);
    categories.forEach((category) => add('category', category));
    source.getAll('collection').filter(Boolean).forEach((collection) => add('collection', collection));
    if (includePage) add('page', source.get('page') || String(page));
    return params;
  }

  function navigate(params) {
    params.delete('page');
    const query = params.toString();
    window.location.assign(query ? `/shop?${query}` : '/shop');
  }

  function renderChips() {
    if (!chipsWrap) return;
    chipsWrap.innerHTML = '';
    const params = currentParams(false);
    const chips = [];
    if (params.get('search')) chips.push({ key: 'search', value: params.get('search'), label: `${copy.search}: “${params.get('search')}”` });
    params.getAll('category').forEach((value) => chips.push({ key: 'category', value, label: `${copy.category}: ${labelFor('category', value)}` }));
    params.getAll('collection').forEach((value) => chips.push({ key: 'collection', value, label: `${copy.collection}: ${labelFor('collection', value)}` }));
    if (params.get('material')) chips.push({ key: 'material', value: params.get('material'), label: `${copy.material}: ${labelFor('material', params.get('material'))}` });
    if (params.get('size')) chips.push({ key: 'size', value: params.get('size'), label: `${copy.size}: ${params.get('size')}` });
    if (params.get('availability')) {
      const labels = { in: copy.inStock, low: copy.lowStock, out: copy.soldOut };
      chips.push({ key: 'availability', value: params.get('availability'), label: `${copy.availability}: ${labels[params.get('availability')] || params.get('availability')}` });
    }
    if (params.get('minPrice') || params.get('maxPrice')) {
      const value = `${params.get('minPrice') ? moneyLabel(params.get('minPrice')) : '0'} — ${params.get('maxPrice') ? moneyLabel(params.get('maxPrice')) : '∞'}`;
      chips.push({ key: 'price', value: '', label: `${copy.price}: ${value}` });
    }
    if (!chips.length) return;
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'filter-chip filter-chip--clear';
    clear.textContent = copy.clear;
    clear.addEventListener('click', () => navigate(new URLSearchParams()));
    chipsWrap.appendChild(clear);
    for (const chip of chips) {
      const button = document.createElement('span');
      button.className = 'filter-chip';
      button.innerHTML = `${app.escapeHTML(chip.label)}<button type="button" aria-label="${app.escapeAttr(`${copy.clear} ${chip.label}`)}">×</button>`;
      button.querySelector('button').addEventListener('click', () => {
        const next = currentParams(false);
        if (chip.key === 'price') {
          next.delete('minPrice');
          next.delete('maxPrice');
        } else {
          const values = next.getAll(chip.key).filter((value) => value !== chip.value);
          next.delete(chip.key);
          values.forEach((value) => next.append(chip.key, value));
        }
        navigate(next);
      });
      chipsWrap.appendChild(button);
    }
  }

  function openFilters() {
    if (!filtersPanel) return;
    filterOpener = document.activeElement;
    filtersPanel.classList.add('is-open');
    if (filterToggle) filterToggle.setAttribute('aria-expanded', 'true');
    app.syncOverlayLock();
    const input = filtersPanel.querySelector('input, select, button');
    if (input) input.focus({ preventScroll: true });
  }

  function closeFilters() {
    if (!filtersPanel) return;
    filtersPanel.classList.remove('is-open');
    if (filterToggle) filterToggle.setAttribute('aria-expanded', 'false');
    const opener = filterOpener;
    filterOpener = null;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    app.syncOverlayLock();
  }

  function updateResultLabel(shown) {
    if (!resultLabel) return;
    resultLabel.textContent = app.interpolate(copy.showing, { shown, total });
  }

  async function loadNext() {
    if (!loadMore || loading) return;
    loading = true;
    const original = loadMore.textContent;
    loadMore.disabled = true;
    loadMore.textContent = copy.loading;
    const nextPage = page + 1;
    const params = currentParams(false);
    params.set('limit', '12');
    params.set('page', String(nextPage));
    try {
      const data = await app.apiFetch(`/api/products?${params.toString()}`);
      if (grid) grid.insertAdjacentHTML('beforeend', (data.items || []).map(app.productCardHTML).join(''));
      app.updateWishlistButtons();
      page = data.page || nextPage;
      total = data.total || total;
      totalPages = data.totalPages || totalPages;
      const shown = grid ? grid.querySelectorAll('[data-product-card]').length : 0;
      updateResultLabel(shown);
      if (empty) empty.hidden = shown > 0;
      if (!data.hasMore) {
        loadMore.hidden = true;
        if (endNote) endNote.hidden = false;
      }
    } catch (error) {
      app.toast(error.message || copy.error, 'error');
    } finally {
      loading = false;
      loadMore.disabled = false;
      loadMore.textContent = original;
    }
  }

  if (filterToggle) filterToggle.addEventListener('click', openFilters);
  root.querySelectorAll('[data-filter-close]').forEach((button) => button.addEventListener('click', closeFilters));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && filtersPanel && filtersPanel.classList.contains('is-open')) closeFilters();
  });

  if (filterForm) {
    filterForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(filterForm);
      const params = new URLSearchParams();
      const values = (key) => data.getAll(key).map((value) => String(value).trim()).filter(Boolean);
      if (values('search').length) params.set('search', values('search')[0]);
      values('category').forEach((value) => params.append('category', value));
      values('collection').forEach((value) => params.append('collection', value));
      if (values('material').length) params.set('material', values('material')[0]);
      if (values('size').length) params.set('size', values('size')[0]);
      if (values('availability').length) params.set('availability', values('availability')[0]);
      if (values('minPrice').length) params.set('minPrice', values('minPrice')[0]);
      if (values('maxPrice').length) params.set('maxPrice', values('maxPrice')[0]);
      const sort = sortSelect ? sortSelect.value : new URLSearchParams(window.location.search).get('sort');
      if (sort && sort !== 'featured') params.set('sort', sort);
      if (new URLSearchParams(window.location.search).get('new') === '1') params.set('new', '1');
      navigate(params);
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      const params = currentParams(false);
      if (sortSelect.value === 'featured') params.delete('sort');
      else params.set('sort', sortSelect.value);
      navigate(params);
    });
  }

  if (loadMore) loadMore.addEventListener('click', loadNext);

  const initialPage = Number(new URLSearchParams(window.location.search).get('page') || 1);
  if (Number.isInteger(initialPage) && initialPage > 0) page = initialPage;
  updateResultLabel(initialShown);
  renderChips();
}());
