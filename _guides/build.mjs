import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import {
  C, text, paragraph, rrect, card, circle, icon, badge, chip, svgDoc, wrap, textWidth,
} from "./lib.mjs";

const W = 1080;
const OUT = "guide-images";
fs.mkdirSync(OUT, { recursive: true });

// ---------- shared scene pieces ----------
function gem(x, y, s, fill = C.gold, fill2 = C.goldLt) {
  // simple faceted diamond
  const p = (a) => a.map(([px, py]) => `${x + px * s},${y + py * s}`).join(" ");
  return (
    `<polygon points="${p([[0.2,0],[0.8,0],[1,0.32],[0.5,1],[0,0.32]])}" fill="${fill}"/>` +
    `<polygon points="${p([[0.2,0],[0.5,0.32],[0,0.32]])}" fill="${fill2}"/>` +
    `<polygon points="${p([[0.8,0],[1,0.32],[0.5,0.32]])}" fill="${fill2}"/>` +
    `<polygon points="${p([[0,0.32],[0.5,0.32],[0.5,1]])}" fill="${fill}" opacity="0.85"/>` +
    `<polygon points="${p([[0.5,0.32],[1,0.32],[0.5,1]])}" fill="${fill2}" opacity="0.7"/>`
  );
}

function header(title, subtitle, pageLabel, accentIcon) {
  const H = 250;
  let s = "";
  // band gradient
  s += `<defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.maroon}"/><stop offset="1" stop-color="${C.maroonDk2}"/></linearGradient>
    <linearGradient id="goldg" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.goldLt}"/></linearGradient></defs>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#hg)"/>`;
  // faint decorative circles
  s += circle(W - 60, 40, 150, "#FFFFFF", { opacity: 0.04 });
  s += circle(120, H - 20, 120, C.gold, { opacity: 0.06 });
  // gold rule at bottom
  s += `<rect x="0" y="${H - 8}" width="${W}" height="8" fill="url(#goldg)"/>`;
  // gem + brand
  s += gem(60, 52, 56);
  s += text(150, 78, "ห้างเพชรทองมุกดา", { size: 30, weight: 600, fill: C.goldLt });
  s += text(150, 116, "ระบบพนักงาน", { size: 22, weight: 400, fill: "#E9D9C4" });
  // page chip
  if (pageLabel) {
    const pl = chip(W - 60 - (textWidth(pageLabel, 22) + 32), 50, pageLabel, { bg: "rgba(255,255,255,0.14)", fill: C.goldLt });
    s += pl.svg;
  }
  // title row
  let tx = 60;
  if (accentIcon) {
    s += circle(60 + 34, 182, 38, "rgba(255,255,255,0.12)");
    s += icon(accentIcon, 60 + 10, 158, 48, C.goldLt, 2.2);
    tx = 130;
  }
  s += text(tx, 178, title, { size: 46, weight: 700, fill: "#FFFFFF" });
  if (subtitle) s += text(tx, 218, subtitle, { size: 24, weight: 400, fill: "#EAD9C2" });
  return { svg: s, h: H };
}

function footer(y) {
  let s = "";
  s += `<rect x="0" y="${y}" width="${W}" height="2" fill="${C.line}"/>`;
  s += rrect(60, y + 28, 360, 56, 28, C.maroon);
  s += text(86, y + 28 + 36, "petchmukda-bot.web.app", { size: 24, weight: 600, fill: C.goldLt });
  s += text(W - 60, y + 28 + 36, "เข้าผ่านมือถือได้เลย", { size: 22, weight: 400, fill: C.faint, anchor: "end" });
  return { svg: s, h: 120 };
}

