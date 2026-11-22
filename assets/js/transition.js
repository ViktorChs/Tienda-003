(function () {
    'use strict';

    var GRID_ID = 'gh-transition-grid';
    var STYLE_ID = 'gh-transition-style';
    var SQ = 'gh-grid-square';
    var GRID_BG = '#2A1B4D';
    var NAV_KEY = 'gh-transition-pending';
    var NAV_BG_KEY = 'gh-transition-bg';

    function gridBg() {
        if (window.GH_TRANSITION_BG) return window.GH_TRANSITION_BG;
        var dark = false;
        try { dark = document.documentElement.classList.contains('dark'); } catch (e) {}
        return dark ? '#3D2A6B' : '#F8F8FA';
    }
    var TRANSITION = 280;
    var TOTAL = 380;
    var HOLD = 260;
    var SPREAD = TOTAL * 0.7;

    var grid = null;
    var squares = [];
    var cols = 16;
    var rows = 12;
    var busy = false;
    var reduce = false;
    var auto = false;

    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches && window.GH_FORCE_REDUCED === true; } catch (e) { reduce = false; }
    try { auto = navigator.webdriver === true; } catch (e) { auto = false; }

    function skipped() {
        return reduce || window.GH_TRANSITION_ENABLED === false || (auto && !window.GH_FORCE_TRANSITION);
    }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        var s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent =
            '#' + GRID_ID + '{position:fixed;inset:-2px;z-index:9999;display:grid;opacity:0;visibility:hidden;pointer-events:none;}'
            + '#' + GRID_ID + '.active{opacity:1;visibility:visible;pointer-events:auto;}'
            + '.' + SQ + '{background-color:var(--gh-transition-bg,' + GRID_BG + ');transform:scale(0);transition:transform ' + TRANSITION + 'ms cubic-bezier(0.16,1,0.3,1);will-change:transform;width:101%;height:101%;}'
            + '.' + SQ + '.show{transform:scale(1.02);}'
            + '.' + SQ + '.hide{transform:scale(0);}';
        document.head.appendChild(s);
    }

    function computeGrid() {
        var w = window.innerWidth;
        if (w < 640) { cols = 10; rows = 14; }
        else if (w < 1024) { cols = 14; rows = 10; }
        else if (w <= 1920) { cols = 20; rows = 12; }
        else { cols = 24; rows = 14; }

        grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
        grid.style.gridTemplateRows = 'repeat(' + rows + ', 1fr)';
        grid.innerHTML = '';
        squares = [];
        var frag = document.createDocumentFragment();
        var total = cols * rows;
        for (var i = 0; i < total; i++) {
            var sq = document.createElement('div');
            sq.className = SQ;
            frag.appendChild(sq);
            squares.push(sq);
        }
        grid.appendChild(frag);
    }

    function ensureGrid() {
        if (!grid) {
            injectStyle();
            var existing = document.getElementById(GRID_ID);
            if (existing) { grid = existing; }
            else {
                grid = document.createElement('div');
                grid.id = GRID_ID;
                grid.setAttribute('aria-hidden', 'true');
                document.body.appendChild(grid);
            }
        }
        computeGrid();
    }

    function animate(isEntering, cb) {
        var maxSum = (rows - 1) + (cols - 1) || 1;
        squares.forEach(function (sq, index) {
            var row = Math.floor(index / cols);
            var col = index % cols;
            var delay = ((row + col) / maxSum) * SPREAD;
            setTimeout(function () {
                if (isEntering) { sq.classList.add('show'); sq.classList.remove('hide'); }
                else { sq.classList.remove('show'); sq.classList.add('hide'); }
            }, delay);
        });
        setTimeout(cb, SPREAD + TRANSITION);
    }

    function play(mid, done) {
        if (busy) {
            if (mid) mid();
            if (done) done();
            return;
        }
        ensureGrid();

        if (skipped()) {
            if (mid) mid();
            if (done) done();
            return;
        }

        busy = true;
        grid.style.setProperty('--gh-transition-bg', gridBg());
        grid.classList.add('active');
        animate(true, function () {
            if (mid) mid();
            setTimeout(function () {
                animate(false, function () {
                    grid.classList.remove('active');
                    busy = false;
                    if (done) done();
                });
            }, HOLD);
        });
    }

    function go(url) {
        if (!url) return;
        if (skipped()) { location.href = url; return; }
        try {
            sessionStorage.setItem(NAV_KEY, '1');
            sessionStorage.setItem(NAV_BG_KEY, window.GH_TRANSITION_BG || gridBg());
        } catch (e) {}
        play(null, function () { location.href = url; });
    }

    function navigable(e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
        var a = e.target.closest('a[href]');
        if (!a || a.hasAttribute('download') || a.dataset.noTransition != null) return false;
        if (a.target && a.target !== '_self') return false;
        var href = a.getAttribute('href');
        if (!href || /^(#|javascript:|mailto:|tel:|sms:|whatsapp:)/i.test(href)) return false;
        var url;
        try { url = new URL(a.href, location.href); } catch (err) { return false; }
        if (url.origin !== location.origin) return false;
        if (!/^https?:$/.test(url.protocol)) return false;
        if (url.pathname === location.pathname && url.search === location.search) return false;
        if (/\.(pdf|zip|rar|7z|doc|docx|xls|xlsx|png|jpe?g|gif|webp|svg|mp3|mp4|webm)$/i.test(url.pathname)) return false;
        return url.href;
    }

    function onLinkClick(e) {
        var url = navigable(e);
        if (!url) return;
        e.preventDefault();
        go(url);
    }

    function suppressLoader() {
        if (reduce) return false;
        var loader = document.getElementById('pageLoader');
        if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
        document.body.style.overflow = '';
        return true;
    }

    function arrivalReveal() {
        var pending = false;
        var bg = '';
        try {
            pending = sessionStorage.getItem(NAV_KEY) === '1';
            bg = sessionStorage.getItem(NAV_BG_KEY) || '';
            sessionStorage.removeItem(NAV_KEY);
            sessionStorage.removeItem(NAV_BG_KEY);
        } catch (e) {}
        if (!pending || !suppressLoader()) return;

        ensureGrid();
        busy = true;
        grid.style.setProperty('--gh-transition-bg', bg || gridBg());
        grid.classList.add('active');

        var shown = false;
        var released = false;
        function release() {
            if (!shown || released) return;
            released = true;
            window.removeEventListener('gh:ready', release);
            animate(false, function () {
                grid.classList.remove('active');
                busy = false;
            });
        }
        window.addEventListener('gh:ready', release);
        setTimeout(release, 2200);
        animate(true, function () {
            shown = true;
            release();
        });
    }

    window.addEventListener('resize', function () {
        if (grid && !grid.classList.contains('active')) computeGrid();
    });

    function init() {
        injectStyle();
        document.addEventListener('click', onLinkClick);
        arrivalReveal();
    }
    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);

    window.GHTransition = {
        play: play,
        go: go,
        isBusy: function () { return busy; }
    };
})();
