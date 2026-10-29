import { BorderRadius, GradientConfig } from '../types';

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
 * 둥근 사각형 경로 생성 (음수 height도 처리)
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

  // height가 음수인 경우 (상단 기준 아래로 내려가는 경우) 처리
  let actualY = y;
  let actualHeight = height;
  if (height < 0) {
    actualY = y + height;
    actualHeight = -height;
  }

  const [rawTL, rawTR, rawBR, rawBL] = normalizeBorderRadius(radiusInput);

  // 사각형 크기보다 반지름이 커서 깨지는 현상 방지
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
 * 그라데이션 생성 헬퍼
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
    grad = ctx.createLinearGradient(x, actualY, x + width, actualY);
  } else {
    // vertical: 바 상단 -> 바 하단
    grad = ctx.createLinearGradient(x, actualY, x, actualY + actualHeight);
  }

  grad.addColorStop(0, config.from);
  grad.addColorStop(1, config.to);
  return grad;
}
