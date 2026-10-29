/**
 * @fileoverview 바 시리즈 렌더러 (BarSeries)
 * 
 * 대용량 데이터 렌더링 최적화(뷰포트 컬링)와
 * 디자이너 커스텀(둥근 모서리, 그라데이션, 테두리, 데이터 라벨, 호버 하이라이트)을
 * 전담하는 핵심 렌더링 클래스입니다.
 */

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

/**
 * 계산된 바(Bar)의 화면 좌표 및 크기 메타데이터
 */
export interface BarGeometry {
  /** 바의 시작 X 좌표 (px) */
  x: number;
  /** 바의 상단 Y 좌표 (px) */
  y: number;
  /** 바의 가로 너비 (px) */
  width: number;
  /** 바의 세로 높이 (px, 항상 양수) */
  height: number;
  /** 원본 데이터 아이템 */
  item: DataItem;
  /** 원본 데이터 인덱스 */
  index: number;
}

export class BarSeries {
  private barOptions: BarStyleOptions;
  private labelOptions?: DataLabelOptions;

  constructor(barOptions?: BarStyleOptions, labelOptions?: DataLabelOptions) {
    this.barOptions = {
      widthRatio: 0.65,
      borderRadius: [4, 4, 0, 0],
      fill: '#4F46E5', // 기본 색상: 인디고
      ...barOptions,
    };
    this.labelOptions = labelOptions;
  }

  /**
   * 단일 바의 기하학적 수치(X, Y, 너비, 높이)를 계산합니다.
   * 
   * 양수 값인 경우: 베이스라인(0)에서 위쪽으로 생성
   * 음수 값인 경우: 베이스라인(0)에서 아래쪽으로 생성
   */
  getBarGeometry(
    item: DataItem,
    index: number,
    xScale: BandScale,
    yScale: LinearScale
  ): BarGeometry {
    const rawX = xScale.scale(index);
    const rawWidth = xScale.bandwidth();

    // 슬롯 내에서 바의 두께 비율 적용 및 가운데 정렬
    const ratio = Math.max(0.05, Math.min(1.0, this.barOptions.widthRatio ?? 0.65));
    const width = rawWidth * ratio;
    const x = rawX + (rawWidth - width) / 2;

    const baseZero = yScale.scale(0);
    const targetY = yScale.scale(item.value);

    const isPositive = item.value >= 0;
    const y = isPositive ? targetY : baseZero;
    const height = isPositive ? baseZero - targetY : targetY - baseZero;

    return { x, y, width, height, item, index };
  }

  /**
   * 시리즈 레이어에 현재 뷰포트 내의 모든 바를 일괄 렌더링합니다.
   * 뷰포트 컬링을 적용하여 화면 밖의 데이터는 연산 및 그리기를 완전히 스킵합니다.
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

      // 데이터 라벨 표시 옵션이 켜져 있는 경우 라벨 렌더링
      if (this.labelOptions?.visible) {
        this.drawDataLabel(ctx, geom);
      }
    }

    ctx.restore();
  }

  /**
   * 단일 바(Bar) 그리기 (모서리 둥글기, 채우기, 테두리)
   */
  private drawSingleBar(ctx: CanvasRenderingContext2D, geom: BarGeometry): void {
    const { x, y, width, height, item, index } = geom;
    if (width <= 0 || height <= 0) return;

    // 1. 둥근 모서리 경로 생성
    const radius = this.barOptions.borderRadius;
    drawRoundedRect(ctx, x, y, width, height, radius);

    // 2. 채우기 스타일 적용 (단색, 그라데이션, 조건부 콜백)
    ctx.fillStyle = this.resolveColor(ctx, x, y, width, height, item, index);
    ctx.fill();

    // 3. 외곽 테두리(Border) 렌더링
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
   * 인터랙션 레이어: 마우스 호버된 특정 바에 하이라이트 효과를 부여합니다.
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

    // 사용자 지정 호버 스타일이 있으면 적용, 없으면 기본 반투명 화이트 오버레이
    if (hoverOpt?.fill) {
      const fillStyle = typeof hoverOpt.fill === 'function' ? hoverOpt.fill(item, index) : hoverOpt.fill;
      if (typeof fillStyle === 'string') {
        ctx.fillStyle = fillStyle;
      } else {
        ctx.fillStyle = createGradient(ctx, x, y, width, height, fillStyle);
      }
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fill();
    }

    // 호버 외곽 강조 테두리
    const hoverBorder = hoverOpt?.border || { color: 'rgba(255, 255, 255, 0.9)', width: 2 };
    ctx.strokeStyle = hoverBorder.color;
    ctx.lineWidth = hoverBorder.width;
    if (hoverBorder.dash) ctx.setLineDash(hoverBorder.dash);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 데이터 수치 라벨 렌더링 (다양한 위치 및 커스텀 포맷터 지원)
   */
  private drawDataLabel(ctx: CanvasRenderingContext2D, geom: BarGeometry): void {
    const { x, y, width, height, item, index } = geom;
    const opts = this.labelOptions!;

    // 바의 너비가 14px 미만으로 좁아진 경우 텍스트 겹침 방지를 위해 스킵
    if (width < 14) return;

    // 개발자가 완전 커스텀 렌더러 함수를 지정한 경우 제어권 위임
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

    // 디자이너가 요청한 다양한 라벨 배치 위치 계산
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

  /**
   * 바의 채우기 스타일(단색, 그라데이션, 함수 콜백)을 최종 캔버스 FillStyle로 변환
   */
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

  /**
   * 바의 테두리 옵션 계산
   */
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