// numbered step block, returns {svg,h}
function step(x, y, n, title, desc, o = {}) {
  const w = o.w ?? (W - x - 60);
  const bx = x + 34;
  let s = badge(bx, y + 34, 28, n);
  s += text(x + 86, y + 30, title, { size: 30, weight: 700, fill: C.maroon });
  let h = 48;
  if (desc) {
    const p = paragraph(x + 86, y + 70, desc, { size: 25, fill: C.sub, maxW: w - 90, lh: 1.4 });
    s += p.svg;
    h = 44 + p.height;
  }
  // connector handled by caller
  return { svg: s, h: Math.max(h, 76) };
}

// keypoint callout box
function callout(x, y, w, txt, o = {}) {
  const { ic = "info", accent = C.gold, bg = C.goldPale, tcol = C.maroon } = o;
  const p = paragraph(x + 70, y + 40, txt, { size: 24, fill: tcol, maxW: w - 96, lh: 1.4, weight: 500 });
  const h = Math.max(76, p.height + 36);
  let s = rrect(x, y, w, h, 18, bg);
  s += rrect(x, y, 8, h, 4, accent);
  s += icon(ic, x + 22, y + h / 2 - 16, 32, accent, 2.2);
  s += p.svg;
  return { svg: s, h };
}

// phone frame; cb(ix,iy,iw,ih) returns inner svg
function phone(x, y, w, h, cb) {
  const r = 46;
  let s = `<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" rx="${r + 4}" fill="#000" opacity="0.08"/>`;
  s += rrect(x, y, w, h, r, "#2B2320"); // body
  s += rrect(x + 10, y + 10, w - 20, h - 20, r - 12, C.cream); // screen
  // notch
  s += rrect(x + w / 2 - 40, y + 16, 80, 14, 7, "#2B2320");
  const ix = x + 10, iy = y + 38, iw = w - 20, ih = h - 48;
  s += cb(ix, iy, iw, ih);
  return s;
}

// mini bottom-nav inside phone
function miniNav(ix, iy, iw, activeIdx) {
  const items = [["home", "หน้าแรก"], ["fileText", "ยื่นลา"], ["wallet", "เงินเดือน"], ["brain", "ความรู้"]];
  const navH = 70;
  const ny = iy;
  let s = rrect(ix, ny, iw, navH, 0, "#FFFFFF");
  s += `<rect x="${ix}" y="${ny}" width="${iw}" height="2" fill="${C.line}"/>`;
  const cw = iw / 4;
  items.forEach(([ic, lb], i) => {
    const cx = ix + cw * i + cw / 2;
    const active = i === activeIdx;
    const col = active ? C.gold : C.faint;
    if (active) s += rrect(cx - 26, ny + 6, 52, 4, 2, C.gold);
    s += icon(ic, cx - 14, ny + 12, 28, col, 2);
    s += text(cx, ny + 58, lb, { size: 15, weight: active ? 600 : 400, fill: col, anchor: "middle" });
  });
  return s;
}

function render(name, body, totalH) {
  const svg = svgDoc(W, totalH, `<rect width="${W}" height="${totalH}" fill="${C.cream}"/>` + body);
  const r = new Resvg(svg, { font: { fontDirs: ["./public/fonts"], defaultFontFamily: "Prompt", loadSystemFonts: false }, background: C.cream });
  const png = r.render().asPng();
  const path = `${OUT}/${name}.png`;
  fs.writeFileSync(path, png);
  console.log("wrote", path, (png.length / 1024).toFixed(0) + "kb");
}

