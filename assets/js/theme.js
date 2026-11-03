(function () {
    'use strict';

    var KEY = 'gh_theme';
    var THEME_DEFAULT_KEY = 'gh_store_default_theme';
    var root = document.documentElement;
    var mq = null;
    var current = 'light';

    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) { mq = null; }

    function stored() {
        try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; }
        catch (e) { return null; }
    }

    function normalize(t) { return t === 'dark' ? 'dark' : 'light'; }

    function cachedDefault() {
        try {
            var v = localStorage.getItem(THEME_DEFAULT_KEY);
            return v === 'dark' || v === 'light' ? v : null;
        } catch (e) { return null; }
    }

    // Tema base configurado por el admin. Manda sobre la preferencia del
    // sistema: si la tienda abre en claro, se ve claro aunque el SO esté oscuro.
    var defaultTheme = cachedDefault() || 'light';

    function setDefault(theme) {
        defaultTheme = normalize(theme);
        try { localStorage.setItem(THEME_DEFAULT_KEY, defaultTheme); } catch (e) {}
        if (!stored()) apply(defaultTheme, false);
    }

    function apply(theme, persist) {
        current = theme === 'dark' ? 'dark' : 'light';
        root.classList.toggle('dark', current === 'dark');
        root.setAttribute('data-theme', current);
        if (persist) { try { localStorage.setItem(KEY, current); } catch (e) {} }
        syncButton();
        try { window.dispatchEvent(new CustomEvent('theme:change', { detail: { theme: current } })); } catch (e) {}
    }

    // Aplica lo antes posible para evitar parpadeo
    apply(stored() || defaultTheme, false);

    var SUN = '<svg class="gh-ico gh-ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    var MOON = '<svg class="gh-ico gh-ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    var btn = null;

    function syncButton() {
        if (!btn) return;
        var dark = current === 'dark';
        btn.setAttribute('aria-pressed', String(dark));
        var label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
        btn.title = label;
        btn.setAttribute('aria-label', label);
    }

    function toggle() {
        apply(current === 'dark' ? 'light' : 'dark', true);
    }

    function findAnchor() {
        var nav = document.querySelector('nav.fixed.top-0') || document.querySelector('header nav') || document.querySelector('nav');
        if (!nav) return null;
        var kids = Array.prototype.slice.call(nav.children).filter(function (el) { return el.nodeType === 1; });
        for (var i = kids.length - 1; i >= 0; i--) {
            if (kids[i].querySelector && kids[i].querySelector('button, a[title="Carrito"], a[title="Carrito "]')) return kids[i];
        }
        return kids[kids.length - 1] || nav;
    }

    function mount() {
        var anchor = findAnchor();
        btn = document.createElement('button');
        btn.id = 'ghThemeToggle';
        btn.type = 'button';
        btn.className = 'gh-theme-toggle';
        btn.innerHTML = SUN + MOON;
        btn.addEventListener('click', toggle);
        if (anchor && anchor.classList && /flex/.test(anchor.className)) {
            anchor.insertBefore(btn, anchor.firstChild);
        } else if (anchor) {
            anchor.appendChild(btn);
        } else {
            btn.classList.add('gh-theme-float');
            document.body.appendChild(btn);
        }
        syncButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }

    if (mq && mq.addEventListener) {
        mq.addEventListener('change', function () { if (!stored()) apply(defaultTheme, false); });
    }

    try {
        window.addEventListener('storage', function (e) {
            if (e.key === KEY && e.newValue) {
                apply(e.newValue, false);
            }
        });
    } catch (e) {}

    // BFCache: al volver con Atras/Adelante o restaurar la pestana, el navegador
    // muestra la pagina congelada (con el tema antiguo) sin re-ejecutar scripts.
    // pageshow con persisted=true detecta esa restauracion y vuelve a aplicar
    // la preferencia guardada (localStorage) para que no quede desincronizada.
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) apply(stored() || defaultTheme, false);
    });

    window.GHTheme = {
        get: function () { return current; },
        getDefault: function () { return defaultTheme; },
        setDefault: setDefault,
        set: function (t) { apply(t, true); },
        toggle: toggle
    };
})();
