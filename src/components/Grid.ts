import { GridOptions, Padding } from '../types';
import { LinearScale } from '../scale/LinearScale';

export class Grid {
  static render(
    ctx: CanvasRenderingContext2D,
    options: GridOptions | undefined,
    yScale: LinearScale,
    chartWidth: number,
    padding: Padding
  ): void {
    const yGrid = options?.y ?? { visible: true, color: '#F1F5F9', lineWidth: 1, lineDash: [3, 3] };
    if (yGrid.visible === false) return;

    const ticks = yScale.ticks(5);
    const left = padding.left;
    const right = chartWidth - padding.right;

    ctx.save();
    ctx.strokeStyle = yGrid.color || '#F1F5F9';
    ctx.lineWidth = yGrid.lineWidth || 1;
    if (yGrid.lineDash && yGrid.lineDash.length > 0) {
      ctx.setLineDash(yGrid.lineDash);
    }

    for (const tick of ticks) {
      const y = Math.round(yScale.scale(tick)) + 0.5; // 1px 선명도 보정
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }

    ctx.restore();
  }
}