// ============================================================
// IMAGE 1 — COVER / OVERVIEW
// ============================================================
function buildCover() {
  let s = "";
  const h = header("คู่มือใช้งานสำหรับพนักงาน", "เริ่มต้นใช้งานง่ายๆ ใน 4 เมนูหลัก", null, null);
  s += h.svg;
  let y = h.h + 40;

  s += text(60, y + 10, "ระบบนี้ทำอะไรได้บ้าง?", { size: 30, weight: 700, fill: C.maroon });
  y += 44;

  const tiles = [
    ["home", "หน้าแรก", "ดูโควต้าวันลาเดือนนี้ + หน้าที่ของวันนี้", C.maroon, C.goldPale],
    ["fileText", "ยื่นคำขอลา", "ลากิจ / ลาป่วย เลือกวันแล้วกดยื่นได้เลย", C.blue, C.blueBg],
    ["wallet", "เงินเดือน", "ดูเงินสุทธิ พิมพ์สลิป + หนังสือรับรอง", C.green, C.greenBg],
    ["brain", "ความรู้ต่างๆ", "ราคาทองวันนี้ + เครื่องคิดเลขราคา", C.silver, "#ECECEF"],
  ];
  const gap = 28, tw = (W - 120 - gap) / 2, th = 220;
  tiles.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const tx = 60 + col * (tw + gap);
    const ty = y + row * (th + gap);
    s += card(tx, ty, tw, th, 26);
    s += rrect(tx, ty, tw, 10, 5, t[3]);
    s += circle(tx + 56, ty + 70, 38, t[4]);
    s += icon(t[0], tx + 56 - 22, ty + 70 - 22, 44, t[3], 2.2);
    s += text(tx + 110, ty + 64, t[1], { size: 30, weight: 700, fill: C.maroon });
    const p = paragraph(tx + 110, ty + 104, t[2], { size: 23, fill: C.sub, maxW: tw - 130, lh: 1.35 });
    s += p.svg;
    s += text(tx + 32, ty + th - 30, "เมนูด้านล่างจอ", { size: 19, weight: 500, fill: t[3] });
  });
  y += th * 2 + gap + 40;

  // login note
  const co = callout(60, y, W - 120, "เข้าระบบครั้งแรก: เปิดเว็บแล้วกดปุ่มสีเขียว \"Login ด้วย LINE\" ด้วยบัญชี LINE ที่ลงทะเบียนกับร้าน", { ic: "lineChat", accent: C.lineGreen, bg: "#E8F8EE", tcol: "#1B5E36" });
  s += co.svg;
  y += co.h + 30;

  // mini nav demo
  s += text(60, y + 10, "แถบเมนูหลัก (อยู่ด้านล่างของจอเสมอ)", { size: 24, weight: 600, fill: C.maroon });
  y += 30;
  s += card(60, y, W - 120, 100, 22);
  s += miniNav(80, y + 16, W - 160, -1);
  y += 100 + 20;

  const f = footer(y);
  s += f.svg;
  y += f.h;
  render("0-ภาพรวม", s, y + 20);
}

