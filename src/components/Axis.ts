import { AxisOptions, DataItem, Padding } from '../types';
import { LinearScale } from '../scale/LinearScale';
import { BandScale } from '../scale/BandScale';

export class Axis {
  static renderYAxis(
    ctx: CanvasRenderingContext2D,
    options: AxisOptions | undefined,
    yScale: LinearScale,
    padding: Padding
  ): void {
    if (options?.visible === false) return;

    const ticks = yScale.ticks(5);
    const font = options?.font || '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const labelColor = options?.labelColor || '#94A3B8';
    const labelOffset = options?.labelOffset ?? 8;
    const x = padding.left - labelOffset;

    ctx.save();
    ctx.font = font;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const tick of ticks) {
      const y = yScale.scale(tick);
      const text = options?.formatter ? options.formatter(tick) : tick.toLocaleString();
      ctx.fillText(text, x, y);
    }

    // Y축 베이스라인 (옵션)
    if (options?.lineWidth && options.lineWidth > 0) {
      ctx.strokeStyle = options.color || '#CBD5E1';
      ctx.lineWidth = options.lineWidth;
      const [r0, r1] = yScale.range();
      ctx.beginPath();
      ctx.moveTo(padding.left, r0);
      ctx.lineTo(padding.left, r1);
      ctx.stroke();
    }

    ctx.restore();
  }

  static renderXAxis(
    ctx: CanvasRenderingContext2D,
    options: AxisOptions | undefined,
    xScale: BandScale,
    data: DataItem[],
    chartHeight: number,
    padding: Padding
  ): void {
    if (options?.visible === false) return;

    const [start, end] = xScale.getViewport();
    const count = end - start + 1;
    if (count <= 0) return;

    const font = options?.font || '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const labelColor = options?.labelColor || '#64748B';
    const labelOffset = options?.labelOffset ?? 10;
    const y = chartHeight - padding.bottom + labelOffset;

    ctx.save();
    ctx.font = font;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 라벨 겹침 방지: 글자 너비와 바 너비를 고려해 스텝 계산
    const sampleText = data[start]?.label || 'Sample';
    const textWidth = ctx.measureText(sampleText).width;
    const bandwidth = xScale.bandwidth();
    const step = xScale.step();
    const minSpacing = textWidth + 12; // 최소 여백
    const labelInterval = Math.max(1, Math.ceil(minSpacing / (step || 1)));

    for (let i = start; i <= end; i += labelInterval) {
      const item = data[i];
      if (!item) continue;

      const barX = xScale.scale(i);
      const centerX = barX + bandwidth / 2;
      const text = options?.formatter ? options.formatter(item.label) : item.label;

      ctx.fillText(text, centerX, y);
    }

    // X축 기준선
    const axisColor = options?.color || '#E2E8F0';
    const axisWidth = options?.lineWidth ?? 1;
    if (axisWidth > 0) {
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = axisWidth;
      const [rangeX0, rangeX1] = xScale.range();
      const baselineY = chartHeight - padding.bottom;
      ctx.beginPath();
      ctx.moveTo(rangeX0, baselineY);
      ctx.lineTo(rangeX1, baselineY);
      ctx.stroke();
    }

    ctx.restore();
  }
}
