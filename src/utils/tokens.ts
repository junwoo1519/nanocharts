/**
 * @fileoverview 디자인 시스템 컬러 토큰 (Design Tokens & CSS Variable Resolver)
 *
 * `variables.scss`의 시맨틱 및 팔레트 컬러 변수(`--primary`, `--surface`, `--on-surface`, `--outline`, `--teal` 등)를
 * 내장하여 웹 환경(`var(--primary)`)과 피그마 플러그인 변수 바인딩 양쪽에서 일관되게 해석합니다.
 */

/**
 * 디자인 시스템 표준 컬러 토큰 맵 (`--` 접두사를 제외한 정규화 키 기준)
 */
export const DESIGN_TOKENS: Record<string, string> = {
  // Primary
  'primary': '#226CFF',
  'primary-ultra-low': '#EFF5FF',
  'primary-lowest': '#DAE6FF',
  'primary-lower': '#C6D9FF',
  'primary-low': '#AEC9FF',
  'primary-mid': '#8CB2FF',
  'primary-high': '#5991FF',
  'primary-higher': '#1D5BD6',
  'primary-highest': '#1749AD',
  'primary-ultra-high': '#0C275C',

  // On-Primary
  'on-primary': '#E7EFFF',
  'on-primary-ultra-low': '#FFFFFF',
  'on-primary-lowest': '#C6D9FF',
  'on-primary-lower': '#AEC9FF',
  'on-primary-low': '#8CB2FF',
  'on-primary-mid': '#5991FF',
  'on-primary-high': '#1D5BD6',
  'on-primary-higher': '#1749AD',
  'on-primary-highest': '#123885',
  'on-primary-ultra-high': '#091939',

  // Surface
  'surface': '#F0F2F4',
  'surface-ultra-low': '#FFFFFF',
  'surface-lowest': '#FAFBFB',
  'surface-lower': '#F6F7F8',
  'surface-low': '#E9ECEF',
  'surface-mid': '#C9CDD4',
  'surface-high': '#B0B6BF',
  'surface-higher': '#979EA8',
  'surface-highest': '#7F858F',
  'surface-ultra-high': '#2C2F33',

  // On-Surface
  'on-surface': '#676C75',
  'on-surface-ultra-low': '#FFFFFF',
  'on-surface-lowest': '#E9ECEF',
  'on-surface-lower': '#D5D8DE',
  'on-surface-low': '#C9CDD4',
  'on-surface-mid': '#B0B6BF',
  'on-surface-high': '#979EA8',
  'on-surface-higher': '#51565E',
  'on-surface-highest': '#3E4247',
  'on-surface-ultra-high': '#222222',

  // Outline
  'outline': '#E9ECEF',
  'outline-ultra-low': '#FFFFFF',
  'outline-lowest': '#F0F2F4',
  'outline-lower': '#DFE3E8',
  'outline-low': '#D5D8DE',
  'outline-mid': '#C9CDD4',
  'outline-high': '#979EA8',
  'outline-higher': '#676C75',
  'outline-highest': '#2C2F33',
  'outline-ultra-high': '#222222',

  // Red
  'red': '#FF334B',
  'red-lowest': '#FFFFFF',
  'red-lower': '#FFEDEF',
  'red-low': '#FFD2D7',
  'red-mid': '#FFA9B3',
  'red-high': '#FF586B',
  'red-higher': '#DB2C40',
  'red-highest': '#911D2B',

  // Orange
  'orange': '#FF7700',
  'orange-lowest': '#FFFFFF',
  'orange-lower': '#FFF3E8',
  'orange-low': '#FFE1C7',
  'orange-mid': '#FFC694',
  'orange-high': '#FF902E',
  'orange-higher': '#DB6600',
  'orange-highest': '#914400',

  // Amber
  'amber': '#FAA52E',
  'amber-lowest': '#FFFFFF',
  'amber-lower': '#FFF7EC',
  'amber-low': '#FEEBD1',
  'amber-mid': '#FDD9A7',
  'amber-high': '#FBB554',
  'amber-higher': '#D78E28',
  'amber-highest': '#8E5E1A',

  // Yellow
  'yellow': '#FFC900',
  'yellow-lowest': '#FFFFFF',
  'yellow-lower': '#FFFAE8',
  'yellow-low': '#FFF3C7',
  'yellow-mid': '#FFE894',
  'yellow-high': '#FFD500',
  'yellow-higher': '#DBAD00',
  'yellow-highest': '#917200',

  // Lime
  'lime': '#ADCA1D',
  'lime-lowest': '#FFFFFF',
  'lime-lower': '#F8FAEB',
  'lime-low': '#EDF3CD',
  'lime-mid': '#DDE9A0',
  'lime-high': '#BCD446',
  'lime-higher': '#95AD19',
  'lime-highest': '#627310',

  // Green
  'green': '#3BCA5E',
  'green-lowest': '#FFFFFF',
  'green-lower': '#EDFAF0',
  'green-low': '#D4F3DC',
  'green-mid': '#ADE9BB',
  'green-high': '#5ED47B',
  'green-higher': '#33AD51',
  'green-highest': '#227335',

  // Teal
  'teal': '#24C8B0',
  'teal-lowest': '#FFFFFF',
  'teal-lower': '#EBFAF8',
  'teal-low': '#CFF3EE',
  'teal-mid': '#A3E8DE',
  'teal-high': '#4CD2BE',
  'teal-higher': '#1FAC97',
  'teal-highest': '#147264',

  // Cyan
  'cyan': '#00BEE7',
  'cyan-lowest': '#FFFFFF',
  'cyan-lower': '#E8F9FD',
  'cyan-low': '#C7F1FA',
  'cyan-mid': '#94E4F5',
  'cyan-high': '#2ECAEB',
  'cyan-higher': '#00A3C6',
  'cyan-highest': '#006C83',

  // Sky
  'sky': '#0CA5F1',
  'sky-lowest': '#FFFFFF',
  'sky-lower': '#E9F7FE',
  'sky-low': '#CAEBFC',
  'sky-mid': '#99D9F9',
  'sky-high': '#38B5F4',
  'sky-higher': '#0A8ECF',
  'sky-highest': '#075E89',

  // Blue
  'blue': '#407FFA',
  'blue-lowest': '#FFFFFF',
  'blue-lower': '#EEF3FF',
  'blue-low': '#D5E3FE',
  'blue-mid': '#AFC9FD',
  'blue-high': '#6296FB',
  'blue-higher': '#376DD7',
  'blue-highest': '#24488E',

  // Indigo
  'indigo': '#785CFD',
  'indigo-lowest': '#FFFFFF',
  'indigo-lower': '#F3F0FF',
  'indigo-low': '#E1DBFF',
  'indigo-mid': '#C6BBFE',
  'indigo-high': '#9079FD',
  'indigo-higher': '#674FD9',
  'indigo-highest': '#443490',

  // Purple
  'purple': '#AB4BFF',
  'purple-lowest': '#FFFFFF',
  'purple-lower': '#F7EFFF',
  'purple-low': '#EDD7FF',
  'purple-mid': '#DCB3FF',
  'purple-high': '#BA6BFF',
  'purple-higher': '#9340DB',
  'purple-highest': '#612B91',

  // Violet
  'violet': '#CD42D7',
  'violet-lowest': '#FFFFFF',
  'violet-lower': '#FAEEFB',
  'violet-low': '#F4D5F6',
  'violet-mid': '#EAB0EE',
  'violet-high': '#D664DE',
  'violet-higher': '#B039B9',
  'violet-highest': '#75267A',

  // Pink
  'pink': '#F6329A',
  'pink-lowest': '#FFFFFF',
  'pink-lower': '#FEEDF6',
  'pink-low': '#FDD2E9',
  'pink-mid': '#FBA9D5',
  'pink-high': '#F857AC',
  'pink-higher': '#D32B84',
  'pink-highest': '#8C1C58',
};