// ============================================================
// IMAGE 2 — LOGIN
// ============================================================
function buildLogin() {
  let s = "";
  const h = header("วิธีเข้าสู่ระบบ", "ล็อกอินด้วยบัญชี LINE", "1 / 5", "login");
  s += h.svg;
  const top = h.h + 36;

  // phone mockup on right showing login screen
  const pw = 360, ph = 600;
  const px = W - 60 - pw, py = top;
  s += phone(px, py, pw, ph, (ix, iy, iw, ih) => {
    let p = rrect(ix, iy, iw, ih, 0, C.cream);
    p += gem(ix + iw / 2 - 34, iy + 70, 68);
    p += text(ix + iw / 2, iy + 190, "ห้างเพชรทองมุกดา", { size: 26, weight: 700, fill: C.maroon, anchor: "middle" });
    p += text(ix + iw / 2, iy + 222, "ระบบพนักงาน", { size: 18, fill: C.sub, anchor: "middle" });
    p += text(ix + iw / 2, iy + 300, "ยินดีต้อนรับ", { size: 24, weight: 600, fill: C.ink, anchor: "middle" });
    p += text(ix + iw / 2, iy + 332, "ลงชื่อเข้าใช้ด้วยบัญชี LINE", { size: 17, fill: C.sub, anchor: "middle" });
    // green LINE button
    const bw = iw - 80, bx = ix + 40, by = iy + 380;
    p += rrect(bx, by, bw, 64, 14, C.lineGreen);
    p += icon("lineChat", bx + 28, by + 16, 32, "#FFFFFF", 0);
    p += text(bx + bw / 2 + 16, by + 42, "Login ด้วย LINE", { size: 24, weight: 700, fill: "#FFFFFF", anchor: "middle" });
    // cursor
    p += icon("cursor", bx + bw / 2 + 60, by + 36, 34, C.maroon, 2);
    p += circle(bx + bw / 2 + 60, by + 36, 24, C.maroon, { opacity: 0.12 });
    return p;
  });

  // steps on left
  let y = top + 6;
  const colW = px - 60 - 40;
  const steps = [
    ["เปิดลิงก์ของระบบ", "พิมพ์ petchmukda-bot.web.app บนมือถือ หรือกดลิงก์ที่ร้านส่งให้ใน LINE"],
    ["กดปุ่มสีเขียว", "แตะปุ่ม \"Login ด้วย LINE\" ที่อยู่กลางจอ"],
    ["กดอนุญาต", "ถ้า LINE ถามให้ยืนยัน ให้กด \"อนุญาต\" เพื่อเชื่อมต่อบัญชี"],
    ["เข้าระบบสำเร็จ", "ระบบพาเข้าหน้าแรกอัตโนมัติ ครั้งต่อไปไม่ต้องล็อกอินซ้ำ"],
  ];
  steps.forEach((st, i) => {
    const r = step(60, y, i + 1, st[0], st[1], { w: colW });
    s += r.svg;
    // connector line to next
    if (i < steps.length - 1) {
      const nextY = y + r.h + 24;
      s += `<line x1="94" y1="${y + 70}" x2="94" y2="${nextY + 6}" stroke="${C.goldPale}" stroke-width="3"/>`;
    }
    y += r.h + 24;
  });

  let yBottom = Math.max(y, py + ph + 30);
  const co = callout(60, yBottom, W - 120, "ใช้บัญชี LINE ที่ลงทะเบียนกับร้านเท่านั้น — ถ้าขึ้นข้อความ \"ยังไม่พบข้อมูลพนักงาน\" ให้แจ้งแอดมินเพื่อเชื่อมบัญชีให้", { ic: "info", accent: C.gold });
  s += co.svg;
  yBottom += co.h + 24;

  const f = footer(yBottom);
  s += f.svg;
  render("1-เข้าสู่ระบบ", s, yBottom + f.h + 20);
}

