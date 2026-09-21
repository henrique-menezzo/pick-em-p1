// Runs inside Figma (figma-console plugin): rebuilds the app from the tree captured by scripts/dom2fig.js.
// Flex/grid become auto layout; absolutely positioned pieces become absolute children.
// Everything is fetched from a local server on :9230 (the only ports the bridge plugin may reach).
async function build(figma, HOST, SECTION_ID) {
  const j = async (p) => (await fetch(HOST + p)).json();
  const tree = await j('/tmp/tree.json');
  const grid = await j('/src/data/grid.json');

  const FONT = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' };
  for (const style of Object.values(FONT)) await figma.loadFontAsync({ family: 'Libre Franklin', style });

  const rgb = (s) => {
    const [hex, a] = String(s).split(':');
    const n = parseInt(hex.slice(1), 16);
    return { color: { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }, opacity: a ? +a : 1 };
  };
  const solid = (s) => { const c = rgb(s); return { type: 'SOLID', color: c.color, opacity: c.opacity }; };
  function gradient(css) {
    const cols = (css.match(/rgba?\([^)]+\)/g) || []).map((c) => {
      const p = c.match(/[\d.]+/g).map(Number);
      return { color: { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255, a: p.length > 3 ? p[3] : 1 }, position: 0 };
    });
    if (cols.length < 2) return null;
    cols[cols.length - 1].position = 1;
    const deg = (css.match(/(-?[\d.]+)deg/) || [, '180'])[1];
    const vertical = Math.abs(+deg % 360) === 180 || Math.abs(+deg % 360) === 0;
    return { type: 'GRADIENT_LINEAR', gradientStops: cols, gradientTransform: vertical ? [[0, 1, 0], [-1, 0, 1]] : [[1, 0, 0], [0, 1, 0]] };
  }
  const ALIGN = { 'flex-start': 'MIN', start: 'MIN', center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', 'space-between': 'SPACE_BETWEEN', baseline: 'BASELINE', stretch: 'MIN', normal: 'MIN' };

  const imgCache = {};
  async function image(src) {
    if (!imgCache[src]) {
      const buf = await (await fetch(HOST + '/public' + src)).arrayBuffer();
      imgCache[src] = figma.createImage(new Uint8Array(buf)).hash;
    }
    return imgCache[src];
  }

  function dotMap(node) {
    const frame = figma.createFrame();
    frame.name = node.n;
    frame.resize(node.w, node.h);
    frame.fills = [];
    frame.clipsContent = true;
    const vb = (node.vb || '0 0 1204 754').split(/\s+/).map(Number);
    const k = node.w / vb[2];
    const r = grid.r * k, kr = r * 0.5523;
    for (const [st, cells] of Object.entries(grid.states)) {
      const look = node.st[st];
      if (!look) continue;
      const live = cells.filter((c) => !c[2]);
      if (!live.length) continue;
      const ox = Math.min(...live.map((c) => (c[0] * grid.pitch - vb[0]) * k)) - r;
      const oy = Math.min(...live.map((c) => (c[1] * grid.pitch - vb[1]) * k)) - r;
      let d = '';
      for (const [c, row, seam] of cells) {
        if (seam) continue; // the one-dot gap between states: invisible in the app too
        const x = (c * grid.pitch - vb[0]) * k - ox, y = (row * grid.pitch - vb[1]) * k - oy;
        // Figma vector paths take no arcs, so each dot is four bezier quarters
        const n2 = (v) => v.toFixed(2);
        d += `M ${n2(x - r)} ${n2(y)} C ${n2(x - r)} ${n2(y - kr)} ${n2(x - kr)} ${n2(y - r)} ${n2(x)} ${n2(y - r)}`
          + ` C ${n2(x + kr)} ${n2(y - r)} ${n2(x + r)} ${n2(y - kr)} ${n2(x + r)} ${n2(y)}`
          + ` C ${n2(x + r)} ${n2(y + kr)} ${n2(x + kr)} ${n2(y + r)} ${n2(x)} ${n2(y + r)}`
          + ` C ${n2(x - kr)} ${n2(y + r)} ${n2(x - r)} ${n2(y + kr)} ${n2(x - r)} ${n2(y)} Z `;
      }
      const v = figma.createVector();
      v.name = st;
      v.vectorPaths = [{ windingRule: 'NONZERO', data: d }];
      v.fills = [solid(look[0])];
      v.opacity = look[1];
      v.strokes = [];
      frame.appendChild(v);
      v.x = ox; v.y = oy;
    }
    return frame;
  }

  async function make(node) {
    if (node.k === 't') {
      const t = figma.createText();
      t.name = node.n === 'text' ? node.s.slice(0, 24) : node.n;
      t.fontName = { family: 'Libre Franklin', style: FONT[node.fw] || 'Regular' };
      t.fontSize = Math.max(1, node.fs);
      if (node.lh) t.lineHeight = { unit: 'PIXELS', value: node.lh };
      if (node.ls) t.letterSpacing = { unit: 'PIXELS', value: node.ls };
      t.characters = node.s;
      t.fills = [solid(node.c)];
      t.textAlignHorizontal = node.ta === 'center' ? 'CENTER' : node.ta === 'right' || node.ta === 'end' ? 'RIGHT' : 'LEFT';
      // single lines size themselves (a fixed box can wrap "34" into "3/4"); wrapped text keeps its box
      // single lines size themselves (Figma's metrics differ a hair from the browser's, a fixed box would wrap)
      if (node.one) t.textAutoResize = 'WIDTH_AND_HEIGHT';
      else { t.textAutoResize = 'HEIGHT'; t.resize(Math.max(1, node.w + 1), Math.max(1, node.h)); }
      if (node.op) t.opacity = node.op;
      return t;
    }
    if (node.k === 'img') {
      if (/\.svg(\?|$)/.test(node.src)) { // an <img> pointing at an SVG: bring in the vectors, not a bitmap
        const svg = await (await fetch(HOST + (node.src.startsWith('/src') ? node.src : '/public' + node.src))).text();
        const n = figma.createNodeFromSvg(svg);
        n.name = node.n;
        n.resize(Math.max(1, node.w), Math.max(1, node.h));
        n.fills = [];
        return n;
      }
      const rect = figma.createRectangle();
      rect.name = node.n;
      rect.resize(Math.max(1, node.w), Math.max(1, node.h));
      rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: await image(node.src) }];
      if (node.r) rect.cornerRadius = node.r;
      return rect;
    }
    if (node.k === 'svg') {
      const n = figma.createNodeFromSvg(node.svg);
      n.name = node.n;
      n.resize(Math.max(1, node.w), Math.max(1, node.h));
      n.fills = [];
      return n;
    }
    if (node.k === 'map') return dotMap(node);

    const f = figma.createFrame();
    f.name = node.n;
    f.resize(Math.max(1, node.w), Math.max(1, node.h));
    f.fills = node.gr ? [gradient(node.gr) || solid('#151515')] : node.bg ? [solid(node.bg)] : [];
    if (node.r != null) { if (Array.isArray(node.r)) { f.topLeftRadius = node.r[0]; f.topRightRadius = node.r[1]; f.bottomRightRadius = node.r[2]; f.bottomLeftRadius = node.r[3]; } else f.cornerRadius = node.r; }
    if (node.st) { f.strokes = [solid(node.st[0])]; f.strokeWeight = node.st[1]; f.strokeAlign = 'INSIDE'; }
    if (node.ist) { f.strokes = [solid(node.ist[0])]; f.strokeWeight = node.ist[1]; f.strokeAlign = 'INSIDE'; }
    if (node.sh) {
      const c = rgb(node.sh[0]);
      f.effects = [{ type: 'DROP_SHADOW', color: { ...c.color, a: c.opacity }, offset: { x: node.sh[1], y: node.sh[2] }, radius: node.sh[3], spread: node.sh[4] || 0, visible: true, blendMode: 'NORMAL' }];
    }
    f.clipsContent = !!node.clip;
    if (node.op) f.opacity = node.op;

    const kids = node.kids || [];
    const flow = kids.filter((k) => !k.abs);
    const useLayout = node.lay && flow.length > 0;
    if (useLayout) {
      f.layoutMode = node.lay === 'V' ? 'VERTICAL' : 'HORIZONTAL';
      f.itemSpacing = node.gap || 0;
      if (node.wrap) { f.layoutWrap = 'WRAP'; f.counterAxisSpacing = node.rgap || 0; }
      f.primaryAxisAlignItems = ALIGN[node.jc] || 'MIN';
      f.counterAxisAlignItems = node.wrap ? 'MIN' : ALIGN[node.ai] || 'MIN';
      f.primaryAxisSizingMode = 'FIXED';
      f.counterAxisSizingMode = 'FIXED';
      const p = node.p || [0, 0, 0, 0];
      f.paddingTop = p[0]; f.paddingRight = p[1]; f.paddingBottom = p[2]; f.paddingLeft = p[3];
    }
    for (const kid of kids) {
      const child = await make(kid);
      f.appendChild(child);
      if (useLayout && kid.abs) {
        child.layoutPositioning = 'ABSOLUTE';
        child.x = kid.x; child.y = kid.y;
      } else if (!useLayout) {
        child.x = kid.x; child.y = kid.y;
      }
    }
    return f;
  }

  const root = await make(tree);
  root.name = tree.n;
  root.fills = [solid(tree.bg || '#0a0909')];
  root.clipsContent = true;

  const section = await figma.getNodeByIdAsync(SECTION_ID);
  section.appendChild(root);
  // drop it under whatever already lives in the section
  let y = 0, x = 0;
  for (const c of section.children) if (c !== root) { y = Math.max(y, c.y + c.height + 160); x = Math.min(x === 0 ? c.x : x, c.x); }
  root.x = x || 0;
  root.y = y;
  return { id: root.id, w: root.width, h: root.height, kids: root.children.length };
}
