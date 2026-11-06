import { GridLineStyle, GridOptions, Padding } from '../types';
import { LinearScale } from '../scale/LinearScale';
import { BandScale } from '../scale/BandScale';
import { drawRoundedRect } from '../utils/canvas';
import { resolveColor } from '../utils/tokens';

/**
 * `GridLineStyle`의 `style` 프리셋('solid' | 'dashed' | 'dotted')과 `lineDash` 배열로부터
 * 실제 Canvas/SVG 점선 배열을 결정합니다.
 */
export function resolveGridLineDash(
  lineStyle?: GridLineStyle,
  defaultDash: number[] = [3, 3]
): number[] {
  if (!lineStyle) return defaultDash;
  if (lineStyle.style === 'solid') return [];
  if (lineStyle.style === 'dotted') return [2, 3];
  if (lineStyle.style === 'dashed') {
    return lineStyle.lineDash && lineStyle.lineDash.length > 0 ? lineStyle.lineDash : [5, 4];
  }
  if (lineStyle.lineDash !== undefined) {
    return lineStyle.lineDash;
  }
  return defaultDash;
}

export class Grid {
  /**
   * 배경 격자선(수평 Y, 수직 X), 줄무늬 배경(Alternate Band), 플롯 외곽 테두리(Plot Border)를 렌더링합니다.
   */
  static render(
    ctx: CanvasRenderingContext2D,
    options: GridOptions | undefined,
    yScale: LinearScale,
    chartWidth: number,
    padding: Padding,
    xScale?: BandScale,
    chartHeight?: number
  ): void {
    const left = padding.left;
    const right = chartWidth - padding.right;
    const [yRangeBottom, yRangeTop] = yScale.range();
    const top = Math.min(yRangeTop, yRangeBottom);
    const bottom = chartHeight ? chartHeight - padding.bottom : Math.max(yRangeTop, yRangeBottom);
    const plotW = Math.max(0, right - left);
    const plotH = Math.max(0, bottom - top);

    const yTicks = yScale.ticks(5);

    // 1. 줄무늬 배경 (Alternate Band / Zebra Fill)
    if (options?.alternateBand?.visible && plotW > 0 && plotH > 0) {
      const bandColor = resolveColor(options.alternateBand.color || 'rgba(148, 163, 184, 0.06)');
      const dir = options.alternateBand.direction || 'horizontal';
      ctx.save();
      ctx.fillStyle = bandColor;

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
              ctx.fillRect(clampedX, top, clampedW, plotH);
            }
          }
        }
      } else if (yTicks.length >= 2) {
        for (let i = 0; i < yTicks.length - 1; i++) {
          if (i % 2 === 0) {
            const y1 = yScale.scale(yTicks[i]);
            const y2 = yScale.scale(yTicks[i + 1]);
            const bandTop = Math.min(y1, y2);
            const bandH = Math.abs(y1 - y2);
            ctx.fillRect(left, bandTop, plotW, bandH);
          }
        }
      }
      ctx.restore();
    }

    // 2. 수평(Y) 격자선
    const yGrid: GridLineStyle = options?.y ?? {
      visible: true,
      color: '#F1F5F9',
      lineWidth: 1,
      lineDash: [3, 3],
    };
    if (yGrid.visible !== false) {
      ctx.save();
      ctx.strokeStyle = resolveColor(yGrid.color || '#F1F5F9');
      ctx.lineWidth = yGrid.lineWidth ?? 1;
      if (yGrid.opacity !== undefined) {
        ctx.globalAlpha = Math.max(0, Math.min(1, yGrid.opacity));
      }
      const dash = resolveGridLineDash(yGrid, [3, 3]);
      ctx.setLineDash(dash);

      for (const tick of yTicks) {
        const y = Math.round(yScale.scale(tick)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. 수직(X) 격자선
    const xGrid = options?.x;
    if (xGrid?.visible && xScale) {
      const [start, end] = xScale.getViewport();
      const bandwidth = xScale.bandwidth();
      ctx.save();
      ctx.strokeStyle = resolveColor(xGrid.color || '#F1F5F9');
      ctx.lineWidth = xGrid.lineWidth ?? 1;
      if (xGrid.opacity !== undefined) {
        ctx.globalAlpha = Math.max(0, Math.min(1, xGrid.opacity));
      }
      const dash = resolveGridLineDash(xGrid, [3, 3]);
      ctx.setLineDash(dash);

      for (let i = start; i <= end; i++) {
        const x = Math.round(xScale.scale(i) + bandwidth / 2) + 0.5;
        if (x >= left && x <= right) {
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x, bottom);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 4. 플롯 영역 외곽 테두리 박스 (Plot Border)
    const border = options?.border;
    if (border?.visible && plotW > 0 && plotH > 0) {
      ctx.save();
      ctx.strokeStyle = resolveColor(border.color || '#CBD5E1');
      ctx.lineWidth = border.lineWidth ?? 1;
      if (border.lineDash && border.lineDash.length > 0) {
        ctx.setLineDash(border.lineDash);
      } else {
        ctx.setLineDash([]);
      }
      drawRoundedRect(ctx, left, top, plotW, plotH, border.radius ?? 0);
      ctx.stroke();
      ctx.restore();
    }
  }
}