// ============================================================
// IMAGE 3 — HOME + LEAVE REQUEST
// ============================================================
function buildLeave() {
  let s = "";
  const h = header("หน้าแรก + ยื่นใบลา", "ดูโควต้า แล้วยื่นลาได้ในไม่กี่ขั้นตอน", "2 / 5", "calendar");
  s += h.svg;
  const top = h.h + 36;

  // phone mockup: leave request screen
  const pw = 360, ph = 660;
  const px = W - 60 - pw, py = top;
  s += phone(px, py, pw, ph, (ix, iy, iw, ih) => {
    let p = rrect(ix, iy, iw, ih, 0, C.cream);
    let yy = iy + 20;
    // quota card
    p += card(ix + 20, yy, iw - 40, 96, 16, "#FFFFFF");
    p += text(ix + 40, yy + 36, "โควต้าการลาเดือนนี้", { size: 19, weight: 600, fill: C.maroon });
    p += text(ix + 40, yy + 70, "ใช้ไปแล้ว", { size: 16, fill: C.sub });
    p += text(ix + iw - 44, yy + 74, "0 / 2 วัน", { size: 30, weight: 700, fill: C.green, anchor: "end" });
    yy += 120;
    // leave type buttons
    p += text(ix + 40, yy, "ประเภทการลา", { size: 18, weight: 600, fill: C.ink });
    yy += 16;
    const bw = (iw - 56) / 2;
    p += rrect(ix + 20, yy, bw, 70, 14, C.blueBg, { stroke: C.blue, sw: 3 });
    p += icon("fileText", ix + 38, yy + 20, 28, C.blue, 2);
    p += text(ix + 20 + bw / 2 + 18, yy + 44, "ลากิจ", { size: 22, weight: 700, fill: C.blue, anchor: "middle" });
    p += circle(ix + 20 + bw - 14, yy + 14, 13, C.blue);
    p += icon("check", ix + 20 + bw - 23, yy + 5, 18, "#FFF", 2.6);
    p += rrect(ix + 36 + bw, yy, bw, 70, 14, "#FFFFFF", { stroke: C.line, sw: 2 });
    p += text(ix + 36 + bw + bw / 2, yy + 44, "ลาป่วย", { size: 22, weight: 600, fill: C.sub, anchor: "middle" });
    yy += 92;
    // date fields
    ["วันที่เริ่มลา", "วันที่สิ้นสุด"].forEach((lb) => {
      p += text(ix + 40, yy + 4, lb, { size: 16, fill: C.sub });
      p += rrect(ix + 20, yy + 14, iw - 40, 50, 12, "#FFFFFF", { stroke: C.line, sw: 2 });
      p += icon("calendar", ix + 32, yy + 26, 26, C.gold, 2);
      p += text(ix + 70, yy + 46, "22 มิ.ย. 2569", { size: 19, fill: C.ink });
      yy += 78;
    });
    // total days
    p += rrect(ix + 20, yy, iw - 40, 70, 14, C.goldPale);
    p += text(ix + 40, yy + 30, "รวมจำนวนวันทำการ", { size: 18, weight: 600, fill: C.maroon });
    p += text(ix + 40, yy + 54, "(ไม่รวมวันที่ร้านปิด)", { size: 14, fill: C.sub });
    p += text(ix + iw - 44, yy + 48, "1 วัน", { size: 28, weight: 700, fill: C.maroon, anchor: "end" });
    yy += 90;
    // submit
    p += rrect(ix + 20, yy, iw - 40, 60, 14, C.maroon);
    p += text(ix + iw / 2, yy + 39, "ยื่นคำขอลา", { size: 24, weight: 700, fill: "#FFFFFF", anchor: "middle" });
    return p;
  });

  // steps left
  let y = top + 4;
  const colW = px - 60 - 40;
  const steps = [
    ["ดูโควต้าที่หน้าแรก", "การ์ด \"โควต้าการลาเดือนนี้\" บอกว่าใช้ไปกี่วัน เหลือกี่วัน"],
    ["แตะเมนู \"ยื่นคำขอลา\"", "อยู่ที่แถบเมนูด้านล่างของจอ"],
    ["เลือกประเภท", "แตะ \"ลากิจ\" หรือ \"ลาป่วย\" (จะมีเครื่องหมายถูก)"],
    ["เลือกวันที่", "กำหนด \"วันที่เริ่มลา\" และ \"วันที่สิ้นสุด\" จากปฏิทิน"],
    ["กดยื่น แล้วยืนยัน", "กด \"ยื่นคำขอลา\" → ตรวจสรุป → \"ยืนยันยื่นคำขอ\""],
  ];
  steps.forEach((st, i) => {
    const r = step(60, y, i + 1, st[0], st[1], { w: colW });
    s += r.svg;
    if (i < steps.length - 1) s += `<line x1="94" y1="${y + 70}" x2="94" y2="${y + r.h + 30}" stroke="${C.goldPale}" stroke-width="3"/>`;
    y += r.h + 24;
  });

  let yB = Math.max(y, py + ph + 30);
  const c1 = callout(60, yB, W - 120, "โควต้า ลากิจ + ลาป่วย รวมกัน 2 วัน/เดือน · ลาเกินโควต้าจะมีผลต่อเงินเดือน · ลาวันที่ร้านปิดไม่นับและไม่หัก", { ic: "info", accent: C.gold });
  s += c1.svg;
  yB += c1.h + 16;
  const c2 = callout(60, yB, W - 120, "ใบลาที่ยังไม่ถึงวัน สามารถกดลบเองได้ที่ \"ประวัติการลาของคุณ\"", { ic: "check", accent: C.green, bg: C.greenBg, tcol: "#1B5E36" });
  s += c2.svg;
  yB += c2.h + 24;

  const f = footer(yB);
  s += f.svg;
  render("2-ยื่นใบลา", s, yB + f.h + 20);
}