/**
 * 변수명 문자열(`var(--primary)`, `--primary`, `color/primary/high`, `primary/default`)을
 * 표준 토큰 키(`primary`, `primary-high`)로 정규화합니다.
 */
export function normalizeTokenKey(raw: string): string {
  let s = (raw || '').trim();
  const varMatch = s.match(/^var\(\s*--([a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\s*\)$/);
  if (varMatch) {
    s = varMatch[1];
  }
  s = s.replace(/^--+/, '');
  s = s.replace(/^(?:color|colors|token|tokens)[/-]/i, '');
  s = s.replace(/[/-](?:default|base)$/i, '');
  s = s.replace(/\//g, '-').toLowerCase();
  return s;
}

/**
 * CSS 변수(`var(--primary)`, `--primary`) 또는 디자인 시스템 토큰명을
 * Canvas 2D 및 SVG가 즉시 렌더링할 수 있는 실제 HEX / RGB 색상 문자열로 변환합니다.
 *
 * 1. 브라우저 DOM의 `:root`(또는 `scopeElement`)에 선언된 실제 CSS 변수 값을 최우선 조회합니다.
 * 2. DOM에 선언되지 않은 경우 내장된 `DESIGN_TOKENS`(`variables.scss`) 기본값으로 폴백합니다.
 */
export function resolveColor(input: string | undefined, scopeElement?: Element | null): string {
  if (!input) return '#226CFF';
  const trimmed = input.trim();

  // 1. var(--token, fallback) 또는 --token 형태인지 확인
  let varName: string | null = null;
  let customFallback: string | null = null;

  const varMatch = trimmed.match(/^var\(\s*(--[a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\s*\)$/);
  if (varMatch) {
    varName = varMatch[1];
    customFallback = varMatch[2] ? varMatch[2].trim() : null;
  } else if (trimmed.startsWith('--')) {
    varName = trimmed;
  } else if (DESIGN_TOKENS[trimmed.toLowerCase()]) {
    varName = `--${trimmed.toLowerCase()}`;
  }

  if (varName) {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const target = scopeElement || document.documentElement;
        const computed = window.getComputedStyle(target).getPropertyValue(varName).trim();
        if (computed) return computed;
      } catch {
        // SSR 또는 샌드박스 환경 무시
      }
    }

    const tokenKey = normalizeTokenKey(varName);
    if (DESIGN_TOKENS[tokenKey]) {
      return DESIGN_TOKENS[tokenKey];
    }
    if (customFallback) {
      return resolveColor(customFallback, scopeElement);
    }
  }

  return trimmed;
}

/**
 * 색상 문자열을 `{ r, g, b, a }` (0~255, a: 0~1)로 파싱합니다.
 */
export function parseColorToRgba(input: string): { r: number; g: number; b: number; a: number } {
  const resolved = resolveColor(input).trim();
  if (resolved.startsWith('#')) {
    let hex = resolved.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16) || 0,
        g: parseInt(hex.slice(2, 4), 16) || 0,
        b: parseInt(hex.slice(4, 6), 16) || 0,
        a: 1,
      };
    }
  }
  const rgbaMatch = resolved.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i
  );
  if (rgbaMatch) {
    return {
      r: Math.max(0, Math.min(255, parseInt(rgbaMatch[1], 10))),
      g: Math.max(0, Math.min(255, parseInt(rgbaMatch[2], 10))),
      b: Math.max(0, Math.min(255, parseInt(rgbaMatch[3], 10))),
      a: rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4]))) : 1,
    };
  }
  return { r: 34, g: 108, b: 255, a: 1 };
}

