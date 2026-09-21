// Runs in the page: turns the rendered app into a compact tree (boxes, text, icons, images, the dot map)
// that scripts/fig-build.js rebuilds in Figma. Adapted from pick-em-gamemode/perfect/_fig.js.
(function () {
  const R = (v) => Math.round(v * 10) / 10;
  const col = (s) => {
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    const a = p.length > 3 ? p[3] : 1;
    if (a === 0) return null;
    return '#' + p.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('') + (a < 1 ? ':' + Math.round(a * 100) / 100 : '');
  };
  const vis = (e, cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.01;
  const name = (e) => (typeof e.className === 'string' && e.className.split(' ').filter(Boolean)[0]) || e.tagName.toLowerCase();
  // edge spaces become non-breaking: Figma's metrics differ slightly and would swallow them inside a row
  const txt = (s, cs) => {
    s = s.replace(/\s+/g, ' ').replace(/^ /, '\u00A0').replace(/ $/, '\u00A0');
    return cs.textTransform === 'uppercase' ? s.toUpperCase() : s;
  };

  function textStyle(cs) {
    const lh = cs.lineHeight === 'normal' ? null : R(parseFloat(cs.lineHeight));
    return { fs: R(parseFloat(cs.fontSize)), fw: +cs.fontWeight, c: col(cs.color) || '#fafafa', ls: cs.letterSpacing === 'normal' ? 0 : R(parseFloat(cs.letterSpacing)), lh, ta: cs.textAlign };
  }
  function shadow(cs) {
    const s = cs.boxShadow;
    if (!s || s === 'none') return {};
    const out = {};
    s.split(/,(?![^(]*\))/).forEach((part) => {
      const c = col(part);
      const nums = (part.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
      if (/inset/.test(part)) { if (nums[3] > 0 && c) out.ist = [c, nums[3]]; }
      else if (c && (nums[2] > 0 || nums[3] > 0)) out.sh = [c, nums[0] || 0, nums[1] || 0, nums[2] || 0, nums[3] || 0];
    });
    return out;
  }

  function svgNode(el, pr, abs) {
    const r = el.getBoundingClientRect();
    if (el.classList.contains('map')) {
      // the dot map: geometry comes from grid.json, here we only record each state's colour
      const st = {};
      el.querySelectorAll('g[data-st]').forEach((g) => {
        const c = g.querySelector('circle');
        if (!c) return;
        st[g.dataset.st] = [col(getComputedStyle(c).fill) || '#515151', R(+getComputedStyle(g).opacity)];
      });
      return { k: 'map', abs, n: 'Dot map', x: R(r.left - pr.left), y: R(r.top - pr.top), w: R(r.width), h: R(r.height), vb: el.getAttribute('viewBox'), st };
    }
    const clone = el.cloneNode(true);
    const all = [el, ...el.querySelectorAll('*')], call = [clone, ...clone.querySelectorAll('*')];
    all.forEach((n, i) => {
      const cs = getComputedStyle(n);
      ['fill', 'stroke'].forEach((p) => {
        const v = col(cs[p]);
        if (v !== null) call[i].setAttribute(p, v.split(':')[0]);
        else if (cs[p] === 'none') call[i].setAttribute(p, 'none');
      });
      if (cs.strokeWidth) call[i].setAttribute('stroke-width', parseFloat(cs.strokeWidth));
    });
    clone.setAttribute('width', R(r.width));
    clone.setAttribute('height', R(r.height));
    clone.removeAttribute('class');
    clone.removeAttribute('style');
    return { k: 'svg', abs, n: name(el) || 'icon', x: R(r.left - pr.left), y: R(r.top - pr.top), w: R(r.width), h: R(r.height), svg: clone.outerHTML };
  }

  function build(el, pr) {
    const cs = getComputedStyle(el);
    if (!vis(el, cs)) return null;
    const isAbs = cs.position === 'absolute' || cs.position === 'fixed' ? 1 : undefined;
    if (el instanceof SVGSVGElement) return svgNode(el, pr, isAbs);
    if (/^(SCRIPT|STYLE|LINK|META|NOSCRIPT)$/.test(el.tagName)) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) {
      // a zero-size wrapper (e.g. an anchor for an absolutely positioned panel): hoist its children
      for (const c of el.children) { const k = build(c, pr); if (k) return k; }
      return null;
    }
    const base = { n: name(el), x: R(r.left - pr.left), y: R(r.top - pr.top), w: R(r.width), h: R(r.height) };
    if (el.tagName === 'IMG') return Object.assign(base, { k: 'img', abs: isAbs, src: new URL(el.getAttribute('src'), location.href).pathname, r: R(parseFloat(cs.borderTopLeftRadius) || 0) });

    const node = Object.assign(base, { k: 'f' });
    const bg = col(cs.backgroundColor);
    if (bg) node.bg = bg;
    if (/gradient/.test(cs.backgroundImage)) node.gr = cs.backgroundImage;
    const rad = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((v) => Math.min(parseFloat(v) || 0, 999));
    if (rad.some(Boolean)) node.r = rad.every((v) => v === rad[0]) ? rad[0] : rad;
    const bw = parseFloat(cs.borderTopWidth), bc = col(cs.borderTopColor);
    if (bw > 0 && bc && cs.borderTopStyle !== 'none') node.st = [bc, bw];
    Object.assign(node, shadow(cs));
    if (+cs.opacity < 1) node.op = R(+cs.opacity);
    if (cs.overflow !== 'visible') node.clip = 1;
    const pad = ['Top', 'Right', 'Bottom', 'Left'].map((s) => R(parseFloat(cs['padding' + s]) + (parseFloat(cs['border' + s + 'Width']) || 0)));
    if (pad.some(Boolean)) node.p = pad;
    if (isAbs) node.abs = 1;

    const disp = cs.display;
    if (/flex/.test(disp)) {
      node.lay = cs.flexDirection.startsWith('column') ? 'V' : 'H';
      node.gap = R(parseFloat(node.lay === 'V' ? cs.rowGap : cs.columnGap) || 0);
      node.jc = cs.justifyContent;
      node.ai = cs.alignItems;
    } else if (/grid/.test(disp)) {
      const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
      node.lay = 'H';
      node.cols = cols;
      node.gap = R(parseFloat(cs.columnGap) || 0);
      node.rgap = R(parseFloat(cs.rowGap) || 0);
      node.wrap = cols > 1 ? 1 : 0;
      node.ai = cs.alignItems;
    }

    const kids = [];
    const onlyText = [...el.childNodes].every((c) => c.nodeType === 3 || (c.nodeType === 1 && c.tagName === 'BR'));
    const all = el.textContent.trim();
    if (onlyText && all) {
      const t = Object.assign({ k: 't', n: 'text', s: txt(el.innerText || all, cs) }, textStyle(cs));
      const rg = document.createRange(); rg.selectNodeContents(el);
      const tr = rg.getBoundingClientRect();
      Object.assign(t, { x: R(tr.left - r.left), y: R(tr.top - r.top), w: R(tr.width), h: R(tr.height) });
      t.one = tr.height < (t.lh || t.fs * 1.4) * 1.6 ? 1 : 0;
      if (!node.bg && !node.gr && !node.st && !node.p && !node.r && !node.sh && !node.abs) {
        Object.assign(t, { x: R(tr.left - pr.left), y: R(tr.top - pr.top), n: name(el), abs: isAbs });
        if (node.op) t.op = node.op;
        return t;
      }
      kids.push(t);
    } else {
      for (const c of el.childNodes) {
        if (c.nodeType === 3) {
          const s = c.textContent.replace(/\s+/g, ' ');
          if (!s.trim()) continue;
          const rg = document.createRange(); rg.selectNodeContents(c);
          const tr = rg.getBoundingClientRect();
          if (tr.width < 1) continue;
          kids.push(Object.assign({ k: 't', n: 'text', one: 1, s: txt(s, cs), x: R(tr.left - r.left), y: R(tr.top - r.top), w: R(tr.width), h: R(tr.height) }, textStyle(cs)));
        } else if (c.nodeType === 1) {
          const k = build(c, r);
          if (k) kids.push(k);
        }
      }
      if (!/flex|grid/.test(disp) && kids.length > 1 && [...el.children].every((c) => /inline/.test(getComputedStyle(c).display))) {
        node.lay = 'H'; node.gap = 0; node.ai = 'baseline';
      }
    }
    node.kids = kids;
    if (kids.length === 1 && !node.bg && !node.gr && !node.st && !node.sh && !node.r && !node.p && !node.abs && !node.clip && Math.abs(kids[0].w - node.w) < 1 && Math.abs(kids[0].h - node.h) < 1) {
      const k = kids[0];
      k.x += node.x; k.y += node.y;
      if (k.n === 'text' || k.n === 'div') k.n = node.n;
      return k;
    }
    return node;
  }

  const app = document.querySelector('.app') || document.body;
  const rect = app.getBoundingClientRect();
  const tree = build(app, { left: rect.left, top: rect.top });
  tree.n = 'Pick Em · P1 (from code)';
  tree.x = 0; tree.y = 0;
  tree.bg = '#0a0909';
  return JSON.stringify(tree);
})();
