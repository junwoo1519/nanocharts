/**
 * @fileoverview 반응형(Responsive) 차트 크기 및 여백 자동 계산 유틸리티
 *
 * 1. 컨테이너에 명시적 CSS `height`가 없더라도 `aspectRatio`(기본 16:10)와 `minHeight`를 기반으로
 *    자동 높이를 계산하여 Flex/Grid 레이아웃 어디서든 즉시 반응형으로 동작하게 합니다.
 * 2. 모바일/좁은 화면(`compactBreakpoint`, 기본 480px 미만)에서 여백(Padding), 라벨 밀도,
 *    Y축 숫자 폭을 동적으로 보정하여 텍스트 잘림(Clipping)과 겹침을 방지합니다.
 */

import type { AxisOptions, LegendOptions, Padding, ResponsiveOptions } from '../types';
import { LinearScale } from '../scale/LinearScale';

/**
 * 사용자 `responsive` 옵션을 기본값이 채워진 객체로 정규화합니다.
 */
export function normalizeResponsiveOptions(
  opt?: boolean | ResponsiveOptions,
  defaultAspectRatio: number = 1.6
): Required<Omit<ResponsiveOptions, 'maxHeight' | 'onResize'>> & {
  maxHeight?: number;
  onResize?: (width: number, height: number, isCompact: boolean) => void;
} {
  if (opt === false) {
    return {
      enabled: false,
      aspectRatio: defaultAspectRatio,
      minHeight: 180,
      compactBreakpoint: 480,
    };
  }
  const obj = typeof opt === 'object' && opt !== null ? opt : {};
  return {
    enabled: obj.enabled !== false,
    aspectRatio: obj.aspectRatio ?? defaultAspectRatio,
    minHeight: obj.minHeight ?? 200,
    maxHeight: obj.maxHeight,
    compactBreakpoint: obj.compactBreakpoint ?? 480,
    onResize: obj.onResize,
  };
}

/**
 * 컨테이너 DOM 엘리먼트의 현재 반응형 가로/세로 픽셀 크기를 계산합니다.
 * - 컨테이너 높이가 0이거나 `aspectRatio`가 지정된 경우 가로 폭에 비례해 높이를 자동 산출합니다.
 */
export function resolveContainerDimensions(
  container: HTMLElement,
  responsiveOpt?: boolean | ResponsiveOptions,
  defaultAspectRatio: number = 1.6
): { width: number; height: number; isCompact: boolean } {
  const norm = normalizeResponsiveOptions(responsiveOpt, defaultAspectRatio);
  const rect = container.getBoundingClientRect();
  const rawWidth = container.clientWidth || Math.round(rect.width) || 320;
  let rawHeight = container.clientHeight || Math.round(rect.height) || 0;

  const hasExplicitAspectRatio =
    typeof responsiveOpt === 'object' &&
    responsiveOpt !== null &&
    typeof responsiveOpt.aspectRatio === 'number' &&
    responsiveOpt.aspectRatio > 0;

  if (rawHeight <= 10 || hasExplicitAspectRatio) {
    const ratio = norm.aspectRatio > 0 ? norm.aspectRatio : defaultAspectRatio;
    let computedH = Math.round(rawWidth / ratio);
    computedH = Math.max(norm.minHeight, computedH);
    if (norm.maxHeight && norm.maxHeight > 0) {
      computedH = Math.min(norm.maxHeight, computedH);
    }
    rawHeight = computedH;
    if (container.clientHeight <= 10) {
      container.style.minHeight = `${computedH}px`;
    }
  }

  const isCompact = norm.enabled && rawWidth < norm.compactBreakpoint;
  return {
    width: Math.max(120, rawWidth),
    height: Math.max(120, rawHeight),
    isCompact,
  };
}

/**
 * 컨테이너 크기(모바일/태블릿/데스크톱)와 Y축 눈금 텍스트 길이, 범례 위치에 맞춰
 * 차트 플롯 영역의 상하좌우 여백(`Padding`)을 반응형으로 자동 보정합니다.
 */
export function computeResponsivePadding(params: {
  basePadding: Padding;
  userPadding?: Partial<Padding>;
  width: number;
  height: number;
  yScale?: LinearScale;
  yAxis?: AxisOptions;
  legend?: boolean | LegendOptions;
  responsive?: boolean | ResponsiveOptions;
}): Padding {
  const { basePadding, userPadding, width, height, yScale, yAxis, legend, responsive } = params;
  const norm = normalizeResponsiveOptions(responsive);

  if (!norm.enabled) {
    return { ...basePadding, ...userPadding };
  }

  const isCompact = width < norm.compactBreakpoint;
  const isVerySmall = width < 340 || height < 220;
  const scaleFactor = isVerySmall ? 0.72 : isCompact ? 0.84 : 1;

  // 1. 상/하/우 기본 여백을 화면 크기에 비례하여 스케일링
  let top = userPadding?.top ?? Math.round(basePadding.top * scaleFactor);
  let right = userPadding?.right ?? Math.round(basePadding.right * scaleFactor);
  let bottom = userPadding?.bottom ?? Math.round(basePadding.bottom * scaleFactor);
  let left = userPadding?.left ?? Math.round(basePadding.left * scaleFactor);

  // 2. 범례(Legend)가 상단 또는 하단에 활성화된 경우 겹침 방지 여백 확보
  const legendVisible =
    legend !== false && (typeof legend !== 'object' || legend.visible !== false);
  const legendPos = typeof legend === 'object' && legend?.position ? legend.position : 'top';

  if (legendVisible) {
    if (legendPos.startsWith('top') && userPadding?.top === undefined) {
      top = Math.max(top, isCompact ? 34 : 38);
    } else if (legendPos.startsWith('bottom') && userPadding?.bottom === undefined) {
      bottom = Math.max(bottom, isCompact ? 38 : 44);
    }
  }

  // 3. Y축 눈금 라벨 길이에 따른 좌측 여백(left) 자동 계산 (숫자 잘림 방지)
  if (yScale && yAxis?.visible !== false && userPadding?.left === undefined) {
    const ticks = yScale.ticks(5);
    let maxLabelLen = 0;
    for (const t of ticks) {
      const formatted = yAxis?.formatter ? yAxis.formatter(t) : t.toLocaleString();
      if (formatted.length > maxLabelLen) {
        maxLabelLen = formatted.length;
      }
    }
    const charWidth = isCompact ? 6.0 : 6.6;
    const labelOffset = yAxis?.labelOffset ?? 8;
    const estimatedLeft = Math.ceil(maxLabelLen * charWidth + labelOffset + 8);
    left = Math.max(isCompact ? 32 : 40, Math.min(Math.round(width * 0.28), estimatedLeft));
  }

  return { top, right, bottom, left };
}
