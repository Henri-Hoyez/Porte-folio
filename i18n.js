window.SiteI18n = (function () {
  'use strict';

  const STORAGE_KEY = 'site-lang';
  const SUPPORTED = ['fr', 'en'];
  let translations = {};
  let currentLang = 'fr';

  function getBasePath() {
    const path = window.location.pathname;
    if (path.includes('/blog/fr/') || path.includes('/blog/en/')) return '../../';
    if (path.includes('/blog/')) return '../';
    return '';
  }

  function detectLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const browser = (navigator.language || 'fr').toLowerCase();
    return browser.startsWith('fr') ? 'fr' : 'en';
  }

  function getNested(obj, key) {
    return key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : null), obj);
  }

  function t(key) {
    const value = getNested(translations[currentLang], key);
    if (value !== null && value !== undefined) return value;
    const fallback = getNested(translations.fr, key);
    return fallback !== null && fallback !== undefined ? fallback : key;
  }

  function applyTextNodes() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const value = t(key);
      if (value) el.textContent = value;
    });

    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      const value = t(key);
      if (value) el.innerHTML = value;
    });

    document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      const key = el.getAttribute('data-i18n-alt');
      const value = t(key);
      if (value) el.setAttribute('alt', value);
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      const value = t(key);
      if (value) el.setAttribute('title', value);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const value = t(key);
      if (value) el.setAttribute('placeholder', value);
    });

    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      const value = t(key);
      if (value) el.setAttribute('aria-label', value);
    });
  }

  function applyMeta() {
    const titleKey = document.documentElement.getAttribute('data-i18n-page-title');
    if (titleKey) document.title = t(titleKey);

    const descKey = document.documentElement.getAttribute('data-i18n-page-description');
    if (descKey) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', t(descKey));
    }
  }

  function applyLangBlocks() {
    document.querySelectorAll('[data-lang-block]').forEach((el) => {
      const blockLang = el.getAttribute('data-lang-block');
      const hide = blockLang !== currentLang;
      el.hidden = hide;
      el.classList.toggle('is-lang-hidden', hide);
      if (hide) {
        el.setAttribute('aria-hidden', 'true');
      } else {
        el.removeAttribute('aria-hidden');
      }
    });
  }

  function updateBlogLinks() {
    const blogPath = getBasePath() + 'blog/' + currentLang + '/index.html';
    document.querySelectorAll('[data-i18n-href="nav.blog"]').forEach((el) => {
      el.setAttribute('href', blogPath);
    });
  }

  function updateLangSwitcher() {
    document.querySelectorAll('[data-set-lang]').forEach((btn) => {
      const lang = btn.getAttribute('data-set-lang');
      const isActive = lang === currentLang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function injectLangSwitcher() {
    const menu = document.querySelector('.nav-menu');
    if (!menu || menu.querySelector('.lang-switcher')) return;

    const li = document.createElement('li');
    li.className = 'nav-item lang-switcher';
    li.innerHTML =
      '<div class="lang-toggle" role="group" aria-label="Language">' +
      '<button type="button" class="lang-btn" data-set-lang="fr">FR</button>' +
      '<button type="button" class="lang-btn" data-set-lang="en">EN</button>' +
      '</div>';
    menu.appendChild(li);

    li.querySelectorAll('[data-set-lang]').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.getAttribute('data-set-lang')));
    });
  }

  function injectLangSwitcherStandalone() {
    if (document.querySelector('.lang-switcher-standalone')) return;
    const container = document.querySelector('.coming-soon-lang') || document.body;
    const div = document.createElement('div');
    div.className = 'lang-switcher-standalone';
    div.innerHTML =
      '<div class="lang-toggle" role="group" aria-label="Language">' +
      '<button type="button" class="lang-btn" data-set-lang="fr">FR</button>' +
      '<button type="button" class="lang-btn" data-set-lang="en">EN</button>' +
      '</div>';
    container.prepend(div);
    div.querySelectorAll('[data-set-lang]').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.getAttribute('data-set-lang')));
    });
  }

  function applyAll() {
    document.documentElement.lang = currentLang;
    applyTextNodes();
    applyMeta();
    applyLangBlocks();
    updateBlogLinks();
    updateLangSwitcher();
    document.documentElement.classList.add('i18n-ready');
    window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: currentLang } }));
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang) || lang === currentLang) return;

    const path = window.location.pathname;
    if (/\/blog\/(fr|en)\//.test(path)) {
      localStorage.setItem(STORAGE_KEY, lang);
      window.location.assign(path.replace(/\/blog\/(fr|en)\//, '/blog/' + lang + '/'));
      return;
    }

    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyAll();
  }

  async function loadTranslations() {
    const base = getBasePath();
    const [fr, en] = await Promise.all([
      fetch(base + 'locales/fr.json').then((r) => r.json()),
      fetch(base + 'locales/en.json').then((r) => r.json()),
    ]);
    translations = { fr, en };
  }

  async function init() {
    currentLang = detectLang();

    const blogMatch = window.location.pathname.match(/\/blog\/(fr|en)(\/.*)?$/);
    if (blogMatch && blogMatch[1] !== currentLang) {
      window.location.replace(
        window.location.pathname.replace(/\/blog\/(fr|en)/, '/blog/' + currentLang)
      );
      return;
    }

    try {
      await loadTranslations();
    } catch (err) {
      console.error('i18n: impossible de charger les traductions', err);
      return;
    }

    if (document.querySelector('.nav-menu')) injectLangSwitcher();
    else if (document.body.classList.contains('coming-soon-page')) injectLangSwitcherStandalone();

    applyAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { setLang, t, getLang: () => currentLang };
})();
