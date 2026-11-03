/* GigaHertz - Categories modal (shared) */
(function () {
    'use strict';

    var DEFAULT_GROUPS = [
        {
            name: 'Hardware y Componentes',
            icon: '<path d="M4 4h16v16H4z"/><path d="M9 9h6v6H9z"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>',
            items: ['Procesadores', 'Tarjetas Madre AMD', 'Tarjetas Madre Intel', 'Tarjetas de Video', 'Memorias Ram DDR3', 'Memorias Ram DDR4', 'Memorias Ram DDR5', 'Memorias Ram Laptop', 'SSD M.2', 'SSD Sata', 'Discos Externos', 'Enclosure/Case externo', 'Fuentes de Poder', 'Enfriamiento', 'Pastas Térmicas', 'Thermal Pads', 'Cases', 'Equipos Repotenciados']
        },
        {
            name: 'Periféricos y Gaming',
            icon: '<path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.544-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
            items: ['Teclados', 'Mouses', 'Kit Teclado + Mouse', 'Mouse Pads', 'Keycaps', 'Audífonos', 'Micrófonos', 'Controles/Volantes', 'Sillas Gamer', 'Mesas/Escritorios Gamer']
        },
        {
            name: 'Laptops, Computadoras y Pantallas',
            icon: '<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10H3V5z"/><path d="M2 17h20v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2z"/>',
            items: ['Laptops', 'Mini PC', 'Tablets', 'Tabletas Graficas', 'Monitores', 'Proyectores y Pantallas']
        },
        {
            name: 'Audio',
            icon: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>',
            items: ['Audio', 'Grabación y Podcast', 'Webcam']
        },
        {
            name: 'Oficina, Impresión y Estética',
            icon: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
            items: ['Impresoras', 'Tintas y Toner', 'Letreros Led y Lámparas', 'Soportes']
        },
        {
            name: 'Accesorios y Varios',
            icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
            items: ['Redes', 'Router y Mesh', 'Cargadores', 'UPS / Respaldo Eléctrico', 'Cables y Adaptadores', 'Camaras de Seguridad', 'Maletines y Bolsos', 'Accesorios', 'Gift Cards y Licencias']
        }
    ];

    var GROUPS = DEFAULT_GROUPS;

    var TOTAL = GROUPS.reduce(function (n, g) { return n + g.items.length; }, 0);
    var LAYOUTS = [
        { v: 'sections', label: 'Secciones', tip: 'Agrupadas por sección' },
        { v: 'rows', label: 'Filas', tip: 'Una fila por sección' },
        { v: 'columns', label: 'Columnas', tip: 'Una columna por sección' }
    ];
    var LKEY = 'gh_cat_layout';

    var css = [
        '.cm-overlay{position:fixed;inset:0;z-index:100;background:rgba(249,250,251,.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;visibility:hidden;transition:opacity 150ms cubic-bezier(.4,0,1,1),visibility 0s linear 140ms}',
        '.cm-overlay.is-open{opacity:1;visibility:visible;transition:opacity 180ms cubic-bezier(.23,1,.32,1),visibility 0s}',
        '.cm-modal{width:min(1024px,96vw);max-height:min(86vh,860px);display:flex;flex-direction:column;background:#fff;border:1px solid rgba(255,255,255,.95);border-radius:1.6rem;box-shadow:0 28px 70px rgba(0,0,0,.16);transform:scale(.95);opacity:0;transition:transform 180ms cubic-bezier(.23,1,.32,1),opacity 180ms cubic-bezier(.23,1,.32,1)}',
        '.cm-overlay.is-open .cm-modal{transform:scale(1);opacity:1}',
        '.cm-head{display:flex;align-items:center;gap:12px;padding:18px 22px 14px;border-bottom:1px solid #eef0f3;flex-shrink:0}',
        '.cm-titles{flex:1;min-width:0}',
        '.cm-title{margin:0;font-size:17px;font-weight:800;color:#111827;display:flex;align-items:center;gap:9px}',
        '.cm-title .dot{width:9px;height:9px;border-radius:50%;background:#7c3aed;flex-shrink:0}',
        '.cm-sub{margin:2px 0 0;font-size:12px;font-weight:600;color:#9ca3af}',
        '.cm-switch{display:flex;gap:4px;background:#f5f6f8;border:1px solid #e9ebef;border-radius:999px;padding:4px}',
        '.cm-switch button{display:flex;align-items:center;gap:6px;border:0;background:none;font-family:inherit;font-size:12px;font-weight:700;color:#6b7280;padding:7px 13px;border-radius:999px;cursor:pointer;transition:background-color 130ms ease,color 130ms}',
        '.cm-switch button svg{width:14px;height:14px;flex-shrink:0}',
        '.cm-switch button:hover{color:#6d28d9}',
        '.cm-switch button.is-active{background:#7c3aed;color:#fff;box-shadow:0 4px 12px rgba(124,58,237,.35)}',
        '.cm-switch button:active{transform:scale(.97)}',
        '.cm-close{flex-shrink:0;width:36px;height:36px;border-radius:50%;border:1px solid #e5e7eb;background:#fff;color:#6b7280;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:color 140ms ease,border-color 140ms ease,transform 140ms cubic-bezier(.23,1,.32,1)}',
        '.cm-close:hover{color:#111827;border-color:#d1d5db}',
        '.cm-close:active{transform:scale(.92)}',
        '.cm-close svg{width:16px;height:16px}',
        '.cm-body{overflow-y:auto;padding:20px 22px 24px;min-height:0}',
        '.cm-chip{display:inline-flex;align-items:center;border:1px solid #e5e7eb;background:#fff;color:#374151;font-family:inherit;font-size:12px;font-weight:600;padding:8px 14px;border-radius:999px;cursor:pointer;text-align:left;transition:background-color 130ms ease,color 130ms ease,border-color 130ms ease,transform 130ms cubic-bezier(.23,1,.32,1)}',
        '.cm-chip:hover{background:#7c3aed;border-color:#7c3aed;color:#fff}',
        '.cm-chip:active{transform:scale(.96)}',
        '.cm-chip-all{background:#7c3aed;border-color:#7c3aed;color:#fff;font-weight:800}',
        '.cm-chip-all:hover{background:#6d28d9;border-color:#6d28d9;color:#fff}',
        /* layout: sections (overview squares + detail) */
        '.cm-sec-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}',
        '@media (min-width:760px){.cm-sec-grid{grid-template-columns:repeat(3,1fr)}}',
        '.cm-sec{aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;background:#f9fafb;border:1px solid #eef0f3;border-radius:1.2rem;padding:14px;cursor:pointer;font-family:inherit;transition:background-color 140ms ease,border-color 140ms ease,box-shadow 160ms ease,transform 160ms cubic-bezier(.23,1,.32,1)}',
        '.cm-sec:hover{background:#fff;border-color:#ddd6fe;box-shadow:0 12px 28px rgba(124,58,237,.13);transform:translateY(-2px)}',
        '.cm-sec:active{transform:scale(.96)}',
        '.cm-sec-ico svg{width:30px;height:30px;color:#7c3aed}',
        '.cm-sec-name{font-size:12.5px;font-weight:800;color:#111827;line-height:1.3}',
        '.cm-sec-n{font-size:10.5px;font-weight:700;color:#7c3aed;background:#ede9fe;border-radius:999px;padding:3px 10px}',
        '.cm-back{display:inline-flex;align-items:center;gap:7px;border:1px solid #e5e7eb;background:#fff;color:#374151;font-family:inherit;font-size:12px;font-weight:700;padding:8px 15px 8px 11px;border-radius:999px;cursor:pointer;margin-bottom:15px;transition:border-color 140ms ease,color 140ms ease,transform 140ms cubic-bezier(.23,1,.32,1)}',
        '.cm-back:hover{border-color:#d1d5db;color:#111827}',
        '.cm-back:active{transform:scale(.96)}',
        '.cm-back svg{width:14px;height:14px}',
        '.cm-detail-h{display:flex;align-items:center;gap:9px;margin:0 0 14px;font-size:14.5px;font-weight:800;color:#111827}',
        '.cm-detail-h svg{width:18px;height:18px;color:#7c3aed;flex-shrink:0}',
        '.cm-sec-items{display:flex;flex-wrap:wrap;gap:8px}',
        /* layout: rows */
        '.cm-rows{display:flex;flex-direction:column;gap:4px}',
        '.cm-row{display:flex;flex-direction:column;gap:10px;padding:14px 2px;border-bottom:1px solid #eef0f3}',
        '.cm-row:last-child{border-bottom:0}',
        '.cm-row-label{display:flex;align-items:center;gap:9px;margin:0;font-size:13px;font-weight:800;color:#111827}',
        '.cm-row-label svg{width:16px;height:16px;color:#7c3aed;flex-shrink:0}',
        '.cm-row-label .n{font-size:10.5px;font-weight:700;color:#7c3aed;background:#ede9fe;border-radius:999px;padding:3px 9px}',
        '.cm-row-items{display:flex;flex-wrap:wrap;gap:8px}',
        /* layout: columns */
        '.cm-cols{display:grid;grid-template-columns:1fr;gap:14px}',
        '@media (min-width:640px){.cm-cols{grid-template-columns:1fr 1fr}}',
        '@media (min-width:1000px){.cm-cols{grid-template-columns:repeat(3,1fr)}}',
        '.cm-col{background:#f9fafb;border:1px solid #eef0f3;border-radius:1.15rem;padding:15px 14px 16px}',
        '.cm-col-h{display:flex;align-items:center;gap:9px;margin:0 0 10px;font-size:13px;font-weight:800;color:#111827}',
        '.cm-col-h svg{width:16px;height:16px;color:#7c3aed;flex-shrink:0}',
        '.cm-col-h .n{margin-left:auto;font-size:10.5px;font-weight:700;color:#7c3aed;background:#ede9fe;border-radius:999px;padding:3px 9px}',
        '.cm-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}',
        '.cm-list .cm-chip{width:100%;justify-content:flex-start;border:0;background:none;padding:8px 10px;border-radius:0.6rem;font-size:12.5px}',
        '.cm-list .cm-chip:hover{background:#ede9fe;color:#6d28d9;transform:none}',
        '@media (max-width:640px){.cm-switch button span{display:none}.cm-switch button{padding:8px 10px}.cm-head{flex-wrap:wrap}.cm-switch{order:3;width:100%;justify-content:center}}',
        '@media (prefers-reduced-motion:reduce){.cm-overlay,.cm-modal,.cm-chip,.cm-close,.cm-switch button,.cm-sec,.cm-back{transition:none}}'
    ].join('');

    var icons = {
        sections: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
        rows: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="15" width="18" height="5" rx="1"/></svg>',
        columns: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="16" y="3" width="5" height="18" rx="1"/></svg>'
    };

    function svg(inner) {
        return '<svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">' + inner + '</svg>';
    }

    function chipsHTML(g) {
        return g.items.map(function (it) {
            return '<button type="button" class="cm-chip" data-cat="' + it.replace(/"/g, '&quot;') + '">' + it + '</button>';
        }).join('');
    }

    var secActive = null;

    function renderSections(body) {
        if (secActive !== null) {
            var g = GROUPS[secActive];
            body.innerHTML =
                '<button type="button" class="cm-back" id="cmBack">' +
                '<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7M19 12H5"/></svg>Categorías' +
                '</button>' +
                '<h4 class="cm-detail-h">' + svg(g.icon) + '<span>' + g.name + '</span></h4>' +
                '<div class="cm-sec-items">' +
                '<button type="button" class="cm-chip cm-chip-all" data-all="1">Todos</button>' +
                chipsHTML(g) + '</div>';
            return;
        }
        body.innerHTML = '<div class="cm-sec-grid">' + GROUPS.map(function (g, i) {
            return '<button type="button" class="cm-sec" data-i="' + i + '"><span class="cm-sec-ico">' + svg(g.icon) + '</span><span class="cm-sec-name">' + g.name + '</span><span class="cm-sec-n">' + g.items.length + '</span></button>';
        }).join('') + '</div>';
    }

    function renderRows(body) {
        body.innerHTML = '<div class="cm-rows">' + GROUPS.map(function (g) {
            return '<div class="cm-row"><h4 class="cm-row-label">' + svg(g.icon) + '<span>' + g.name + '</span><span class="n">' + g.items.length + '</span></h4><div class="cm-row-items">' + chipsHTML(g) + '</div></div>';
        }).join('') + '</div>';
    }

    function renderColumns(body) {
        body.innerHTML = '<div class="cm-cols">' + GROUPS.map(function (g) {
            return '<div class="cm-col"><h4 class="cm-col-h">' + svg(g.icon) + '<span>' + g.name + '</span><span class="n">' + g.items.length + '</span></h4><ul class="cm-list">' + g.items.map(function (it) {
                return '<li><button type="button" class="cm-chip" data-cat="' + it.replace(/"/g, '&quot;') + '">' + it + '</button></li>';
            }).join('') + '</ul></div>';
        }).join('') + '</div>';
    }

    var RENDER = { sections: renderSections, rows: renderRows, columns: renderColumns };

    if (document.getElementById('catModal')) return;

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.className = 'cm-overlay';
    root.id = 'catModal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'cmTitle');
    root.innerHTML =
        '<div class="cm-modal">' +
        '  <div class="cm-head">' +
        '    <div class="cm-titles">' +
        '      <h2 class="cm-title" id="cmTitle"><span class="dot"></span>Categorías</h2>' +
        '      <p class="cm-sub">' + GROUPS.length + ' secciones · ' + TOTAL + ' categorías</p>' +
        '    </div>' +
        '    <div class="cm-switch" id="cmSwitch" role="group" aria-label="Cambiar vista"></div>' +
        '    <button type="button" class="cm-close" id="cmClose" aria-label="Cerrar categorías">' +
        '      <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
        '    </button>' +
        '  </div>' +
        '  <div class="cm-body" id="cmBody"></div>' +
        '</div>';
    document.body.appendChild(root);

    var overlay = root;
    var body = document.getElementById('cmBody');
    var sw = document.getElementById('cmSwitch');
    var lastFocus = null;
    var layout = localStorage.getItem(LKEY) || 'sections';
    if (!RENDER[layout]) layout = 'sections';

    sw.innerHTML = LAYOUTS.map(function (l) {
        return '<button type="button" data-v="' + l.v + '" title="' + l.tip + '" aria-pressed="false">' + icons[l.v] + '<span>' + l.label + '</span></button>';
    }).join('');

    function setLayout(v) {
        layout = v;
        secActive = null;
        localStorage.setItem(LKEY, v);
        RENDER[v](body);
        sw.querySelectorAll('button').forEach(function (b) {
            var on = b.dataset.v === v;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-pressed', String(on));
        });
    }

    function isOpen() { return overlay.classList.contains('is-open'); }

    function openCat() {
        if (isOpen()) return;
        lastFocus = document.activeElement;
        secActive = null;
        RENDER[layout](body);
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        document.getElementById('cmClose').focus();
    }

    function closeCat() {
        if (!isOpen()) return;
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    /* API publica: la usan el boton "Categoria" de los filtros y la barra inferior */
    window.ghOpenCat = openCat;
    window.ghCloseCat = closeCat;

    /* Devuelve las subcategorias de una seccion (para el filtro "Todos" del catalogo) */
    window.ghCatSection = function (name) {
        for (var i = 0; i < GROUPS.length; i++) {
            if (GROUPS[i].name === name) return GROUPS[i].items.slice();
        }
        return null;
    };

    sw.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]');
        if (!b) return;
        setLayout(b.dataset.v);
    });

    document.getElementById('cmClose').addEventListener('click', closeCat);
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeCat();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (layout === 'sections' && secActive !== null) {
            secActive = null;
            RENDER.sections(body);
            return;
        }
        closeCat();
    });

    body.addEventListener('click', function (e) {
        var sec = e.target.closest('.cm-sec');
        if (sec) {
            secActive = Number(sec.dataset.i);
            RENDER.sections(body);
            return;
        }
        if (e.target.closest('.cm-back')) {
            secActive = null;
            RENDER.sections(body);
            return;
        }
        var chip = e.target.closest('.cm-chip');
        if (!chip) return;
        var isAll = chip.hasAttribute('data-all');
        var name = chip.dataset.cat || '';
        var group = (secActive !== null) ? GROUPS[secActive] : null;
        closeCat();
        /* En el catalogo aplicamos la categoria/subcategoria sin recargar la pagina */
        if (window.ghApplyCat) {
            if (isAll && group) { window.ghApplyCat({ section: group.name, items: group.items }); return; }
            window.ghApplyCat(name);
            return;
        }
        if (isAll && group) { location.href = 'catalogo.html?sec=' + encodeURIComponent(group.name); return; }
        location.href = 'catalogo.html?sub=' + encodeURIComponent(name);
    });

    var onIndex = !!document.getElementById('productos');

    document.querySelectorAll('a.js-cat-nav').forEach(function (a) {
        a.addEventListener('click', function (e) {
            e.preventDefault();
            if (onIndex) {
                var target = document.getElementById('productos');
                if (target) target.scrollIntoView();
            }
            openCat();
        });
    });

    /* Construye las secciones a partir de la DB (categorías + subcategorías). */
    function groupsFromData(D) {
        if (!D || !D.categories || !D.categories.length) return null;
        var DEF_ICON = '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>';
        return D.categories.filter(function (c) { return !c.hidden; }).map(function (c) {
            var items = (D.subcategories || []).filter(function (s) {
                return String(s.category_id) === String(c.id) && !s.hidden;
            }).map(function (s) { return s.name; });
            return { name: c.name, icon: (c.icon && c.icon.trim()) ? c.icon : DEF_ICON, items: items };
        });
    }

    setLayout(layout);

    /* Si hay datos en Supabase, sustituye las secciones por las reales. */
    if (window.GigaData) {
        window.GigaData.ready.then(function (D) {
            var g = groupsFromData(D);
            if (!g || !g.length) return;
            GROUPS = g;
            TOTAL = GROUPS.reduce(function (n, x) { return n + x.items.length; }, 0);
            var sub = document.querySelector('#catModal .cm-sub');
            if (sub) sub.textContent = GROUPS.length + ' secciones · ' + TOTAL + ' categorías';
            secActive = null;
            RENDER[layout](body);
        });
    }
})();
