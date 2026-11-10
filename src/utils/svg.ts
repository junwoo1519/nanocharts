/**
 * @fileoverview 피그마(`figma.createNodeFromSvg`) 호환 순수 벡터(SVG) 직렬화 유틸리티
 * 
 * Canvas 2D로 그려지는 모든 차트 요소(둥근 사각형, 그라데이션, 베지에 곡선, 도넛 아크, 축, 격자선, 범례, 텍스트)를
 * 피그마에서 Frame, Rectangle, Vector, Text 노드로 깔끔하게 분해·편집할 수 있는 표준 SVG 문자열로 변환합니다.
 */

import type {
  AxisOptions,
  BorderRadius,
  ColorStyle,
  DataItem,
  GradientConfig,
  GridOptions,
  LegendItem,
  LegendOptions,
  LineCurveType,
  LinePointGeometry,
  Padding,
} from '../types';
import { BandScale } from '../scale/BandScale';
import { LinearScale } from '../scale/LinearScale';
import { resolveGridLineDash } from '../components/Grid';
import { parseLegendAnchor } from '../components/Legend';
import { resolveColor } from './tokens';

/**
 * XML/SVG 특수문자 이스케이프
 */
export function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 소수점 2자리 반올림 포맷터 (SVG 용량 절감 및 정밀도 유지)
 */
export function fmt(n: number): string {
  return Number.isFinite(n) ? Number(n.toFixed(2)).toString() : '0';
}

/**
 * CSS 색상 문자열(`#hex`, `rgb()`, `rgba()`)을 피그마 SVG 파서가 가장 정확하게 인식하는
 * `{ color: '#RRGGBB', opacity: number }` 형태로 분리합니다.
 */
export function parseSvgColor(input: string): { color: string; opacity: number } {
  const resolved = resolveColor(input || '#226CFF');
  const trimmed = resolved.trim();
  if (trimmed === 'transparent' || trimmed === 'none') {
    return { color: 'none', opacity: 0 };
  }

  const rgbaMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgbaMatch) {
    const r = Math.max(0, Math.min(255, parseInt(rgbaMatch[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(rgbaMatch[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(rgbaMatch[3], 10)));
    const a = rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4]))) : 1;
    const hex =
      '#' +
      [r, g, b]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    return { color: hex, opacity: a };
  }

  return { color: trimmed, opacity: 1 };
}

/**
 * SVG `<defs>` 내에 선형 그라데이션(`<linearGradient>`)을 등록하고 `url(#id)` 참조 문자열을 반환합니다.
 */
export function createSvgGradientDef(
  defs: string[],
  id: string,
  config: GradientConfig,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  const isHorizontal = config.direction === 'horizontal';
  const x1 = fmt(x);
  const y1 = fmt(y);
  const x2 = fmt(isHorizontal ? x + width : x);
  const y2 = fmt(isHorizontal ? y : y + height);

  const fromParsed = parseSvgColor(config.from);
  const toParsed = parseSvgColor(config.to);

  defs.push(
    `<linearGradient id="${escapeXml(id)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0%" stop-color="${escapeXml(fromParsed.color)}" stop-opacity="${fmt(fromParsed.opacity)}" />` +
      `<stop offset="100%" stop-color="${escapeXml(toParsed.color)}" stop-opacity="${fmt(toParsed.opacity)}" />` +
      `</linearGradient>`
  );

  return `url(#${id})`;
}

/**
 * 단색 또는 그라데이션 `ColorStyle`을 SVG `fill` / `stroke` 속성 문자열로 변환합니다.
 */
