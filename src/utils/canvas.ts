/**
 * @fileoverview Canvas 2D 그리기 보조 유틸리티
 * 
 * 둥근 모서리 사각형(drawRoundedRect) 및
 * 선형 그라데이션 생성(createGradient) 등 캔버스 드로잉 편의 함수를 제공합니다.
 */

import { BorderRadius, GradientConfig } from '../types';

/**
 * 사용자 입력 모서리 둥글기 값을 표준 4자리 튜플 [TL, TR, BR, BL]로 정규화합니다.
 */
export function normalizeBorderRadius(
  radius: BorderRadius | undefined
): [number, number, number, number] {
  if (radius === undefined || radius === null) {
    return [0, 0, 0, 0];
  }
  if (typeof radius === 'number') {
    return [radius, radius, radius, radius];
  }
  if (Array.isArray(radius)) {
    if (radius.length === 1) return [radius[0], radius[0], radius[0], radius[0]];
    if (radius.length === 2) return [radius[0], radius[1], radius[0], radius[1]];
    if (radius.length >= 4) return [radius[0], radius[1], radius[2], radius[3]];
  }
  return [0, 0, 0, 0];
}

/**
 * 4개 모서리 각각에 서로 다른 반지름을 적용할 수 있는 둥근 사각형 경로를 생성합니다.
 * 값이 음수인 경우(상단 기준 아래로 내려가는 바)도 안전하게 자동 처리합니다.
 * 
 * @param ctx 2D 캔버스 렌더링 컨텍스트
 * @param x 바의 시작 X 좌표
 * @param y 바의 시작 Y 좌표
 * @param width 바의 너비
 * @param height 바의 높이 (양수 또는 음수)
 * @param radiusInput 둥글기 설정 (숫자 또는 배열)
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radiusInput: BorderRadius | undefined
): void {
  if (width <= 0 || height === 0) return;

  // height가 음수인 경우 (음수 데이터 포인트) 시작 위치 및 높이 보정
  let actualY = y;
  let actualHeight = height;
  if (height < 0) {
    actualY = y + height;
    actualHeight = -height;
  }

  const [rawTL, rawTR, rawBR, rawBL] = normalizeBorderRadius(radiusInput);

  // 사각형의 크기보다 반지름이 커서 도형이 뒤집히는 왜곡 방지
  const maxRadius = Math.min(width / 2, actualHeight / 2);
  const tl = Math.min(rawTL, maxRadius);
  const tr = Math.min(rawTR, maxRadius);
  const br = Math.min(rawBR, maxRadius);
  const bl = Math.min(rawBL, maxRadius);

  ctx.beginPath();
  ctx.moveTo(x + tl, actualY);
  ctx.lineTo(x + width - tr, actualY);
  if (tr > 0) ctx.quadraticCurveTo(x + width, actualY, x + width, actualY + tr);
  ctx.lineTo(x + width, actualY + actualHeight - br);
  if (br > 0) ctx.quadraticCurveTo(x + width, actualY + actualHeight, x + width - br, actualY + actualHeight);
  ctx.lineTo(x + bl, actualY + actualHeight);
  if (bl > 0) ctx.quadraticCurveTo(x, actualY + actualHeight, x, actualY + actualHeight - bl);
  ctx.lineTo(x, actualY + tl);
  if (tl > 0) ctx.quadraticCurveTo(x, actualY, x + tl, actualY);
  ctx.closePath();
}

/**
 * 설정 객체를 기반으로 선형 그라데이션(CanvasGradient)을 생성합니다.
 * 
 * @param ctx 2D 캔버스 렌더링 컨텍스트
 * @param x 대상 영역 시작 X
 * @param y 대상 영역 시작 Y
 * @param width 대상 영역 가로 폭
 * @param height 대상 영역 세로 높이
 * @param config 그라데이션 설정 (from, to, direction)
 */
export function createGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  config: GradientConfig
): CanvasGradient {
  let grad: CanvasGradient;
  const actualY = height < 0 ? y + height : y;
  const actualHeight = Math.abs(height);

  if (config.direction === 'horizontal') {
    // 가로 그라데이션: 좌 -> 우
    grad = ctx.createLinearGradient(x, actualY, x + width, actualY);
  } else {
    // 세로 그라데이션: 상 -> 하
    grad = ctx.createLinearGradient(x, actualY, x, actualY + actualHeight);
  }

  grad.addColorStop(0, config.from);
  grad.addColorStop(1, config.to);
  return grad;
}