// ============================================================
// IMAGE 4 — SALARY / SLIP
// ============================================================
function buildSalary() {
  let s = "";
  const h = header("ดูเงินเดือน + พิมพ์สลิป", "เช็คยอด พิมพ์สลิป และหนังสือรับรอง", "3 / 5", "wallet");
  s += h.svg;
  const top = h.h + 36;

  const pw = 360, ph = 640;
  const px = W - 60 - pw, py = top;
  s += phone(px, py, pw, ph, (ix, iy, iw, ih) => {
    let p = rrect(ix, iy, iw, ih, 0, C.cream);
    let yy = iy + 18;
    // month nav
    p += text(ix + 24, yy + 22, "สลิปเงินเดือน", { size: 18, weight: 600, fill: C.maroon });
    p += text(ix + iw - 24, yy + 22, "‹  มิ.ย. 2569  ›", { size: 18, weight: 600, fill: C.sub, anchor: "end" });
    yy += 44;
    // net salary card
    p += `<rect x="${ix + 20}" y="${yy}" width="${iw - 40}" height="130" rx="18" fill="${C.maroon}"/>`;
    p += text(ix + 44, yy + 40, "เงินสุทธิ", { size: 19, fill: C.goldLt });
    p += text(ix + 44, yy + 96, "18,540 ฿", { size: 46, weight: 700, fill: "#FFFFFF" });
    p += text(ix + iw - 44, yy + 56, "+ รายรับ", { size: 15, fill: "#9FE3B5", anchor: "end" });
    p += text(ix + iw - 44, yy + 82, "− รายการหัก", { size: 15, fill: "#F2B7AE", anchor: "end" });
    yy += 154;
    // two action buttons
    const bw = (iw - 56) / 2;
    p += rrect(ix + 20, yy, bw, 60, 14, C.maroon);
    p += icon("printer", ix + 40, yy + 16, 28, "#FFF", 2);
    p += text(ix + 20 + bw / 2 + 16, yy + 38, "พิมพ์สลิป", { size: 20, weight: 700, fill: "#FFF", anchor: "middle" });
    p += rrect(ix + 36 + bw, yy, bw, 60, 14, "#FFFFFF", { stroke: C.maroon, sw: 2.5 });
    p += icon("fileText", ix + 36 + bw + 18, yy + 16, 28, C.maroon, 2);
    p += text(ix + 36 + bw + bw / 2 + 14, yy + 38, "ใบรับรอง", { size: 20, weight: 700, fill: C.maroon, anchor: "middle" });
    yy += 84;
    // earnings list
    p += text(ix + 40, yy + 4, "รายรับ", { size: 17, weight: 700, fill: C.green });
    yy += 18;
    const rows = [["เงินเดือนพื้นฐาน", "+ 15,000"], ["โบนัสแห่งความขยัน", "+ 1,000"], ["ค่าคอมขาย", "+ 3,200"]];
    rows.forEach(([a, b]) => {
      p += text(ix + 40, yy + 24, a, { size: 18, fill: C.ink });
      p += text(ix + iw - 44, yy + 24, b, { size: 18, weight: 600, fill: C.green, anchor: "end" });
      p += `<line x1="${ix + 40}" y1="${yy + 40}" x2="${ix + iw - 40}" y2="${yy + 40}" stroke="${C.line}" stroke-width="1.5"/>`;
      yy += 46;
    });
    p += text(ix + 40, yy + 24, "หักประกันสังคม", { size: 18, fill: C.ink });
    p += text(ix + iw - 44, yy + 24, "− 750", { size: 18, weight: 600, fill: C.red, anchor: "end" });
    return p;
  });

  let y = top + 4;
  const colW = px - 60 - 40;
  const steps = [
    ["แตะเมนู \"เงินเดือน\"", "อยู่ที่แถบเมนูด้านล่างของจอ"],
    ["เลือกเดือน", "ใช้ลูกศร ‹ › เพื่อดูเดือนที่ต้องการ"],
    ["ดูยอดและรายการ", "ดู \"เงินสุทธิ\" พร้อมรายรับและรายการหักทั้งหมด"],
    ["พิมพ์สลิป", "กด \"พิมพ์สลิป\" → เลือก \"ทั้งหมด\" หรือ \"บางส่วน\" → \"พิมพ์\""],
    ["พิมพ์หนังสือรับรอง", "กด \"ใบรับรอง\" → เลือกวัตถุประสงค์ → \"พิมพ์\""],
  ];
  steps.forEach((st, i) => {
    const r = step(60, y, i + 1, st[0], st[1], { w: colW });
    s += r.svg;
    if (i < steps.length - 1) s += `<line x1="94" y1="${y + 70}" x2="94" y2="${y + r.h + 30}" stroke="${C.goldPale}" stroke-width="3"/>`;
    y += r.h + 24;
  });

  let yB = Math.max(y, py + ph + 30);
  const c1 = callout(60, yB, W - 120, "ถ้าขึ้น \"รอ ADMIN ยืนยันยอด\" แปลว่ายอดยังเป็นแค่ประมาณการ — ปุ่มพิมพ์สลิปจะใช้ได้หลังแอดมินยืนยันยอดแล้ว", { ic: "bell", accent: C.gold });
  s += c1.svg;
  yB += c1.h + 16;
  const c2 = callout(60, yB, W - 120, "ต้องการเงินก่อนสิ้นเดือน? กดปุ่ม \"เบิกเงิน\" เพื่อขอเบิกล่วงหน้า และดู \"ประวัติเบิกเงิน\" ได้", { ic: "coins", accent: C.green, bg: C.greenBg, tcol: "#1B5E36" });
  s += c2.svg;
  yB += c2.h + 24;

  const f = footer(yB);
  s += f.svg;
  render("3-เงินเดือน", s, yB + f.h + 20);
}