export function resolveSvgPaintAttrs(
  attrPrefix: 'fill' | 'stroke',
  style: ColorStyle,
  defs: string[],
  gradId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extraOpacity: number = 1
): string {
  if (typeof style === 'string') {
    const parsed = parseSvgColor(style);
    const totalOpacity = parsed.opacity * extraOpacity;
    const opacityAttr = totalOpacity < 0.999 ? ` ${attrPrefix}-opacity="${fmt(totalOpacity)}"` : '';
    return `${attrPrefix}="${escapeXml(parsed.color)}"${opacityAttr}`;
  }

  const url = createSvgGradientDef(defs, gradId, style, x, y, width, height);
  const opacityAttr = extraOpacity < 0.999 ? ` ${attrPrefix}-opacity="${fmt(extraOpacity)}"` : '';
  return `${attrPrefix}="${url}"${opacityAttr}`;
}

/**
 * CSS 폰트 문자열(예: `'600 11px Pretendard, sans-serif'`)에서 두께, 크기, 패밀리를 추출합니다.
 */
export function parseCssFont(fontStr?: string): {
  fontWeight: string;
  fontSize: number;
  fontFamily: string;
} {
  const fallback = {
    fontWeight: '500',
    fontSize: 11,
    fontFamily: 'Pretendard, Inter, -apple-system, sans-serif',
  };
  if (!fontStr) return fallback;

  const sizeMatch = fontStr.match(/(\d+(?:\.\d+)?)px/i);
  const fontSize = sizeMatch ? parseFloat(sizeMatch[1]) : 11;

  const weightMatch = fontStr.match(/^\s*(bold|normal|[1-9]00)\b/i);
  const fontWeight = weightMatch ? weightMatch[1] : '500';

  const familyPart = fontStr.replace(/^\s*(?:bold|normal|[1-9]00)?\s*\d+(?:\.\d+)?px\s*/i, '').trim();
  const fontFamily = (familyPart || fallback.fontFamily).replace(/"/g, "'");

  return { fontWeight, fontSize, fontFamily };
}

/**
 * 피그마 호환 `<text>` 요소를 생성합니다.
 * 피그마의 `createNodeFromSvg`는 `dominant-baseline`을 무시하는 경우가 있으므로
 * `baseline` 기준에 맞춰 Y 좌표를 수학적으로 보정하여 픽셀 단위로 정확히 배치합니다.
 */
export function svgTextElement(params: {
  id?: string;
  x: number;
  y: number;
  text: string;
  font?: string;
  fill?: string;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'middle' | 'bottom';
}): string {
  const { id, x, y, text, font, fill = '#94A3B8', align = 'center', baseline = 'middle' } = params;
  const { fontWeight, fontSize, fontFamily } = parseCssFont(font);
  const parsedColor = parseSvgColor(fill);

  let anchor = 'middle';
  if (align === 'left') anchor = 'start';
  else if (align === 'right') anchor = 'end';

  let adjustedY = y;
  if (baseline === 'middle') {
    adjustedY = y + fontSize * 0.35;
  } else if (baseline === 'top') {
    adjustedY = y + fontSize * 0.85;
  } else if (baseline === 'bottom') {
    adjustedY = y - fontSize * 0.1;
  }

  const idAttr = id ? ` id="${escapeXml(id)}"` : '';
  const opacityAttr = parsedColor.opacity < 0.999 ? ` fill-opacity="${fmt(parsedColor.opacity)}"` : '';

  return `<text${idAttr} x="${fmt(x)}" y="${fmt(adjustedY)}" text-anchor="${anchor}" fill="${escapeXml(parsedColor.color)}"${opacityAttr} font-family="${escapeXml(fontFamily)}" font-size="${fmt(fontSize)}" font-weight="${escapeXml(fontWeight)}">${escapeXml(text)}</text>`;
}

/**
 * 둥근 모서리 사각형을 피그마 친화적인 `<rect>` 또는 `<path>` 태그로 변환합니다.
 * - 4개 모서리 반지름이 동일하면 `<rect rx="..." />`를 사용하여 피그마에서 Rectangle 노드로 인식되게 합니다.
 * - 상단만 둥근 바(`[6, 6, 0, 0]`)처럼 모서리별 반지름이 다르면 정밀 `<path>` 벡터로 생성합니다.
 */
export function svgRoundedRectElement(params: {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: BorderRadius;
  fillAttrs: string;
  strokeAttrs?: string;
}): string {
  const { id, x, y, width, height, radius = 0, fillAttrs, strokeAttrs = '' } = params;
  if (width <= 0 || height <= 0) return '';

  let rawTl = 0,
    rawTr = 0,
    rawBr = 0,
    rawBl = 0;
  if (typeof radius === 'number') {
    rawTl = rawTr = rawBr = rawBl = Math.max(0, radius);
  } else if (Array.isArray(radius)) {
    rawTl = Math.max(0, radius[0] || 0);
    rawTr = Math.max(0, radius[1] || 0);
    rawBr = Math.max(0, radius[2] || 0);
    rawBl = Math.max(0, radius[3] || 0);
  }

  const maxR = Math.min(width / 2, height / 2);
  const tl = Math.max(0, Math.min(rawTl, maxR));
  const tr = Math.max(0, Math.min(rawTr, maxR));
  const br = Math.max(0, Math.min(rawBr, maxR));
  const bl = Math.max(0, Math.min(rawBl, maxR));

  const idAttr = id ? ` id="${escapeXml(id)}"` : '';
  const strokePart = strokeAttrs ? ` ${strokeAttrs}` : '';
  const cornersMeta =
    rawTl > 0 || rawTr > 0 || rawBr > 0 || rawBl > 0
      ? ` data-corners="${fmt(rawTl)},${fmt(rawTr)},${fmt(rawBr)},${fmt(rawBl)}" data-box="${fmt(x)},${fmt(y)},${fmt(width)},${fmt(height)}"`
      : '';

  if (rawTl === rawTr && rawTr === rawBr && rawBr === rawBl) {
    const rxAttr = rawTl > 0 ? ` rx="${fmt(rawTl)}" ry="${fmt(rawTl)}"` : '';
    return `<rect${idAttr} x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}"${rxAttr}${cornersMeta} ${fillAttrs}${strokePart} />`;
  }

  const d = [
    `M ${fmt(x + tl)} ${fmt(y)}`,
    `L ${fmt(x + width - tr)} ${fmt(y)}`,
    tr > 0 ? `A ${fmt(tr)} ${fmt(tr)} 0 0 1 ${fmt(x + width)} ${fmt(y + tr)}` : '',
    `L ${fmt(x + width)} ${fmt(y + height - br)}`,
    br > 0 ? `A ${fmt(br)} ${fmt(br)} 0 0 1 ${fmt(x + width - br)} ${fmt(y + height)}` : '',
    `L ${fmt(x + bl)} ${fmt(y + height)}`,
    bl > 0 ? `A ${fmt(bl)} ${fmt(bl)} 0 0 1 ${fmt(x)} ${fmt(y + height - bl)}` : '',
    `L ${fmt(x)} ${fmt(y + tl)}`,
    tl > 0 ? `A ${fmt(tl)} ${fmt(tl)} 0 0 1 ${fmt(x + tl)} ${fmt(y)}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');

  return `<path${idAttr}${cornersMeta} d="${d}" ${fillAttrs}${strokePart} />`;
}

/**
 * 라인 포인트 배열을 SVG 경로(`d` 속성 문자열)로 변환합니다 (`linear` | `smooth` | `step`).
 */
export function buildSvgLinePathData(
  points: LinePointGeometry[],
  curve: LineCurveType = 'smooth',
  tension: number = 0.35,
  connectFromCurrent: boolean = false
): string {
  if (points.length === 0) return '';

  const cmds: string[] = [];
  cmds.push(`${connectFromCurrent ? 'L' : 'M'} ${fmt(points[0].x)} ${fmt(points[0].y)}`);

  if (points.length === 1) return cmds.join(' ');

  const clampedTension = Math.max(0, Math.min(1, tension));

  if (curve === 'linear') {
    for (let i = 1; i < points.length; i++) {
      cmds.push(`L ${fmt(points[i].x)} ${fmt(points[i].y)}`);
    }
  } else if (curve === 'step') {
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      cmds.push(`L ${fmt(midX)} ${fmt(prev.y)}`);
      cmds.push(`L ${fmt(midX)} ${fmt(curr.y)}`);
      cmds.push(`L ${fmt(curr.x)} ${fmt(curr.y)}`);
    }
  } else {
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i > 0 ? i - 1 : 0];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + ((p2.x - p0.x) * clampedTension) / 2;
      const cp1y = p1.y + ((p2.y - p0.y) * clampedTension) / 2;
      const cp2x = p2.x - ((p3.x - p1.x) * clampedTension) / 2;
      const cp2y = p2.y - ((p3.y - p1.y) * clampedTension) / 2;

      cmds.push(
        `C ${fmt(cp1x)} ${fmt(cp1y)}, ${fmt(cp2x)} ${fmt(cp2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`
      );
    }
  }

  return cmds.join(' ');
}

/**
 * 파이/도넛 부채꼴 조각의 SVG `<path d="..." />` 문자열을 생성합니다.
 */
export function buildSvgPieSlicePathData(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return '';

  // 360도 전체 원(단일 항목 100%)인 경우 두 개의 반원 아크로 분할하여 SVG 아크 소실 방지
  if (sweep >= Math.PI * 2 - 0.0001) {
    const midAngle = startAngle + Math.PI;
    return (
      buildSvgPieSlicePathData(cx, cy, innerRadius, outerRadius, startAngle, midAngle - 0.0005) +
      ' ' +
      buildSvgPieSlicePathData(cx, cy, innerRadius, outerRadius, midAngle - 0.0005, endAngle)
    );
  }

  const largeArc = sweep > Math.PI ? 1 : 0;

  const ox1 = cx + Math.cos(startAngle) * outerRadius;
  const oy1 = cy + Math.sin(startAngle) * outerRadius;
  const ox2 = cx + Math.cos(endAngle) * outerRadius;
  const oy2 = cy + Math.sin(endAngle) * outerRadius;

  if (innerRadius <= 0) {
    return [
      `M ${fmt(cx)} ${fmt(cy)}`,
      `L ${fmt(ox1)} ${fmt(oy1)}`,
      `A ${fmt(outerRadius)} ${fmt(outerRadius)} 0 ${largeArc} 1 ${fmt(ox2)} ${fmt(oy2)}`,
      'Z',
    ].join(' ');
  }

  const ix1 = cx + Math.cos(endAngle) * innerRadius;
  const iy1 = cy + Math.sin(endAngle) * innerRadius;
  const ix2 = cx + Math.cos(startAngle) * innerRadius;
  const iy2 = cy + Math.sin(startAngle) * innerRadius;

  return [
    `M ${fmt(ox1)} ${fmt(oy1)}`,
    `A ${fmt(outerRadius)} ${fmt(outerRadius)} 0 ${largeArc} 1 ${fmt(ox2)} ${fmt(oy2)}`,
    `L ${fmt(ix1)} ${fmt(iy1)}`,
    `A ${fmt(innerRadius)} ${fmt(innerRadius)} 0 ${largeArc} 0 ${fmt(ix2)} ${fmt(iy2)}`,
    'Z',
  ].join(' ');
}

/**
 * 배경 격자선(수평 Y, 수직 X, 줄무늬 배경, 플롯 외곽 박스)을 `<g id="Grid">` 벡터 그룹으로 변환합니다.
 */
export function buildSvgGridGroup(
  options: GridOptions | undefined,
  yScale: LinearScale,
  chartWidth: number,
  padding: Padding,
  xScale?: BandScale,
  chartHeight?: number
): string {
  const left = padding.left;
  const right = chartWidth - padding.right;
  const [yRangeBottom, yRangeTop] = yScale.range();
  const top = Math.min(yRangeTop, yRangeBottom);
  const bottom = chartHeight ? chartHeight - padding.bottom : Math.max(yRangeTop, yRangeBottom);
  const plotW = Math.max(0, right - left);
  const plotH = Math.max(0, bottom - top);

  const ticks = yScale.ticks(5);
  const els: string[] = [];

  // 1. 줄무늬 배경 (Alternate Band)
  if (options?.alternateBand?.visible && plotW > 0 && plotH > 0) {
    const parsedBand = parseSvgColor(options.alternateBand.color || 'rgba(148, 163, 184, 0.06)');
    const opAttr = parsedBand.opacity < 0.999 ? ` fill-opacity="${fmt(parsedBand.opacity)}"` : '';
    const dir = options.alternateBand.direction || 'horizontal';

    if (dir === 'vertical' && xScale) {
      const [start, end] = xScale.getViewport();
      const step = xScale.step();
      const bw = xScale.bandwidth();
      for (let i = start; i <= end; i++) {
        if (i % 2 === 1) {
          const slotX = xScale.scale(i) - (step - bw) / 2;
          const clampedX = Math.max(left, slotX);
          const clampedW = Math.min(right, slotX + step) - clampedX;
          if (clampedW > 0) {
            els.push(
              `<rect id="Grid Band X (${i})" x="${fmt(clampedX)}" y="${fmt(top)}" width="${fmt(clampedW)}" height="${fmt(plotH)}" fill="${escapeXml(parsedBand.color)}"${opAttr} />`
            );
          }
        }
      }
    } else if (ticks.length >= 2) {
      for (let i = 0; i < ticks.length - 1; i++) {
        if (i % 2 === 0) {
          const y1 = yScale.scale(ticks[i]);
          const y2 = yScale.scale(ticks[i + 1]);
          const bandTop = Math.min(y1, y2);
          const bandH = Math.abs(y1 - y2);
          els.push(
            `<rect id="Grid Band Y (${i})" x="${fmt(left)}" y="${fmt(bandTop)}" width="${fmt(plotW)}" height="${fmt(bandH)}" fill="${escapeXml(parsedBand.color)}"${opAttr} />`
          );
        }
      }
    }
  }

  // 2. 수평(Y) 격자선
  const yGrid = options?.y ?? { visible: true, color: '#1E293B', lineWidth: 1, lineDash: [3, 3] };
  if (yGrid.visible !== false) {
    const parsedColor = parseSvgColor(yGrid.color || '#1E293B');
    const yDash = resolveGridLineDash(yGrid, [3, 3]);
    const dashAttr = yDash.length > 0 ? ` stroke-dasharray="${yDash.join(' ')}"` : '';
    const totalOpacity = parsedColor.opacity * (yGrid.opacity ?? 1);
    const opacityAttr = totalOpacity < 0.999 ? ` stroke-opacity="${fmt(totalOpacity)}"` : '';

    for (const tick of ticks) {
      const y = Math.round(yScale.scale(tick)) + 0.5;
      els.push(
        `<line id="Grid Line (${tick})" x1="${fmt(left)}" y1="${fmt(y)}" x2="${fmt(right)}" y2="${fmt(y)}" stroke="${escapeXml(parsedColor.color)}"${opacityAttr} stroke-width="${fmt(yGrid.lineWidth || 1)}"${dashAttr} />`
      );
    }
  }

  // 3. 수직(X) 격자선
  const xGrid = options?.x;
  if (xGrid?.visible && xScale) {
    const [start, end] = xScale.getViewport();
    const bandwidth = xScale.bandwidth();
    const parsedColor = parseSvgColor(xGrid.color || '#1E293B');
    const xDash = resolveGridLineDash(xGrid, [3, 3]);
    const dashAttr = xDash.length > 0 ? ` stroke-dasharray="${xDash.join(' ')}"` : '';
    const totalOpacity = parsedColor.opacity * (xGrid.opacity ?? 1);
    const opacityAttr = totalOpacity < 0.999 ? ` stroke-opacity="${fmt(totalOpacity)}"` : '';

    for (let i = start; i <= end; i++) {
      const x = Math.round(xScale.scale(i) + bandwidth / 2) + 0.5;
      if (x >= left && x <= right) {
        els.push(
          `<line id="Grid Line X (${i})" x1="${fmt(x)}" y1="${fmt(top)}" x2="${fmt(x)}" y2="${fmt(bottom)}" stroke="${escapeXml(parsedColor.color)}"${opacityAttr} stroke-width="${fmt(xGrid.lineWidth || 1)}"${dashAttr} />`
        );
      }
    }
  }

  // 4. 플롯 외곽 테두리 박스 (Plot Border)
  const border = options?.border;
  if (border?.visible && plotW > 0 && plotH > 0) {
    const parsedBorder = parseSvgColor(border.color || '#CBD5E1');
    const dashAttr =
      border.lineDash && border.lineDash.length > 0
        ? ` stroke-dasharray="${border.lineDash.join(' ')}"`
        : '';
    const rxAttr = border.radius && border.radius > 0 ? ` rx="${fmt(border.radius)}"` : '';
    els.push(
      `<rect id="Plot Border" x="${fmt(left)}" y="${fmt(top)}" width="${fmt(plotW)}" height="${fmt(plotH)}"${rxAttr} fill="none" stroke="${escapeXml(parsedBorder.color)}" stroke-width="${fmt(border.lineWidth || 1)}"${dashAttr} />`
    );
  }

  if (els.length === 0) return '';
  return `<g id="Grid">\n    ${els.join('\n    ')}\n  </g>`;
}

/**
 * X축 및 Y축을 `<g id="Y-Axis">`, `<g id="X-Axis">` 벡터 그룹으로 변환합니다.
 */
export function buildSvgAxesGroups(
  xAxisOpt: AxisOptions | undefined,
  yAxisOpt: AxisOptions | undefined,
  xScale: BandScale,
  yScale: LinearScale,
  data: DataItem[],
  chartHeight: number,
  padding: Padding
): string {
  const groups: string[] = [];

  // 1. Y-Axis
  if (yAxisOpt?.visible !== false) {
    const ticks = yScale.ticks(5);
    const font = yAxisOpt?.font || '11px Pretendard, sans-serif';
    const labelColor = yAxisOpt?.labelColor || '#94A3B8';
    const labelOffset = yAxisOpt?.labelOffset ?? 8;
    const x = padding.left - labelOffset;

    const yEls: string[] = [];
    if (yAxisOpt?.lineWidth && yAxisOpt.lineWidth > 0) {
      const [r0, r1] = yScale.range();
      const parsedAxisColor = parseSvgColor(yAxisOpt.color || '#CBD5E1');
      yEls.push(
        `<line id="Y-Axis Line" x1="${fmt(padding.left)}" y1="${fmt(r0)}" x2="${fmt(padding.left)}" y2="${fmt(r1)}" stroke="${escapeXml(parsedAxisColor.color)}" stroke-width="${fmt(yAxisOpt.lineWidth)}" />`
      );
    }

    for (const tick of ticks) {
      const y = yScale.scale(tick);
      const text = yAxisOpt?.formatter ? yAxisOpt.formatter(tick) : tick.toLocaleString();
      yEls.push(
        svgTextElement({
          id: `Y-Tick: ${text}`,
          x,
          y,
          text,
          font,
          fill: labelColor,
          align: 'right',
          baseline: 'middle',
        })
      );
    }
    groups.push(`<g id="Y-Axis">\n    ${yEls.join('\n    ')}\n  </g>`);
  }

  // 2. X-Axis
  if (xAxisOpt?.visible !== false) {
    const [start, end] = xScale.getViewport();
    const count = end - start + 1;
    if (count > 0) {
      const font = xAxisOpt?.font || '11px Pretendard, sans-serif';
      const labelColor = xAxisOpt?.labelColor || '#64748B';
      const labelOffset = xAxisOpt?.labelOffset ?? 10;
      const y = chartHeight - padding.bottom + labelOffset;

      const xEls: string[] = [];
      const axisColor = xAxisOpt?.color || '#1E293B';
      const axisWidth = xAxisOpt?.lineWidth ?? 1;
      if (axisWidth > 0) {
        const [rangeX0, rangeX1] = xScale.range();
        const baselineY = chartHeight - padding.bottom;
        const parsedAxisColor = parseSvgColor(axisColor);
        xEls.push(
          `<line id="X-Axis Baseline" x1="${fmt(rangeX0)}" y1="${fmt(baselineY)}" x2="${fmt(rangeX1)}" y2="${fmt(baselineY)}" stroke="${escapeXml(parsedAxisColor.color)}" stroke-width="${fmt(axisWidth)}" />`
        );
      }

      const sampleText = data[start]?.label || 'Sample';
      const approxTextWidth = sampleText.length * 6.5;
      const bandwidth = xScale.bandwidth();
      const step = xScale.step();
      const minSpacing = approxTextWidth + 12;
      const labelInterval = Math.max(1, Math.ceil(minSpacing / (step || 1)));

      for (let i = start; i <= end; i += labelInterval) {
        const item = data[i];
        if (!item) continue;
        const barX = xScale.scale(i);
        const centerX = barX + bandwidth / 2;
        const text = xAxisOpt?.formatter ? xAxisOpt.formatter(item.label) : item.label;
        xEls.push(
          svgTextElement({
            id: `X-Tick: ${text}`,
            x: centerX,
            y,
            text,
            font,
            fill: labelColor,
            align: 'center',
            baseline: 'top',
          })
        );
      }
      groups.push(`<g id="X-Axis">\n    ${xEls.join('\n    ')}\n  </g>`);
    }
  }

  return groups.join('\n  ');
}

/**
 * 범례(Legend) 항목들을 `<g id="Legend">` 벡터 그룹으로 변환합니다.
 */
export function buildSvgLegendGroup(
  items: LegendItem[],
  legendOpt: boolean | LegendOptions | undefined,
  chartWidth: number,
  chartHeight: number
): string {
  if (legendOpt === false || items.length === 0) return '';
  const opts: LegendOptions = typeof legendOpt === 'object' ? legendOpt : {};
  if (opts.visible === false) return '';

  const { side, align } = parseLegendAnchor(opts.position, opts.align ?? 'end');
  const shape = opts.markerShape || 'rounded';
  const fontSize = opts.fontSize ?? 12;
  const fontFamily = opts.fontFamily || 'Pretendard, sans-serif';
  const fontWeight = opts.fontWeight ?? 500;
  const textColor = opts.textColor || '#E2E8F0';
  const inactiveColor = opts.inactiveColor || '#64748B';
  const maxItems = opts.maxItems ?? 12;
  const visibleItems = items.slice(0, maxItems);

  const itemWidths = visibleItems.map((it) => {
    const label = opts.formatter ? opts.formatter(it) : it.label;
    return 16 + label.length * (fontSize * 0.62) + 16;
  });

  const els: string[] = [];

  if (side === 'top' || side === 'bottom') {
    const totalW = itemWidths.reduce((a, b) => a + b, 0);
    let curX = Math.max(16, (chartWidth - totalW) / 2);
    if (align === 'start') {
      curX = 16;
    } else if (align === 'end') {
      curX = Math.max(16, chartWidth - totalW - 16);
    }
    const centerY = side === 'top' ? 18 : chartHeight - 16;

    visibleItems.forEach((it, idx) => {
      const isActive = it.active !== false;
      const color = isActive ? it.color : inactiveColor;
      const label = opts.formatter ? opts.formatter(it) : it.label;
      const parsedMarker = parseSvgColor(color);

      let markerEl = '';
      if (shape === 'circle') {
        markerEl = `<circle id="Marker: ${escapeXml(label)}" cx="${fmt(curX + 5)}" cy="${fmt(centerY)}" r="5" fill="${escapeXml(parsedMarker.color)}" />`;
      } else if (shape === 'line') {
        markerEl = `<rect id="Marker: ${escapeXml(label)}" x="${fmt(curX)}" y="${fmt(centerY - 1.5)}" width="12" height="3" rx="1.5" fill="${escapeXml(parsedMarker.color)}" />`;
      } else {
        const rx = shape === 'rounded' ? 3 : 0;
        markerEl = `<rect id="Marker: ${escapeXml(label)}" x="${fmt(curX)}" y="${fmt(centerY - 5)}" width="10" height="10" rx="${rx}" fill="${escapeXml(parsedMarker.color)}" />`;
      }

      const textEl = svgTextElement({
        id: `Label: ${escapeXml(label)}`,
        x: curX + 16,
        y: centerY,
        text: label,
        font: `${fontWeight} ${fontSize}px ${fontFamily}`,
        fill: isActive ? textColor : inactiveColor,
        align: 'left',
        baseline: 'middle',
      });

      els.push(`<g id="Legend Item: ${escapeXml(label)}">${markerEl}${textEl}</g>`);
      curX += itemWidths[idx];
    });
  } else {
    const startX = side === 'left' ? 16 : chartWidth - 115;
    const totalH = visibleItems.length * 22;
    let curY = Math.max(24, (chartHeight - totalH) / 2);
    if (align === 'start') {
      curY = 24;
    } else if (align === 'end') {
      curY = Math.max(24, chartHeight - totalH - 12);
    }

    visibleItems.forEach((it) => {
      const isActive = it.active !== false;
      const color = isActive ? it.color : inactiveColor;
      const label = opts.formatter ? opts.formatter(it) : it.label;
      const parsedMarker = parseSvgColor(color);

      const markerEl =
        shape === 'circle'
          ? `<circle id="Marker: ${escapeXml(label)}" cx="${fmt(startX + 5)}" cy="${fmt(curY)}" r="5" fill="${escapeXml(parsedMarker.color)}" />`
          : `<rect id="Marker: ${escapeXml(label)}" x="${fmt(startX)}" y="${fmt(curY - 5)}" width="10" height="10" rx="3" fill="${escapeXml(parsedMarker.color)}" />`;

      const textEl = svgTextElement({
        id: `Label: ${escapeXml(label)}`,
        x: startX + 16,
        y: curY,
        text: label,
        font: `${fontWeight} ${fontSize}px ${fontFamily}`,
        fill: isActive ? textColor : inactiveColor,
        align: 'left',
        baseline: 'middle',
      });

      els.push(`<g id="Legend Item: ${escapeXml(label)}">${markerEl}${textEl}</g>`);
      curY += 22;
    });
  }

  return `<g id="Legend">\n    ${els.join('\n    ')}\n  </g>`;
}

/**
 * 최종 SVG 루트 문서를 조립하여 반환합니다.
 */
export function wrapSvgDocument(params: {
  width: number;
  height: number;
  defs: string[];
  body: string[];
  backgroundColor?: string;
  backgroundRadius?: number;
}): string {
  const { width, height, defs, body, backgroundColor, backgroundRadius = 0 } = params;
  const defsBlock = defs.length > 0 ? `\n  <defs>\n    ${defs.join('\n    ')}\n  </defs>` : '';

  let bgBlock = '';
  if (backgroundColor && backgroundColor !== 'transparent' && backgroundColor !== 'none') {
    const parsedBg = parseSvgColor(backgroundColor);
    const rxAttr = backgroundRadius > 0 ? ` rx="${fmt(backgroundRadius)}" ry="${fmt(backgroundRadius)}"` : '';
    const opAttr = parsedBg.opacity < 0.999 ? ` fill-opacity="${fmt(parsedBg.opacity)}"` : '';
    bgBlock = `\n  <rect id="Chart Background" x="0" y="0" width="${fmt(width)}" height="${fmt(height)}"${rxAttr} fill="${escapeXml(parsedBg.color)}"${opAttr} />`;
  }

  const contentBlock = body.filter(Boolean).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}" fill="none">${defsBlock}${bgBlock}\n  ${contentBlock}\n</svg>`;
}