/**
 * 색상의 채도(Saturation, 0~100), 명도(Lightness, 0~100), 투명도(Alpha, 0~1)를 조절하여
 * `rgba(r, g, b, a)` 또는 `#RRGGBB` 문자열로 반환합니다.
 * LineChart Area 그라데이션의 채도·명도 커스텀에 사용됩니다.
 */
export function adjustColorHsl(
  inputColor: string,
  options: {
    saturation?: number;
    lightness?: number;
    saturationDelta?: number;
    lightnessDelta?: number;
    alpha?: number;
  }
): string {
  const { r, g, b, a } = parseColorToRgba(inputColor);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  let sPct = s * 100;
  let lPct = l * 100;

  if (options.saturation !== undefined) {
    sPct = options.saturation;
  }
  if (options.saturationDelta !== undefined) {
    sPct += options.saturationDelta;
  }
  if (options.lightness !== undefined) {
    lPct = options.lightness;
  }
  if (options.lightnessDelta !== undefined) {
    lPct += options.lightnessDelta;
  }

  s = Math.max(0, Math.min(100, sPct)) / 100;
  l = Math.max(0, Math.min(100, lPct)) / 100;

  let rOut: number;
  let gOut: number;
  let bOut: number;

  if (s === 0) {
    rOut = gOut = bOut = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rOut = hue2rgb(p, q, h + 1 / 3);
    gOut = hue2rgb(p, q, h);
    bOut = hue2rgb(p, q, h - 1 / 3);
  }

  const finalR = Math.round(rOut * 255);
  const finalG = Math.round(gOut * 255);
  const finalB = Math.round(bOut * 255);
  const finalA = options.alpha !== undefined ? Math.max(0, Math.min(1, options.alpha)) : a;

  if (finalA < 0.999) {
    return `rgba(${finalR}, ${finalG}, ${finalB}, ${Number(finalA.toFixed(3))})`;
  }
  return (
    '#' +
    [finalR, finalG, finalB]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * 전역 차트 폰트 설정(`ChartFontOptions`)과 기본 크기/두께를 조합해 표준 CSS font 문자열을 생성합니다.
 */
export function buildCssFontString(
  fontOpt?: { family?: string; size?: number; weight?: number | string },
  defaultSize: number = 11,
  defaultWeight: number | string = 500
): string {
  const family =
    fontOpt?.family || 'Pretendard, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const size = fontOpt?.size ?? defaultSize;
  const weight = fontOpt?.weight ?? defaultWeight;
  return `${weight} ${size}px ${family}`;
}
