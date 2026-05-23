/**
 * api.js – Camada de API local (fetch + cache)
 *
 * Responsável por:
 *  - Carregar ruas.json (índice de ruas)
 *  - Carregar ruas/rua-{id}.json (dados completos da rua, lazy)
 *  - Fallback offline silencioso
 *  - Integração com Storage para cache
 *
 * Preparado para:
 *  - Vercel static hosting
 *  - Atualização via Google Apps Script (sobrescreve os JSON)
 */

const API = (() => {
  // Ajuste para Vercel: usa caminhos relativos à raiz do projeto
  const BASE = './dados';

  // TTLs de cache
  const TTL_STREETS_INDEX = 5 * 60 * 1000;    // 5 min para o índice
  const TTL_STREET_DETAIL = 15 * 60 * 1000;   // 15 min por rua

  /**
   * Fetch genérico com tratamento de erro
   * @param {string} url
   * @returns {Promise<any|null>}
   */
  async function _fetchJSON(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[API] Falha ao carregar ${url}:`, err.message);
      return null;
    }
  }

  /**
   * Carrega o índice de ruas (ruas.json)
   * Retorna array com metadados de cada rua (sem empresas completas)
   *
   * @returns {Promise<Array>}
   */
  async function getStreets() {
    const cacheKey = 'streets_index';
    const cached = Storage.get(cacheKey);
    if (cached) return cached;

    const data = await _fetchJSON(`${BASE}/ruas.json`);
    if (data) {
      Storage.set(cacheKey, data, TTL_STREETS_INDEX);
      return data;
    }

    // fallback: retorna array vazio sem quebrar o app
    return [];
  }

  /**
   * Carrega os dados completos de uma rua (empresas + produtos)
   * Lazy: só executa quando o usuário abre a rua
   *
   * @param {number|string} streetId
   * @returns {Promise<Object|null>}
   */
  async function getStreet(streetId) {
    const cacheKey = `street_${streetId}`;
    const cached = Storage.get(cacheKey);
    if (cached) return cached;

    const data = await _fetchJSON(`${BASE}/ruas/rua-${streetId}.json`);
    if (data) {
      Storage.set(cacheKey, data, TTL_STREET_DETAIL);
      return data;
    }

    return null;
  }

  /**
   * (Extensível) Carregaria empresa individual se os dados forem muito grandes
   * para justificar granularidade ainda maior.
   * Por enquanto delega para getStreet().
   *
   * @param {number|string} streetId
   * @param {number|string} businessId
   * @returns {Promise<Object|null>}
   */
  async function getBusiness(streetId, businessId) {
    const street = await getStreet(streetId);
    if (!street) return null;
    return (street.businesses || []).find(b => b.id == businessId) || null;
  }

  return { getStreets, getStreet, getBusiness };
})();
