import { AxisOptions, DataItem, Padding } from '../types';
import { LinearScale } from '../scale/LinearScale';
import { BandScale } from '../scale/BandScale';
import { resolveColor } from '../utils/tokens';

/**
 * 캔버스에서 지정된 최대 픽셀 너비(`maxWidth`)를 초과하는 텍스트를 말줄임(`…`) 처리합니다.
 */
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0 || !text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  const ellipsisWidth = ctx.measureText(ellipsis).width;
  if (ellipsisWidth >= maxWidth) return ellipsis;

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const slice = text.slice(0, mid);
    if (ctx.measureText(slice).width + ellipsisWidth <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low > 0 ? text.slice(0, low) + ellipsis : ellipsis;
}

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
    const labelColor = resolveColor(options?.labelColor || '#94A3B8');
    const labelOffset = options?.labelOffset ?? 8;
    const x = padding.left - labelOffset;
    const maxLabelWidth = Math.max(12, padding.left - labelOffset - 2);

    ctx.save();
    ctx.font = font;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const tick of ticks) {
      const y = yScale.scale(tick);
      const rawText = options?.formatter ? options.formatter(tick) : tick.toLocaleString();
      const text = truncateText(ctx, rawText, maxLabelWidth);
      ctx.fillText(text, x, y);
    }

    // Y축 베이스라인 (옵션)
    if (options?.lineWidth && options.lineWidth > 0) {
      ctx.strokeStyle = resolveColor(options.color || '#CBD5E1');
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
    if (count <= 0 || data.length === 0) return;

    const font = options?.font || '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const labelColor = resolveColor(options?.labelColor || '#64748B');
    const labelOffset = options?.labelOffset ?? 10;
    const y = chartHeight - padding.bottom + labelOffset;

    ctx.save();
    ctx.font = font;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 라벨 겹침 방지: 뷰포트 내 최대 24개 항목을 샘플링하여 최대 텍스트 너비 계산
    const bandwidth = xScale.bandwidth();
    const step = xScale.step();
    const [rangeX0, rangeX1] = xScale.range();
    const plotWidth = Math.max(1, rangeX1 - rangeX0);

    let maxTextWidth = 0;
    const sampleStep = Math.max(1, Math.floor(count / 24));
    for (let i = start; i <= end; i += sampleStep) {
      const rawLabel = data[i]?.label ?? '';
      const formatted = options?.formatter ? options.formatter(rawLabel) : rawLabel;
      const w = ctx.measureText(formatted).width;
      if (w > maxTextWidth) maxTextWidth = w;
    }

    // 단일 라벨이 플롯 전체 폭을 넘지 않도록 상한 적용
    const cappedSampleWidth = Math.min(maxTextWidth, Math.max(48, plotWidth * 0.45));
    const minSpacing = cappedSampleWidth + 12;
    const labelInterval = Math.max(1, Math.ceil(minSpacing / (step || 1)));
    const maxSlotLabelWidth = Math.max(20, Math.min(plotWidth, (step || plotWidth) * labelInterval - 8));

    for (let i = start; i <= end; i += labelInterval) {
      const item = data[i];
      if (!item) continue;

      const barX = xScale.scale(i);
      const centerX = barX + bandwidth / 2;
      const rawText = options?.formatter ? options.formatter(item.label ?? '') : (item.label ?? '');
      const text = truncateText(ctx, rawText, maxSlotLabelWidth);

      ctx.fillText(text, centerX, y);
    }

    // X축 기준선
    const axisColor = resolveColor(options?.color || '#E2E8F0');
    const axisWidth = options?.lineWidth ?? 1;
    if (axisWidth > 0) {
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = axisWidth;
      const baselineY = chartHeight - padding.bottom;
      ctx.beginPath();
      ctx.moveTo(rangeX0, baselineY);
      ctx.lineTo(rangeX1, baselineY);
      ctx.stroke();
    }

    ctx.restore();
  }
}
