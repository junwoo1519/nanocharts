import {
  BarStyleOptions,
  DataLabelOptions,
  DataItem,
  ColorStyle,
  BarBorderStyle,
} from '../types';
import { BandScale } from '../scale/BandScale';
import { LinearScale } from '../scale/LinearScale';
import { drawRoundedRect, createGradient } from '../utils/canvas';

export interface BarGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  item: DataItem;
  index: number;
}

export class BarSeries {
  private barOptions: BarStyleOptions;
  private labelOptions?: DataLabelOptions;

  constructor(barOptions?: BarStyleOptions, labelOptions?: DataLabelOptions) {
    this.barOptions = {
      widthRatio: 0.65,
      borderRadius: [4, 4, 0, 0],
      fill: '#4F46E5', // Indigo 600
      ...barOptions,
    };
    this.labelOptions = labelOptions;
  }

  /**
   * 바의 기하학 정보(x, y, width, height) 계산
   */
  getBarGeometry(
    item: DataItem,
    index: number,
    xScale: BandScale,
    yScale: LinearScale
  ): BarGeometry {
    const rawX = xScale.scale(index);
    const rawWidth = xScale.bandwidth();

    // widthRatio 적용
    const ratio = Math.max(0.05, Math.min(1.0, this.barOptions.widthRatio ?? 0.65));
    const width = rawWidth * ratio;
    const x = rawX + (rawWidth - width) / 2;

    const baseZero = yScale.scale(0);
    const targetY = yScale.scale(item.value);

    // 값이 양수인 경우: baseZero에서 위로 targetY까지
    // 값이 음수인 경우: baseZero에서 아래로 targetY까지
    const isPositive = item.value >= 0;
    const y = isPositive ? targetY : baseZero;
    const height = isPositive ? baseZero - targetY : targetY - baseZero;

    return { x, y, width, height, item, index };
  }

  /**
   * 데이터 레이어에 바 전체 렌더링 (뷰포트 컬링 적용)
   */
  render(
    ctx: CanvasRenderingContext2D,
    data: DataItem[],
    xScale: BandScale,
    yScale: LinearScale
  ): void {
    const [start, end] = xScale.getViewport();
    if (data.length === 0 || start > end) return;

    ctx.save();

    for (let i = start; i <= end; i++) {
      const item = data[i];
      if (!item) continue;

      const geom = this.getBarGeometry(item, i, xScale, yScale);
      this.drawSingleBar(ctx, geom);

      // 데이터 라벨 렌더링
      if (this.labelOptions?.visible) {
        this.drawDataLabel(ctx, geom);
      }
    }

    ctx.restore();
  }

  /**
   * 단일 바 그리기 (색상, 그라데이션, 모서리 둥글기, 보더)
   */
  private drawSingleBar(ctx: CanvasRenderingContext2D, geom: BarGeometry): void {
    const { x, y, width, height, item, index } = geom;
    if (width <= 0 || height <= 0) return;

    const radius = this.barOptions.borderRadius;
    drawRoundedRect(ctx, x, y, width, height, radius);

    // 1. Fill 채우기
    ctx.fillStyle = this.resolveColor(ctx, x, y, width, height, item, index);
    ctx.fill();

    // 2. 테두리(Border) 그리기
    const border = this.resolveBorder(item, index);
    if (border && border.width > 0) {
      ctx.strokeStyle = border.color;
      ctx.lineWidth = border.width;
      if (border.dash) {
        ctx.setLineDash(border.dash);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
    }
  }

  /**
   * 인터랙션 레이어: 마우스 호버된 바 하이라이트
   */
  renderHighlight(
    ctx: CanvasRenderingContext2D,
    geom: BarGeometry
  ): void {
    const { x, y, width, height, item, index } = geom;
    if (width <= 0 || height <= 0) return;

    ctx.save();
    const radius = this.barOptions.borderRadius;
    drawRoundedRect(ctx, x, y, width, height, radius);

    const hoverOpt = this.barOptions.hover;

    // 사용자 지정 호버 색상이 있으면 그것으로 채움
    if (hoverOpt?.fill) {
      const fillStyle = typeof hoverOpt.fill === 'function' ? hoverOpt.fill(item, index) : hoverOpt.fill;
      if (typeof fillStyle === 'string') {
        ctx.fillStyle = fillStyle;
      } else {
        ctx.fillStyle = createGradient(ctx, x, y, width, height, fillStyle);
      }
      ctx.fill();
    } else {
      // 기본 하이라이트: 은은한 반투명 화이트 오버레이
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fill();
    }

    // 호버 보더
    const hoverBorder = hoverOpt?.border || { color: 'rgba(255, 255, 255, 0.9)', width: 2 };
    ctx.strokeStyle = hoverBorder.color;
    ctx.lineWidth = hoverBorder.width;
    if (hoverBorder.dash) ctx.setLineDash(hoverBorder.dash);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 데이터 라벨 그리기 (자유로운 위치: top-outside, inside-top, inside-center 등)
   */
  private drawDataLabel(ctx: CanvasRenderingContext2D, geom: BarGeometry): void {
    const { x, y, width, height, item, index } = geom;
    const opts = this.labelOptions!;

    // 바 너비가 너무 작아서 라벨을 표시할 수 없는 경우 스킵
    if (width < 14) return;

    // 완전 커스텀 렌더러가 지정된 경우 위임
    if (opts.renderCustom) {
      opts.renderCustom(ctx, { x, y, width, height, item, index });
      return;
    }

    const pos = opts.position || 'top-outside';
    const offset = opts.offset ?? 6;
    const font = opts.font || '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const color =
      typeof opts.color === 'function'
        ? opts.color(item, index)
        : opts.color || (pos.startsWith('inside') ? '#FFFFFF' : '#334155');

    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';

    const text = opts.formatter
      ? opts.formatter(item.value, item, index)
      : item.value.toLocaleString();

    const centerX = x + width / 2;
    let labelY = y;

    switch (pos) {
      case 'top-outside':
        ctx.textBaseline = 'bottom';
        labelY = y - offset;
        break;
      case 'inside-top':
        ctx.textBaseline = 'top';
        labelY = y + offset;
        break;
      case 'inside-center':
        ctx.textBaseline = 'middle';
        labelY = y + height / 2;
        break;
      case 'inside-bottom':
        ctx.textBaseline = 'bottom';
        labelY = y + height - offset;
        break;
      case 'bottom-outside':
        ctx.textBaseline = 'top';
        labelY = y + height + offset;
        break;
      case 'none':
        ctx.restore();
        return;
    }

    ctx.fillText(text, centerX, labelY);
    ctx.restore();
  }

  private resolveColor(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    item: DataItem,
    index: number
  ): string | CanvasGradient {
    let style: ColorStyle = item.color || '#4F46E5';

    if (typeof this.barOptions.fill === 'function') {
      style = this.barOptions.fill(item, index);
    } else if (this.barOptions.fill) {
      style = this.barOptions.fill;
    }

    if (typeof style === 'string') {
      return style;
    }

    return createGradient(ctx, x, y, width, height, style);
  }

  private resolveBorder(
    item: DataItem,
    index: number
  ): BarBorderStyle | undefined {
    if (typeof this.barOptions.border === 'function') {
      return this.barOptions.border(item, index);
    }
    return this.barOptions.border;
  }
}
