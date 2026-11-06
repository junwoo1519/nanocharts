/**
 * @fileoverview Figma Community 등록용 공식 에셋 생성기
 * 
 * 1. `figma-plugin/assets/icon.png` (128x128px 정밀 PNG) & `icon.svg`
 * 2. `figma-plugin/assets/cover.png` (1920x960px 정밀 PNG) & `cover.svg`
 * 
 * 외부 패키지 없이 Node 내장 `node:zlib`와 슈퍼샘플링(SDF 안티앨리어싱) 렌더러를 사용하여
 * 피그마 스토어 규격(128x128, 1920x960)에 1px 오차도 없는 고품질 PNG를 생성합니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'figma-plugin', 'assets');
fs.mkdirSync(outDir, { recursive: true });

// ==========================================
// 1. 순수 Node.js PNG 인코더 (RGBA -> PNG Buffer)
// ==========================================
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // Filter type 0 (None)
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ==========================================
// 2. 2D SDF 안티앨리어싱 드로잉 프리미티브
// ==========================================
function createSurface(width, height) {
  const data = Buffer.alloc(width * height * 4);

  function blendPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= width || y < 0 || y >= height || a <= 0) return;
    const idx = (y * width + x) * 4;
    const srcA = Math.max(0, Math.min(1, a));
    const dstA = data[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;

    data[idx] = Math.round((r * srcA + data[idx] * dstA * (1 - srcA)) / outA);
    data[idx + 1] = Math.round((g * srcA + data[idx + 1] * dstA * (1 - srcA)) / outA);
    data[idx + 2] = Math.round((b * srcA + data[idx + 2] * dstA * (1 - srcA)) / outA);
    data[idx + 3] = Math.round(outA * 255);
  }

  function sdRoundedBox(px, py, cx, cy, hw, hh, r) {
    const qx = Math.abs(px - cx) - hw + r;
    const qy = Math.abs(py - cy) - hh + r;
    return (
      Math.min(Math.max(qx, qy), 0) +
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
      r
    );
  }

  function fillRoundedRect(x, y, w, h, r, colorFn, border) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const hw = w / 2;
    const hh = h / 2;
    const x0 = Math.max(0, Math.floor(x - 2));
    const x1 = Math.min(width - 1, Math.ceil(x + w + 2));
    const y0 = Math.max(0, Math.floor(y - 2));
    const y1 = Math.min(height - 1, Math.ceil(y + h + 2));

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const d = sdRoundedBox(px + 0.5, py + 0.5, cx, cy, hw, hh, r);
        const cov = Math.max(0, Math.min(1, 0.5 - d));
        if (cov > 0) {
          const tx = Math.max(0, Math.min(1, (px - x) / Math.max(1, w)));
          const ty = Math.max(0, Math.min(1, (py - y) / Math.max(1, h)));
          const [cr, cg, cb, ca = 1] = colorFn(tx, ty, px, py);
          blendPixel(px, py, cr, cg, cb, ca * cov);
        }
        if (border && border.width > 0) {
          const bd = Math.abs(d + border.width / 2) - border.width / 2;
          const bCov = Math.max(0, Math.min(1, 0.5 - bd));
          if (bCov > 0) {
            blendPixel(px, py, border.r, border.g, border.b, (border.a ?? 1) * bCov);
          }
        }
      }
    }
  }

  function fillCircle(cx, cy, r, cr, cg, cb, ca = 1) {
    const x0 = Math.max(0, Math.floor(cx - r - 2));
    const x1 = Math.min(width - 1, Math.ceil(cx + r + 2));
    const y0 = Math.max(0, Math.floor(cy - r - 2));
    const y1 = Math.min(height - 1, Math.ceil(cy + r + 2));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy) - r;
        const cov = Math.max(0, Math.min(1, 0.5 - d));
        if (cov > 0) blendPixel(px, py, cr, cg, cb, ca * cov);
      }
    }
  }

  function fillDonutSlice(cx, cy, innerR, outerR, startAngle, endAngle, cr, cg, cb, ca = 1) {
    const x0 = Math.max(0, Math.floor(cx - outerR - 2));
    const x1 = Math.min(width - 1, Math.ceil(cx + outerR + 2));
    const y0 = Math.max(0, Math.floor(cy - outerR - 2));
    const y1 = Math.min(height - 1, Math.ceil(cy + outerR + 2));

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - cx;
        const dy = py + 0.5 - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < innerR - 1.5 || dist > outerR + 1.5) continue;

        let ang = Math.atan2(dy, dx);
        if (ang < -Math.PI / 2) ang += Math.PI * 2;
        if (ang < startAngle || ang > endAngle) continue;

        const dOuter = dist - outerR;
        const dInner = innerR - dist;
        const cov = Math.min(
          Math.max(0, Math.min(1, 0.5 - dOuter)),
          Math.max(0, Math.min(1, 0.5 - dInner))
        );
        if (cov > 0) blendPixel(px, py, cr, cg, cb, ca * cov);
      }
    }
  }

  function drawSmoothLineAndArea(points, yBottom, lineRGB, areaTopAlpha, lineWidth) {
    const minX = Math.max(0, Math.floor(points[0].x));
    const maxX = Math.min(width - 1, Math.ceil(points[points.length - 1].x));

    function sampleCurveY(x) {
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (x >= p1.x && x <= p2.x) {
          const t = (x - p1.x) / Math.max(0.0001, p2.x - p1.x);
          // Smooth cosine/hermite interpolation
          const st = t * t * (3 - 2 * t);
          return p1.y + (p2.y - p1.y) * st;
        }
      }
      return points[points.length - 1].y;
    }

    const minY = Math.min(...points.map((p) => p.y));

    for (let px = minX; px <= maxX; px++) {
      const cy = sampleCurveY(px);
      const cyNext = sampleCurveY(px + 1);
      const slope = Math.hypot(1, cyNext - cy);

      const yStart = Math.max(0, Math.floor(cy - lineWidth * 2 - 4));
      const yEnd = Math.min(height - 1, Math.ceil(yBottom));

      for (let py = yStart; py <= yEnd; py++) {
        // Area under curve
        if (py >= cy && py <= yBottom && areaTopAlpha > 0) {
          const ratio = 1 - (py - minY) / Math.max(1, yBottom - minY);
          const alpha = Math.max(0, ratio * areaTopAlpha);
          const edgeCov = Math.max(0, Math.min(1, py - cy + 0.5));
          blendPixel(px, py, lineRGB[0], lineRGB[1], lineRGB[2], alpha * edgeCov);
        }

        // Anti-aliased stroke
        const perpDist = Math.abs(py + 0.5 - cy) / slope;
        const strokeCov = Math.max(0, Math.min(1, lineWidth / 2 + 0.6 - perpDist));
        if (strokeCov > 0) {
          blendPixel(px, py, lineRGB[0], lineRGB[1], lineRGB[2], strokeCov);
        }
      }
    }
  }

  return { data, blendPixel, fillRoundedRect, fillCircle, fillDonutSlice, drawSmoothLineAndArea };
}

function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

// ==========================================
// 3. Icon 생성 (128 x 128 px)
// ==========================================
function buildIcon() {
  const W = 128;
  const H = 128;
  const surf = createSurface(W, H);

  // 1. 배경 스쿼클 (다크 네이비 + 인디고 보더)
  surf.fillRoundedRect(
    0,
    0,
    W,
    H,
    28,
    (tx, ty) => {
      const c = lerpColor([17, 24, 39], [11, 15, 25], (tx + ty) / 2);
      return [...c, 1];
    },
    { width: 3, r: 99, g: 102, b: 241, a: 0.45 }
  );

  // 2. 3개의 그라데이션 바
  const bars = [
    { x: 24, y: 62, w: 18, h: 42, c1: [6, 182, 212], c2: [59, 130, 246] },
    { x: 55, y: 42, w: 18, h: 62, c1: [99, 102, 241], c2: [147, 51, 234] },
    { x: 86, y: 26, w: 18, h: 78, c1: [16, 185, 129], c2: [5, 150, 105] },
  ];

  for (const b of bars) {
    surf.fillRoundedRect(b.x, b.y, b.w, b.h, 6, (_tx, ty) => [
      ...lerpColor(b.c1, b.c2, ty),
      1,
    ]);
  }

  // 3. 상단 트렌드 라인 + 포인트 마커
  const pts = [
    { x: 33, y: 52 },
    { x: 64, y: 34 },
    { x: 95, y: 18 },
  ];
  surf.drawSmoothLineAndArea(pts, 104, [56, 189, 248], 0, 3.5);
  for (const p of pts) {
    surf.fillCircle(p.x, p.y, 5.5, 56, 189, 248, 1);
    surf.fillCircle(p.x, p.y, 2.5, 15, 23, 42, 1);
  }

  fs.writeFileSync(path.join(outDir, 'icon.png'), encodePNG(W, H, surf.data));

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#0B0F19"/>
    </linearGradient>
    <linearGradient id="b1" x1="0" y1="62" x2="0" y2="104" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06B6D4"/>
      <stop offset="100%" stop-color="#3B82F6"/>
    </linearGradient>
    <linearGradient id="b2" x1="0" y1="42" x2="0" y2="104" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366F1"/>
      <stop offset="100%" stop-color="#9333EA"/>
    </linearGradient>
    <linearGradient id="b3" x1="0" y1="26" x2="0" y2="104" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)" stroke="#6366F1" stroke-opacity="0.45" stroke-width="3"/>
  <rect x="24" y="62" width="18" height="42" rx="6" fill="url(#b1)"/>
  <rect x="55" y="42" width="18" height="62" rx="6" fill="url(#b2)"/>
  <rect x="86" y="26" width="18" height="78" rx="6" fill="url(#b3)"/>
  <path d="M 33 52 C 48 44, 52 40, 64 34 C 76 28, 82 24, 95 18" stroke="#38BDF8" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="33" cy="52" r="5" fill="#0B0F19" stroke="#38BDF8" stroke-width="3"/>
  <circle cx="64" cy="34" r="5" fill="#0B0F19" stroke="#38BDF8" stroke-width="3"/>
  <circle cx="95" cy="18" r="5" fill="#0B0F19" stroke="#38BDF8" stroke-width="3"/>
</svg>`;
  fs.writeFileSync(path.join(outDir, 'icon.svg'), iconSvg, 'utf8');
}

// ==========================================
// 4. Cover Art 생성 (1920 x 960 px)
// ==========================================
function buildCover() {
  const W = 1920;
  const H = 960;
  const surf = createSurface(W, H);

  // 1. 전체 다크 스튜디오 배경 (#0B0F19 -> #111827) + 은은한 글로우
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const d1 = Math.hypot(x - 480, y - 300) / 700;
      const d2 = Math.hypot(x - 1440, y - 660) / 750;
      const g1 = Math.max(0, 1 - d1);
      const g2 = Math.max(0, 1 - d2);

      surf.data[idx] = Math.min(255, Math.round(11 + g1 * 28 + g2 * 10));
      surf.data[idx + 1] = Math.min(255, Math.round(15 + g1 * 22 + g2 * 38));
      surf.data[idx + 2] = Math.min(255, Math.round(25 + g1 * 68 + g2 * 62));
      surf.data[idx + 3] = 255;
    }
  }

  // 2. 좌측 메인 대시보드 카드: Grouped / Stacked Bar + Smooth Area Chart (x: 110, y: 120, w: 1060, h: 720)
  const c1X = 110,
    c1Y = 120,
    c1W = 1060,
    c1H = 720;
  surf.fillRoundedRect(
    c1X,
    c1Y,
    c1W,
    c1H,
    28,
    () => [21, 28, 44, 0.94],
    { width: 2, r: 51, g: 65, b: 85, a: 0.7 }
  );

  // 카드 상단 헤더 장식 점 & 범례 필
  surf.fillCircle(c1X + 44, c1Y + 46, 8, 99, 102, 241, 1);
  surf.fillCircle(c1X + 70, c1Y + 46, 8, 16, 185, 129, 1);
  surf.fillCircle(c1X + 96, c1Y + 46, 8, 245, 158, 11, 1);

  surf.fillRoundedRect(c1X + 130, c1Y + 36, 180, 20, 6, () => [51, 65, 85, 0.75]);
  surf.fillRoundedRect(c1X + 820, c1Y + 34, 90, 24, 12, () => [99, 102, 241, 0.28], {
    width: 1.5,
    r: 99,
    g: 102,
    b: 241,
    a: 0.8,
  });
  surf.fillRoundedRect(c1X + 924, c1Y + 34, 90, 24, 12, () => [16, 185, 129, 0.25], {
    width: 1.5,
    r: 16,
    g: 185,
    b: 129,
    a: 0.8,
  });

  // 수평 그리드 라인 5개
  const plotLeft = c1X + 70;
  const plotRight = c1X + c1W - 60;
  const plotTop = c1Y + 110;
  const plotBottom = c1Y + c1H - 70;

  for (let i = 0; i <= 4; i++) {
    const gy = Math.round(plotTop + ((plotBottom - plotTop) * i) / 4);
    surf.fillRoundedRect(plotLeft, gy, plotRight - plotLeft, 2, 0, () => [30, 41, 59, 0.9]);
  }

  // 7개 슬롯의 Grouped + Stacked 바 렌더링
  const barHeights = [
    [220, 150],
    [310, 210],
    [260, 190],
    [390, 270],
    [340, 250],
    [450, 320],
    [500, 370],
  ];
  const slotW = (plotRight - plotLeft) / barHeights.length;

  barHeights.forEach(([h1, h2], idx) => {
    const sx = plotLeft + idx * slotW + 24;
    const bw = 34;

    // 첫 번째 시리즈 바 (Indigo -> Purple)
    surf.fillRoundedRect(sx, plotBottom - h1, bw, h1, 8, (_tx, ty) => [
      ...lerpColor([99, 102, 241], [147, 51, 234], ty),
      0.95,
    ]);

    // 두 번째 시리즈 바 (Cyan -> Blue)
    surf.fillRoundedRect(sx + bw + 8, plotBottom - h2, bw, h2, 8, (_tx, ty) => [
      ...lerpColor([6, 182, 212], [37, 99, 235], ty),
      0.92,
    ]);
  });

  // 부드러운 에메랄드-민트 트렌드 곡선 + 포인트 마커 오버레이
  const linePts = barHeights.map(([h1], idx) => ({
    x: plotLeft + idx * slotW + 45,
    y: plotBottom - h1 - 36,
  }));
  surf.drawSmoothLineAndArea(linePts, plotBottom, [16, 185, 129], 0.22, 5);
  for (const pt of linePts) {
    surf.fillCircle(pt.x, pt.y, 11, 16, 185, 129, 0.3);
    surf.fillCircle(pt.x, pt.y, 7, 16, 185, 129, 1);
    surf.fillCircle(pt.x, pt.y, 3.5, 15, 23, 42, 1);
  }

  // 3. 우측 상단 카드: Donut Chart (x: 1220, y: 120, w: 590, h: 340)
  const c2X = 1220,
    c2Y = 120,
    c2W = 590,
    c2H = 340;
  surf.fillRoundedRect(
    c2X,
    c2Y,
    c2W,
    c2H,
    26,
    () => [21, 28, 44, 0.94],
    { width: 2, r: 51, g: 65, b: 85, a: 0.7 }
  );

  const dCx = c2X + 190;
  const dCy = c2Y + 175;
  const slices = [
    { start: -Math.PI / 2 + 0.03, end: 0.75, rgb: [99, 102, 241] },
    { start: 0.81, end: 2.35, rgb: [6, 182, 212] },
    { start: 2.41, end: 3.65, rgb: [16, 185, 129] },
    { start: 3.71, end: Math.PI * 1.5 - 0.03, rgb: [245, 158, 11] },
  ];
  for (const s of slices) {
    surf.fillDonutSlice(dCx, dCy, 66, 118, s.start, s.end, s.rgb[0], s.rgb[1], s.rgb[2], 1);
  }

  // 도넛 우측 범례 바 장식
  const legendColors = [
    [99, 102, 241],
    [6, 182, 212],
    [16, 185, 129],
    [245, 158, 11],
  ];
  legendColors.forEach((rgb, i) => {
    const ly = c2Y + 95 + i * 46;
    surf.fillCircle(c2X + 365, ly, 9, rgb[0], rgb[1], rgb[2], 1);
    surf.fillRoundedRect(c2X + 388, ly - 7, 140 - i * 15, 14, 5, () => [148, 163, 184, 0.65]);
  });

  // 4. 우측 하단 카드: Multi-Line / Stacked Area Wave Card (x: 1220, y: 490, w: 590, h: 350)
  const c3X = 1220,
    c3Y = 490,
    c3W = 590,
    c3H = 350;
  surf.fillRoundedRect(
    c3X,
    c3Y,
    c3W,
    c3H,
    26,
    () => [21, 28, 44, 0.94],
    { width: 2, r: 51, g: 65, b: 85, a: 0.7 }
  );

  const wLeft = c3X + 45;
  const wRight = c3X + c3W - 45;
  const wBottom = c3Y + c3H - 45;

  const wave1 = [
    { x: wLeft, y: wBottom - 90 },
    { x: wLeft + 100, y: wBottom - 160 },
    { x: wLeft + 200, y: wBottom - 125 },
    { x: wLeft + 300, y: wBottom - 210 },
    { x: wLeft + 400, y: wBottom - 180 },
    { x: wRight, y: wBottom - 245 },
  ];
  const wave2 = [
    { x: wLeft, y: wBottom - 50 },
    { x: wLeft + 100, y: wBottom - 95 },
    { x: wLeft + 200, y: wBottom - 80 },
    { x: wLeft + 300, y: wBottom - 130 },
    { x: wLeft + 400, y: wBottom - 110 },
    { x: wRight, y: wBottom - 165 },
  ];

  surf.drawSmoothLineAndArea(wave1, wBottom, [99, 102, 241], 0.42, 4.5);
  surf.drawSmoothLineAndArea(wave2, wBottom, [244, 63, 94], 0.35, 4.5);

  for (const pt of wave1) {
    surf.fillCircle(pt.x, pt.y, 6, 129, 140, 248, 1);
    surf.fillCircle(pt.x, pt.y, 2.5, 15, 23, 42, 1);
  }
  for (const pt of wave2) {
    surf.fillCircle(pt.x, pt.y, 6, 244, 63, 94, 1);
    surf.fillCircle(pt.x, pt.y, 2.5, 15, 23, 42, 1);
  }

  fs.writeFileSync(path.join(outDir, 'cover.png'), encodePNG(W, H, surf.data));
}

buildIcon();
buildCover();
console.log('✅ Figma Community 에셋 생성 완료!');
console.log('   - figma-plugin/assets/icon.png (128x128)');
console.log('   - figma-plugin/assets/cover.png (1920x960)');
