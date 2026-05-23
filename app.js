/**
 * app.js – Lógica principal do aplicativo
 *
 * Responsável por:
 *  - Estado da aplicação (view atual, seleções, carrinho)
 *  - Delegação de eventos (event delegation no DOM)
 *  - Orquestração entre API, Storage e UI
 *  - Checkout via WhatsApp
 */

(async function App() {
  /* ─────────────────────────────────────────────
     ESTADO
  ───────────────────────────────────────────── */
  let currentView     = 'streets';
  let selectedStreet  = null;   // metadados da rua (índice)
  let selectedBusiness = null;  // objeto completo da empresa
  let cart = [];

  /* ─────────────────────────────────────────────
     BOOT: carrega índice de ruas
  ───────────────────────────────────────────── */
  const streets = await API.getStreets();
  UI.renderStreets(streets);
  UI.setHeader('Comércio do Bairro', false);

  /* ─────────────────────────────────────────────
     NAVEGAÇÃO
  ───────────────────────────────────────────── */
  async function goToStreet(streetId) {
    // Encontra metadados no índice
    const meta = streets.find(s => s.id == streetId);
    if (!meta) return;

    // Lazy load: busca dados completos da rua
    const streetData = await API.getStreet(streetId);
    if (!streetData) {
      alert('Não foi possível carregar esta rua. Verifique sua conexão.');
      return;
    }

    selectedStreet   = streetData;
    selectedBusiness = null;
    currentView      = 'businesses';

    UI.setHeader(streetData.name, true);
    UI.renderBusinesses(streetData.businesses || []);
    UI.transitionTo('businesses');
    UI.closeCartPanel();
  }

  function goToBusiness(businessId) {
    if (!selectedStreet) return;
    const business = (selectedStreet.businesses || []).find(b => b.id == businessId);
    if (!business) return;

    selectedBusiness = business;
    currentView = 'details';

    UI.setHeader(business.name, true);
    UI.renderDetails(business);
    UI.transitionTo('details');
    UI.closeCartPanel();

    // Inicia mapa se a empresa não tem produtos
    if (!business.products || !business.products.length) {
      requestAnimationFrame(() => UI.initMap(business));
    }
  }

  function goBack() {
    if (currentView === 'details') {
      UI.destroyMap();
      currentView = 'businesses';
      UI.setHeader(selectedStreet ? selectedStreet.name : 'Empresas', true);
      UI.transitionTo('businesses');
      return;
    }
    if (currentView === 'businesses') {
      currentView = 'streets';
      selectedStreet = null;
      UI.setHeader('Comércio do Bairro', false);
      UI.transitionTo('streets');
    }
  }

  /* ─────────────────────────────────────────────
     CARRINHO
  ───────────────────────────────────────────── */
  function addToCart(productId, name, price) {
    const existing = cart.find(i => i.id == productId);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ id: productId, name, price: parseFloat(price), qty: 1 });
    }
    UI.renderCart(cart);
  }

  function removeFromCart(productId) {
    cart = cart.filter(i => i.id != productId);
    UI.renderCart(cart);
  }

  function checkoutWhatsApp() {
    if (!cart.length || !selectedBusiness) return;
    const phone = selectedBusiness.phone.replace(/\D/g, '');
    const items = cart
      .map(i => `- ${i.qty}x ${i.name} (${UI.formatPrice(i.price * i.qty)})`)
      .join('%0A');
    const total = encodeURIComponent(UI.formatPrice(cart.reduce((s, i) => s + i.price * i.qty, 0)));
    const msg = `Olá, ${encodeURIComponent(selectedBusiness.name)}!%0AQuero finalizar este pedido:%0A%0A${encodeURIComponent(items.replace(/%0A/g,'\n'))}%0A%0ATotal: ${total}`;
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
  }

  function callBusiness(phone) {
    window.location.href = `tel:${phone.replace(/\D/g, '')}`;
  }

  /* ─────────────────────────────────────────────
     EVENT DELEGATION – um único listener por área
  ───────────────────────────────────────────── */

  // Header – botão voltar
  document.getElementById('back-btn').addEventListener('click', goBack);

  // Views – cliques em cards
  document.querySelector('.view-stage').addEventListener('click', e => {
    // Rua
    const streetCard = e.target.closest('[data-street-id]');
    if (streetCard) { goToStreet(streetCard.dataset.streetId); return; }

    // Empresa
    const bizCard = e.target.closest('[data-business-id]');
    if (bizCard) { goToBusiness(bizCard.dataset.businessId); return; }

    // Adicionar produto ao carrinho
    const addBtn = e.target.closest('.add-btn');
    if (addBtn) {
      addToCart(addBtn.dataset.productId, addBtn.dataset.productName, addBtn.dataset.productPrice);
      return;
    }

    // Remover do carrinho
    const removeBtn = e.target.closest('[data-remove-id]');
    if (removeBtn) { removeFromCart(removeBtn.dataset.removeId); return; }

    // Contato (telefone)
    const contactBtn = e.target.closest('.contact-btn');
    if (contactBtn) { callBusiness(contactBtn.dataset.phone); return; }

    // FAB Carrinho
    if (e.target.closest('#cart-fab')) { UI.openCartPanel(); return; }

    // Overlay (fechar carrinho)
    if (e.target.closest('#overlay')) { UI.closeCartPanel(); return; }

    // Checkout WhatsApp
    if (e.target.closest('#checkout-btn')) { checkoutWhatsApp(); return; }
  });

  // Inicializa render do carrinho (garante estado inicial correto)
  UI.renderCart(cart);

})();
