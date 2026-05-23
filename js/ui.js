/**
 * ui.js – Renderização e utilitários de interface
 *
 * Responsável por:
 *  - Gerar HTML dos cards (rua, empresa, produto, mapa)
 *  - Atualizar header, badges e painel do carrinho
 *  - Animações de transição entre views
 *  - Mapa Leaflet (init/destroy)
 */

const UI = (() => {

  /* ─── Ícones por tipo de empresa ─── */
  const TYPE_ICONS = {
    food:     'restaurant',
    market:   'shopping_basket',
    pharmacy: 'medication',
    workshop: 'build',
    service:  'content_cut'
  };

  function iconForType(type) {
    return TYPE_ICONS[type] || 'store';
  }

  /* ─── Formatação de preço ─── */
  function formatPrice(value) {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /* ─────────────────────────────────────────────
     HEADER
  ───────────────────────────────────────────── */
  function setHeader(title, showBack) {
    document.getElementById('header-title').textContent = title;
    const btn = document.getElementById('back-btn');
    const ph  = document.getElementById('back-placeholder');
    btn.style.display = showBack ? 'inline-flex' : 'none';
    ph.style.display  = showBack ? 'none' : 'block';
  }

  /* ─────────────────────────────────────────────
     VIEWS – transição slide
  ───────────────────────────────────────────── */
  const VIEWS = ['view-streets', 'view-businesses', 'view-details'];
  const VIEW_NAMES = { streets: 0, businesses: 1, details: 2 };

  function transitionTo(viewName) {
    const targetIndex = VIEW_NAMES[viewName];
    VIEWS.forEach((id, i) => {
      const el = document.getElementById(id);
      el.className = 'view ' + (
        i === targetIndex ? 'view-current'
        : i < targetIndex  ? 'view-left'
        :                    'view-right'
      );
    });
  }

  /* ─────────────────────────────────────────────
     RUAS – lista
  ───────────────────────────────────────────── */
  function renderStreets(streets) {
    const container = document.getElementById('streets-list');
    if (!streets.length) {
      container.innerHTML = '<div class="empty-note">Nenhuma rua encontrada. Verifique a conexão.</div>';
      return;
    }
    container.innerHTML = streets.map(street => `
      <article class="street-card" data-street-id="${street.id}" tabindex="0" role="button" aria-label="Abrir ${street.name}">
        <div class="avatar">
          <span class="material-icons">${_esc(street.icon)}</span>
        </div>
        <div class="card-main">
          <h2 class="card-title">${_esc(street.name)}</h2>
          <p class="card-subtitle">${_esc(street.description)}</p>
        </div>
        <div class="counter-badge">${street.businessCount ?? '…'}</div>
      </article>
    `).join('');
  }

  /* ─────────────────────────────────────────────
     EMPRESAS – lista
  ───────────────────────────────────────────── */
  function renderBusinesses(businesses) {
    const container = document.getElementById('businesses-list');
    if (!businesses || !businesses.length) {
      container.innerHTML = '<div class="empty-note">Nenhuma empresa encontrada nesta rua.</div>';
      return;
    }
    container.innerHTML = businesses.map(b => `
      <article class="business-card" data-business-id="${b.id}" tabindex="0" role="button" aria-label="Abrir ${b.name}">
        <div class="avatar">
          <span class="material-icons">${iconForType(b.type)}</span>
        </div>
        <div class="card-main">
          <div class="business-top">
            <h2 class="card-title">${_esc(b.name)}</h2>
            <span class="category-pill">${_esc(b.category)}</span>
          </div>
          <p class="card-subtitle">${_esc(b.description)}</p>
          <p class="card-meta">${_esc(b.address)} · ${_esc(b.city)}/${_esc(b.state)}</p>
          <p class="card-meta">${b.products && b.products.length ? b.products.length + ' produtos disponíveis' : 'Atendimento por contato direto'}</p>
        </div>
      </article>
    `).join('');
  }

  /* ─────────────────────────────────────────────
     DETALHES – produtos OU mapa
  ───────────────────────────────────────────── */
  function renderDetails(business) {
    const container = document.getElementById('details-content');

    if (business.products && business.products.length) {
      // Visão: lista de produtos
      container.innerHTML = `
        <p class="section-title">Produtos disponíveis</p>
        ${business.products.map(p => `
          <article class="product-card">
            <h3>${_esc(p.name)}</h3>
            <p class="product-description">${_esc(p.description)}</p>
            <div class="product-price-row">
              <div class="price">${formatPrice(p.price)}</div>
              <button class="add-btn" data-product-id="${p.id}" data-product-name="${_attr(p.name)}" data-product-price="${p.price}">Adicionar</button>
            </div>
            <div style="clear:both"></div>
          </article>
        `).join('')}
      `;
    } else {
      // Visão: mapa + contato
      container.innerHTML = `
        <p class="section-title">Localização da empresa</p>
        <div class="empty-note">Esta empresa não possui produtos cadastrados. Veja a localização no mapa e entre em contato diretamente.</div>
        <article class="map-card">
          <h3>${_esc(business.name)}</h3>
          <div class="map-info">
            <p class="product-description">${_esc(business.description)}</p>
            <p class="product-description">${_esc(business.address)} · ${_esc(business.city)}/${_esc(business.state)}</p>
            <p class="product-description">Telefone: ${_esc(business.phone)}</p>
          </div>
          <div id="leaflet-map" class="map-box"></div>
          <button class="contact-btn" data-phone="${_attr(business.phone)}">Entrar em contato</button>
        </article>
      `;
    }
  }

  /* ─────────────────────────────────────────────
     MAPA LEAFLET
  ───────────────────────────────────────────── */
  let _map = null;
  let _marker = null;

  function initMap(business) {
    destroyMap();
    const mapEl = document.getElementById('leaflet-map');
    if (!mapEl) return;

    _map = L.map('leaflet-map', { zoomControl: true }).setView([business.lat, business.lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(_map);
    _marker = L.marker([business.lat, business.lng]).addTo(_map);
    _marker.bindPopup(`<strong>${business.name}</strong><br>${business.address}`).openPopup();
    setTimeout(() => { if (_map) _map.invalidateSize(); }, 250);
  }

  function destroyMap() {
    if (_map) {
      _map.remove();
      _map = null;
      _marker = null;
    }
  }

  /* ─────────────────────────────────────────────
     CARRINHO – renders
  ───────────────────────────────────────────── */
  function renderCart(cart) {
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

    // Badge FAB
    const fab   = document.getElementById('cart-fab');
    const badge = document.getElementById('fab-badge');
    fab.style.display  = count > 0 ? 'flex' : 'none';
    badge.textContent  = count;

    // Badge painel
    document.getElementById('cart-count-badge').textContent = count;

    // Total
    document.getElementById('cart-total').textContent = formatPrice(total);

    // Botão finalizar
    document.getElementById('checkout-btn').disabled = cart.length === 0;

    // Itens
    const itemsEl = document.getElementById('cart-items');
    if (!cart.length) {
      itemsEl.innerHTML = '<div class="empty-note" style="margin-bottom:0;">Seu carrinho está vazio no momento.</div>';
      return;
    }

    itemsEl.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="qty-box">${item.qty}x</div>
        <div class="cart-item-main">
          <p class="cart-item-name">${_esc(item.name)}</p>
          <p class="cart-item-meta">${formatPrice(item.price)} cada</p>
          <p class="cart-item-meta">Subtotal: ${formatPrice(item.price * item.qty)}</p>
        </div>
        <button class="remove-btn" data-remove-id="${item.id}">Remover</button>
      </div>
    `).join('');
  }

  function openCartPanel() {
    document.getElementById('cart-panel').classList.add('active');
    document.getElementById('overlay').classList.add('active');
  }

  function closeCartPanel() {
    document.getElementById('cart-panel').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
  }

  /* ─────────────────────────────────────────────
     Helpers de escape (XSS prevention)
  ───────────────────────────────────────────── */
  function _esc(str) {
    return String(str ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function _attr(str) {
    return String(str ?? '').replace(/"/g,'&quot;');
  }

  return {
    setHeader,
    transitionTo,
    renderStreets,
    renderBusinesses,
    renderDetails,
    initMap,
    destroyMap,
    renderCart,
    openCartPanel,
    closeCartPanel,
    formatPrice
  };
})();
