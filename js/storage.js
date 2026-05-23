/**
 * storage.js – Camada de cache local
 *
 * Responsável por:
 *  - Ler/gravar dados no localStorage
 *  - TTL (time-to-live) configurável por chave
 *  - Fallback silencioso quando storage não está disponível
 *  - API simples e síncrona para o resto do app
 */

const Storage = (() => {
  const PREFIX = 'bairro_';
  const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutos

  /**
   * Verifica se localStorage está disponível
   */
  function _isAvailable() {
    try {
      localStorage.setItem('__test__', '1');
      localStorage.removeItem('__test__');
      return true;
    } catch (_) {
      return false;
    }
  }

  const available = _isAvailable();

  /**
   * Salva dado com timestamp de expiração
   * @param {string} key
   * @param {*} value  – qualquer dado serializável em JSON
   * @param {number} [ttl] – milissegundos até expirar (padrão: 30 min)
   */
  function set(key, value, ttl = DEFAULT_TTL) {
    if (!available) return;
    try {
      const entry = {
        data: value,
        expires: Date.now() + ttl
      };
      localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch (e) {
      // Quota excedida: limpa entradas antigas e tenta de novo
      _evictOldest();
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify({ data: value, expires: Date.now() + ttl }));
      } catch (_) { /* sem espaço, ignora */ }
    }
  }

  /**
   * Recupera dado se ainda válido
   * @param {string} key
   * @returns {*|null}  – dado ou null (expirado / não encontrado)
   */
  function get(key) {
    if (!available) return null;
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() > entry.expires) {
        localStorage.removeItem(PREFIX + key);
        return null;
      }
      return entry.data;
    } catch (_) {
      return null;
    }
  }

  /**
   * Remove item do cache
   * @param {string} key
   */
  function remove(key) {
    if (!available) return;
    localStorage.removeItem(PREFIX + key);
  }

  /**
   * Remove todas as entradas do app (prefixo)
   */
  function clear() {
    if (!available) return;
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }

  /**
   * Remove a entrada mais antiga para liberar espaço
   */
  function _evictOldest() {
    if (!available) return;
    let oldest = null;
    let oldestTime = Infinity;
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(PREFIX)) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(k));
        if (entry.expires < oldestTime) {
          oldestTime = entry.expires;
          oldest = k;
        }
      } catch (_) { /* entrada corrompida, remove */ oldest = k; break; }
    }
    if (oldest) localStorage.removeItem(oldest);
  }

  return { set, get, remove, clear };
})();
