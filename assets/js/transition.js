(function () {
    'use strict';

    var GRID_ID = 'gh-transition-grid';
    var STYLE_ID = 'gh-transition-style';
    var SQ = 'gh-grid-square';
    var GRID_BG = '#2A1B4D';

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

    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
    try { auto = navigator.webdriver === true; } catch (e) { auto = false; }

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
        if (busy) return;
        ensureGrid();

        if (reduce || window.GH_TRANSITION_ENABLED === false || (auto && !window.GH_FORCE_TRANSITION)) {
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

    window.addEventListener('resize', function () {
        if (grid && !grid.classList.contains('active')) computeGrid();
    });

    function init() { injectStyle(); }
    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);

    window.GHTransition = { play: play, isBusy: function () { return busy; } };
})();
