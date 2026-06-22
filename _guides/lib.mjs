// SVG infographic builder for employee guide images (Thai). Render via resvg-js.
export const C = {
  maroon: "#7B1C1C",
  maroonDk: "#591212",
  maroonDk2: "#420D0D",
  gold: "#C9973A",
  goldLt: "#E6C77E",
  goldPale: "#F3E4C2",
  cream: "#FDF8F0",
  card: "#FFFFFF",
  ink: "#3A2A2A",
  sub: "#6E625C",
  faint: "#9C8F88",
  line: "#ECE2D6",
  lineGreen: "#06C755",
  green: "#2E8B57",
  greenBg: "#E7F6EC",
  red: "#C0392B",
  redBg: "#FBEAE8",
  blue: "#3E73B8",
  blueBg: "#E7F0FB",
  silver: "#5A5A60",
};

const ZERO_W = new Set([
  0x0e31, 0x0e34, 0x0e35, 0x0e36, 0x0e37, 0x0e38, 0x0e39, 0x0e3a,
  0x0e47, 0x0e48, 0x0e49, 0x0e4a, 0x0e4b, 0x0e4c, 0x0e4d, 0x0e4e,
]);

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// approximate advance width per char for Prompt
function charW(cp, size) {
  if (ZERO_W.has(cp)) return 0;
  if (cp === 0x20) return size * 0.28;
  // digits / latin narrower-ish, Thai base ~0.56
  if (cp >= 0x30 && cp <= 0x39) return size * 0.55;
  if (cp >= 0x41 && cp <= 0x7a) return size * 0.52;
  return size * 0.58;
}
export function textWidth(str, size) {
  let w = 0;
  for (const ch of str) w += charW(ch.codePointAt(0), size);
  return w;
}

// wrap by spaces first; if a token too long, hard-break by chars (Thai)
export function wrap(str, maxW, size) {
  const out = [];
  for (const para of String(str).split("\n")) {
    const words = para.split(" ");
    let line = "";
    const push = () => { if (line !== "") { out.push(line); line = ""; } };
    for (const word of words) {
      const cand = line === "" ? word : line + " " + word;
      if (textWidth(cand, size) <= maxW) { line = cand; continue; }
      push();
      if (textWidth(word, size) <= maxW) { line = word; continue; }
      // hard break long Thai token
      let cur = "";
      for (const ch of word) {
        const c2 = cur + ch;
        if (textWidth(c2, size) > maxW && cur !== "") { out.push(cur); cur = ch; }
        else cur = c2;
      }
      line = cur;
    }
    push();
  }
  return out;
}

export function text(x, y, s, o = {}) {
  const { size = 28, weight = 400, fill = C.ink, anchor = "start", spacing = "" } = o;
  const ls = spacing ? ` letter-spacing="${spacing}"` : "";
  return `<text x="${x}" y="${y}" font-family="Prompt" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"${ls}>${esc(s)}</text>`;
}

// multi-line wrapped text, returns {svg, height}
export function paragraph(x, y, s, o = {}) {
  const { size = 26, weight = 400, fill = C.sub, lh = 1.45, maxW = 700, anchor = "start" } = o;
  const lines = wrap(s, maxW, size);
  const step = size * lh;
  let svg = "";
  lines.forEach((ln, i) => { svg += text(x, y + i * step, ln, { size, weight, fill, anchor }); });
  return { svg, height: lines.length * step, lines: lines.length };
}

export function rrect(x, y, w, h, r, fill, o = {}) {
  const { stroke = "", sw = 0, opacity = 1 } = o;
  const st = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : "";
  const op = opacity !== 1 ? ` opacity="${opacity}"` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}"${st}${op}/>`;
}

// card with soft fake shadow
export function card(x, y, w, h, r = 24, fill = C.card, o = {}) {
  const shadow = `<rect x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#000000" opacity="0.07"/>`;
  return shadow + rrect(x, y, w, h, r, fill, o);
}

