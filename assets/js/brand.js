/*
 * brand.js - branding dinamico por tienda.
 * Lee GIGA_CONFIG.BRAND y reemplaza los textos heredados de MANIAWORLD
 * sin tocar scripts, estilos ni campos de formulario.
 */
(function () {
  'use strict';

  var cfg = window.GIGA_CONFIG || {};
  var brand = cfg.BRAND || {};
  var name = String(brand.name || '').trim();
  if (!name) return;

  var rules = [
    [/\bMANIAWORLD\b/g, name],
    [/\bGIGAHEARTZ\b/g, name],
    [/\bGigahertz Store\b/gi, name]
  ];
  if (brand.domain) rules.push([/gigahertzstore\.com/gi, String(brand.domain)]);
  if (brand.email) rules.push([/soporte@gigahertzstore\.com/gi, String(brand.email)]);

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };

  function replaceText(value) {
    var out = String(value == null ? '' : value);
    for (var i = 0; i < rules.length; i++) out = out.replace(rules[i][0], rules[i][1]);
    return out;
  }

  function walkText(node) {
    var parent = node.parentNode;
    if (!parent || SKIP[parent.nodeName]) return;
    var next = replaceText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function walkElement(el) {
    if (!el || el.nodeType !== 1 || SKIP[el.nodeName]) return;
    ['alt', 'title', 'aria-label', 'placeholder'].forEach(function (attr) {
      if (!el.hasAttribute(attr)) return;
      var cur = el.getAttribute(attr);
      var next = replaceText(cur);
      if (next !== cur) el.setAttribute(attr, next);
    });
  }

  function apply(root) {
    root = root || document.body;
    if (!root) return;

    if (document.title) document.title = replaceText(document.title);

    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', replaceText(meta.getAttribute('content') || ''));

    if (root.nodeType === 3) { walkText(root); return; }
    if (root.nodeType === 1) walkElement(root);

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) walkText(node);
      else walkElement(node);
    }
  }

  function start() {
    apply(document.body);

    if (typeof MutationObserver === 'undefined') return;
    var pending = false;
    var observer = new MutationObserver(function (mutations) {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        mutations.forEach(function (m) {
          if (m.type === 'characterData') walkText(m.target);
          else if (m.type === 'childList') {
            for (var i = 0; i < m.addedNodes.length; i++) apply(m.addedNodes[i]);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.GHBrand = { apply: apply, replace: replaceText, name: name };
})();
