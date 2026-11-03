/* GigaHertz - Barra de navegacion inferior (movil, compartida) */
(function () {
    'use strict';

    if (document.getElementById('appTabs')) return;
    if (window.__ghAppTabs) return;
    window.__ghAppTabs = true;

    var ICONS = {
        inicio: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
        productos: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        categorias: '<path d="M4 6h16M4 12h16M4 18h10"/>',
        carrito: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'
    };

    var css = [
        '.app-tabs{position:fixed;left:0;right:0;bottom:0;z-index:45;display:flex;align-items:center;justify-content:center;gap:2px;padding:7px 8px calc(7px + env(safe-area-inset-bottom));background:rgba(255,255,255,.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid #eef0f3;box-shadow:0 -10px 30px rgba(17,24,39,.07)}',
        '.app-tab{position:relative;display:flex;align-items:center;gap:7px;border:0;background:none;font-family:inherit;text-decoration:none;cursor:pointer;color:#6b7280;padding:9px 13px;border-radius:999px;font-size:12.5px;font-weight:700;transition:background-color 170ms ease,color 170ms ease,transform 140ms cubic-bezier(.23,1,.32,1)}',
        '.app-tab>svg{width:22px;height:22px;flex-shrink:0}',
        '.app-tab-label{max-width:0;overflow:hidden;white-space:nowrap;opacity:0;transition:max-width 240ms cubic-bezier(.23,1,.32,1),opacity 160ms ease}',
        '.app-tab.is-active{color:#6d28d9;background:#ede9fe}',
        '.app-tab.is-active .app-tab-label{max-width:130px;opacity:1}',
        '.app-tab:active{transform:scale(.95)}',
        '.app-tab-badge{position:absolute;top:3px;right:8px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#7c3aed;color:#fff;font-size:9.5px;font-weight:800;line-height:16px;text-align:center}',
        '@media (min-width:1024px){.app-tabs{display:none}}',
        '@media (max-width:1023.98px){body.has-app-tabs{padding-bottom:calc(58px + env(safe-area-inset-bottom))}.btt{bottom:calc(74px + env(safe-area-inset-bottom))}}',
        '@media (prefers-reduced-motion:reduce){.app-tab,.app-tab-label{transition:none}}'
    ].join('');

    var style = document.createElement('style');
    style.id = 'appTabsStyle';
    style.textContent = css;
    document.head.appendChild(style);

    function svg(inner) {
        return '<svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">' + inner + '</svg>';
    }

    var TABS = [
        { tab: 'inicio', label: 'Inicio', href: 'index.html' },
        { tab: 'productos', label: 'Productos', href: 'catalogo.html' },
        { tab: 'categorias', label: 'Categorías', id: 'tabCat' },
        { tab: 'carrito', label: 'Carrito', id: 'tabCart' }
    ];

    var nav = document.createElement('nav');
    nav.id = 'appTabs';
    nav.className = 'app-tabs';
    nav.setAttribute('aria-label', 'Navegación inferior');

    nav.innerHTML = TABS.map(function (t) {
        var inner = svg(ICONS[t.tab]) + '<span class="app-tab-label">' + t.label + '</span>';
        if (t.tab === 'carrito') {
            inner += '<span class="app-tab-badge" id="tabCartBadge" hidden>0</span>';
        }
        if (t.href) {
            return '<a class="app-tab" href="' + t.href + '" data-tab="' + t.tab + '">' + inner + '</a>';
        }
        return '<button type="button" class="app-tab" data-tab="' + t.tab + '" id="' + t.id + '">' + inner + '</button>';
    }).join('');

    function mount() {
        document.body.appendChild(nav);
        document.body.classList.add('has-app-tabs');

        var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        var ACTIVE = { 'index.html': 'inicio', '': 'inicio', 'catalogo.html': 'productos', 'checkout.html': 'carrito' };
        var active = ACTIVE[page] || '';
        if (active) {
            var t = nav.querySelector('.app-tab[data-tab="' + active + '"]');
            if (t) t.classList.add('is-active');
        }

        var tabCat = nav.querySelector('[data-tab="categorias"]');
        var tabCart = nav.querySelector('[data-tab="carrito"]');
        var badge = document.getElementById('tabCartBadge');

        if (tabCat) tabCat.addEventListener('click', function () {
            if (window.ghOpenCat) { window.ghOpenCat(); return; }
            location.href = 'catalogo.html';
        });

        if (tabCart) tabCart.addEventListener('click', function () {
            var nc = document.getElementById('navCart');
            if (nc) { nc.click(); return; }
            if (page !== 'checkout.html') location.href = 'checkout.html';
        });

        function syncBadge() {
            if (!badge) return;
            var c = window.GigaCart ? GigaCart.count() : 0;
            badge.textContent = c > 99 ? '99+' : String(c);
            badge.hidden = c === 0;
        }
        window.addEventListener('cart:change', syncBadge);
        syncBadge();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