// ============================================================
// IMAGE 5 — KNOWLEDGE + CALCULATOR
// ============================================================
function buildKnowledge() {
  let s = "";
  const h = header("ความรู้ + เครื่องคิดเลข", "ราคาทองวันนี้ และคำนวณราคาได้ทันที", "4 / 5", "brain");
  s += h.svg;
  const top = h.h + 36;

  const pw = 360, ph = 640;
  const px = W - 60 - pw, py = top;
  s += phone(px, py, pw, ph, (ix, iy, iw, ih) => {
    let p = rrect(ix, iy, iw, ih, 0, C.cream);
    let yy = iy + 18;
    // gold price header
    p += `<rect x="${ix + 20}" y="${yy}" width="${iw - 40}" height="92" rx="16" fill="${C.maroon}"/>`;
    p += text(ix + 40, yy + 34, "ราคาทองคำแท่ง 96.5%", { size: 18, fill: C.goldLt });
    p += text(ix + 40, yy + 74, "52,150", { size: 38, weight: 700, fill: "#FFFFFF" });
    p += text(ix + iw - 44, yy + 74, "฿/บาท", { size: 18, fill: C.goldLt, anchor: "end" });
    yy += 112;
    // search
    p += rrect(ix + 20, yy, iw - 40, 52, 26, "#FFFFFF", { stroke: C.line, sw: 2 });
    p += icon("search", ix + 36, yy + 13, 26, C.faint, 2);
    p += text(ix + 72, yy + 34, "ค้นหาหัวข้อ...", { size: 19, fill: C.faint });
    yy += 72;
    // accordion items
    const accs = ["มาตรฐานน้ำหนัก (สคบ.)", "ราคาขาย ทอง 96.5%", "ค่าเปลี่ยน นน. เท่ากัน"];
    accs.forEach((a, i) => {
      p += rrect(ix + 20, yy, iw - 40, 50, 12, "#FFFFFF", { stroke: C.line, sw: 1.5 });
      p += icon(i === 1 ? "coins" : "calc", ix + 34, yy + 13, 24, i === 1 ? C.gold : C.silver, 2);
      p += text(ix + 70, yy + 32, a, { size: 18, weight: 600, fill: C.maroon });
      p += text(ix + iw - 44, yy + 32, i === 1 ? "˅" : "›", { size: 22, weight: 700, fill: C.faint, anchor: "end" });
      yy += 58;
      if (i === 1) {
        // expanded calculator
        p += rrect(ix + 20, yy, iw - 40, 188, 14, C.goldPale);
        p += text(ix + 40, yy + 30, "เครื่องคิดเลขราคาขาย", { size: 17, weight: 700, fill: C.maroon });
        // input rows
        p += text(ix + 40, yy + 62, "น้ำหนักสินค้า (กรัม)", { size: 15, fill: C.sub });
        p += rrect(ix + 40, yy + 72, iw - 80, 40, 10, "#FFFFFF", { stroke: C.line, sw: 1.5 });
        p += text(ix + 56, yy + 98, "3.79", { size: 18, fill: C.ink });
        // output
        p += rrect(ix + 40, yy + 124, iw - 80, 48, 10, C.maroon);
        p += text(ix + 56, yy + 154, "ราคาขายต่อชิ้น", { size: 15, fill: C.goldLt });
        p += text(ix + iw - 56, yy + 154, "12,650 ฿", { size: 22, weight: 700, fill: "#FFFFFF", anchor: "end" });
        yy += 200;
      }
    });
    return p;
  });

  let y = top + 4;
  const colW = px - 60 - 40;
  const steps = [
    ["แตะเมนู \"ความรู้ต่างๆ\"", "อยู่ที่แถบเมนูด้านล่างของจอ"],
    ["ดูราคาทองวันนี้", "แถบบนสุดบอก \"ราคาทองคำแท่ง 96.5%\" อัปเดตเองอัตโนมัติ"],
    ["ค้นหาหัวข้อ", "พิมพ์ในช่อง \"ค้นหาหัวข้อ...\" เช่น ราคาขาย, ค่าเปลี่ยน"],
    ["แตะหัวข้อเพื่อกาง", "เปิดดูตาราง สูตร และเครื่องคิดเลขในหัวข้อนั้น"],
    ["กรอกเลขในเครื่องคิดเลข", "ใส่น้ำหนัก/ค่าแรง แล้วได้ราคาทันที (อิงราคาทองวันนี้)"],
  ];
  steps.forEach((st, i) => {
    const r = step(60, y, i + 1, st[0], st[1], { w: colW });
    s += r.svg;
    if (i < steps.length - 1) s += `<line x1="94" y1="${y + 70}" x2="94" y2="${y + r.h + 30}" stroke="${C.goldPale}" stroke-width="3"/>`;
    y += r.h + 24;
  });

  let yB = Math.max(y, py + ph + 30);
  const c1 = callout(60, yB, W - 120, "มีหัวข้อให้ดูกว่า 15 เรื่อง เช่น มาตรฐานน้ำหนัก, ราคาขายทอง 96.5%/99.99%/นาก/เงิน, ค่าเปลี่ยน, แปลงน้ำหนักเป็นกรัม", { ic: "info", accent: C.gold });
  s += c1.svg;
  yB += c1.h + 24;

  const f = footer(yB);
  s += f.svg;
  render("4-ความรู้และเครื่องคิดเลข", s, yB + f.h + 20);
}

buildCover();
buildLogin();
buildLeave();
buildSalary();
buildKnowledge();
console.log("done");