export function circle(cx, cy, r, fill, o = {}) {
  const { stroke = "", sw = 0, opacity = 1 } = o;
  const st = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : "";
  const op = opacity !== 1 ? ` opacity="${opacity}"` : "";
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${st}${op}/>`;
}

// ---- Lucide-style line icons. Drawn in a 24x24 viewbox, scaled+translated.
const ICONS = {
  login: `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>`,
  home: `<path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>`,
  calendar: `<rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/>`,
  fileText: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/>`,
  wallet: `<path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v3"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3h-5a2 2 0 0 1 0-4h5"/><circle cx="16.5" cy="12" r="0.6" fill="currentColor"/>`,
  brain: `<path d="M9.5 4a2.5 2.5 0 0 0-2.5 2.5A2.5 2.5 0 0 0 5 9a2.5 2.5 0 0 0 1 4 2.5 2.5 0 0 0 3.5 2.3V4z"/><path d="M14.5 4A2.5 2.5 0 0 1 17 6.5 2.5 2.5 0 0 1 19 9a2.5 2.5 0 0 1-1 4 2.5 2.5 0 0 1-3.5 2.3V4z"/>`,
  check: `<polyline points="4 12 10 18 20 6"/>`,
  printer: `<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>`,
  search: `<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>`,
  bell: `<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>`,
  hand: `<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4"/><path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M13 10V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M16 11.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5.2-3l-2.3-4a1.5 1.5 0 0 1 2.6-1.5L7 14"/>`,
  coins: `<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3"/><path d="M3 12c0 1.7 2.7 3 6 3"/><ellipse cx="15" cy="14" rx="6" ry="3"/><path d="M21 14v3c0 1.7-2.7 3-6 3s-6-1.3-6-3"/>`,
  calc: `<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8" y2="11"/><line x1="12" y1="11" x2="12" y2="11"/><line x1="16" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="8" y2="15"/><line x1="12" y1="15" x2="12" y2="15"/><line x1="8" y1="18" x2="16" y2="18"/>`,
  arrowRight: `<line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/`,
  smartphone: `<rect x="6" y="2" width="12" height="20" rx="2.5"/><line x1="10" y1="18" x2="14" y2="18"/>`,
  cursor: `<path d="M4 3l7 17 2.5-6.5L20 11z"/>`,
  pin: `<path d="M12 21s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>`,
  info: `<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.8" r="0.6" fill="currentColor"/>`,
  lineChat: `<path d="M12 4c-4.9 0-9 3.2-9 7.2 0 3.6 3.3 6.6 7.8 7.1.3 0 .7.2.8.5.1.3 0 .8 0 1.1l-.1.7c0 .2.1.7.6.4.5-.2 3.2-1.9 4.4-3.2 1.6-1.3 3.5-3 3.5-6.6C20 7.2 16.9 4 12 4z"/>`,
};

export function icon(name, x, y, size, color = "currentColor", sw = 2) {
  const body = ICONS[name];
  if (!body) throw new Error("no icon " + name);
  const sc = size / 24;
  return `<g transform="translate(${x},${y}) scale(${sc})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body.replace(/currentColor/g, color)}</g>`;
}

// numbered step badge
export function badge(cx, cy, r, n, o = {}) {
  const { fill = C.gold, ring = C.goldPale, txt = "#FFFFFF" } = o;
  return circle(cx, cy, r + 5, ring) + circle(cx, cy, r, fill) +
    text(cx, cy + r * 0.34, String(n), { size: r * 1.05, weight: 700, fill: txt, anchor: "middle" });
}

export function chip(x, y, label, o = {}) {
  const { size = 22, fill = C.maroon, bg = C.goldPale, padX = 16, h = 40 } = o;
  const w = textWidth(label, size) + padX * 2;
  return { w, svg: rrect(x, y, w, h, h / 2, bg) + text(x + padX, y + h / 2 + size * 0.34, label, { size, weight: 600, fill }) };
}

export function svgDoc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
