/**
 * @fileoverview 파이/도넛 시리즈 렌더러 (PieSeries)
 * 
 * 파이 및 도넛 조각의 아크(Arc) 기하학 연산,
 * 디자이너 친화적 여백(padAngle), 호버 팝아웃(Explode) 인터랙션,
 * 외곽 가이드라인 라벨 및 도넛 중앙 요약 텍스트 렌더링을 전담합니다.
 */

import {
  DataItem,
  Padding,
  PieStyleOptions,
  PieLabelOptions,
  PieCenterContentOptions,
  PieSliceGeometry,
} from '../types';

/** 기본 모던 컬러 팔레트 */
const DEFAULT_PALETTE = [
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#14B8A6', // Teal
];

export class PieSeries {
  private styleOptions: PieStyleOptions;
  private labelOptions?: PieLabelOptions;
  private centerOptions?: PieCenterContentOptions;

  constructor(
    styleOptions?: PieStyleOptions,
    labelOptions?: PieLabelOptions,
    centerOptions?: PieCenterContentOptions
  ) {
    this.styleOptions = {
      innerRadiusRatio: 0,
      padAngle: 0.02,
      cornerRadius: 0,
      hoverExplode: 8,
      ...styleOptions,
    };
    this.labelOptions = {
      visible: true,
      position: 'outside',
      ...labelOptions,
    };
    this.centerOptions = centerOptions;
  }

  /**
   * 데이터와 컨테이너 크기로부터 각 파이 조각의 각도와 위치를 연산합니다.
   */
  calculateSlices(
    data: DataItem[],
    width: number,
    height: number,
    padding: Padding
  ): PieSliceGeometry[] {
    if (data.length === 0) return [];

    const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
    if (total <= 0) return [];

    const availableWidth = width - padding.left - padding.right;
    const availableHeight = height - padding.top - padding.bottom;
    const cx = padding.left + availableWidth / 2;
    const cy = padding.top + availableHeight / 2;

    // 외곽 라벨 영역 공간을 고려한 최대 반지름 설정
    const labelMargin = this.labelOptions?.position === 'outside' && this.labelOptions.visible ? 35 : 10;
    const maxRadius = Math.max(20, Math.min(availableWidth, availableHeight) / 2 - labelMargin);

    const innerRatio = Math.max(0, Math.min(0.85, this.styleOptions.innerRadiusRatio ?? 0));
    const innerRadius = maxRadius * innerRatio;
    const outerRadius = maxRadius;

    // 12시 방향(-PI/2)에서 시작
    let currentAngle = -Math.PI / 2;
    const padAngle = data.length > 1 ? (this.styleOptions.padAngle ?? 0.02) : 0;
    const slices: PieSliceGeometry[] = [];

    data.forEach((item, index) => {
      const val = Math.max(0, item.value);
      const percentage = val / total;
      const sweepAngle = percentage * 2 * Math.PI;

      const startAngle = currentAngle + padAngle / 2;
      const endAngle = currentAngle + sweepAngle - padAngle / 2;
      const midAngle = currentAngle + sweepAngle / 2;

      // 색상 결정
      let color = item.color;
      if (!color) {
        if (typeof this.styleOptions.colors === 'function') {
          color = this.styleOptions.colors(item, index);
        } else if (Array.isArray(this.styleOptions.colors) && this.styleOptions.colors.length > 0) {
          color = this.styleOptions.colors[index % this.styleOptions.colors.length];
        } else {
          color = DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
        }
      }

      slices.push({
        startAngle,
        endAngle,
        midAngle,
        innerRadius,
        outerRadius,
        percentage,
        cx,
        cy,
        color,
        item,
        index,
      });

      currentAngle += sweepAngle;
    });

    return slices;
  }

  /**
   * 데이터 레이어: 전체 파이/도넛 조각 및 라벨 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    slices: PieSliceGeometry[],
    hoveredIndex: number | null
  ): void {
    if (slices.length === 0) return;

    ctx.save();

    // 1. 모든 조각 그리기 (호버된 조각은 살짝 팝아웃 오프셋 적용)
    slices.forEach((slice, i) => {
      const isHovered = hoveredIndex === i;
      this.drawSingleSlice(ctx, slice, isHovered);
    });

    // 2. 도넛 중앙 텍스트 렌더링 (innerRadius가 있을 때)
    if (slices[0] && slices[0].innerRadius > 15) {
      this.drawCenterContent(ctx, slices);
    }

    // 3. 데이터 라벨 렌더링
    if (this.labelOptions?.visible) {
      this.drawLabels(ctx, slices);
    }

    ctx.restore();
  }

  /**
   * 단일 파이/도넛 조각 그리기 (호버 Explode 오프셋 지원)
   */
  drawSingleSlice(
    ctx: CanvasRenderingContext2D,
    slice: PieSliceGeometry,
    isHovered: boolean
  ): void {
    const { startAngle, endAngle, innerRadius, outerRadius, midAngle, cx, cy, color } = slice;
    if (endAngle <= startAngle) return;

    // 호버 시 중심에서 바깥쪽으로 이동할 오프셋 벡터 계산
    let offsetX = 0;
    let offsetY = 0;
    if (isHovered) {
      const explodeDist = this.styleOptions.hoverExplode ?? 8;
      offsetX = Math.cos(midAngle) * explodeDist;
      offsetY = Math.sin(midAngle) * explodeDist;
    }

    const currentCx = cx + offsetX;
    const currentCy = cy + offsetY;

    ctx.save();
    ctx.beginPath();

    if (innerRadius <= 0) {
      // 1. 순수 파이 차트 (부채꼴)
      ctx.moveTo(currentCx, currentCy);
      ctx.arc(currentCx, currentCy, outerRadius, startAngle, endAngle, false);
      ctx.closePath();
    } else {
      // 2. 도넛 차트 (도넛 링 형태: 외곽 아크 -> 안쪽 역방향 아크)
      ctx.arc(currentCx, currentCy, outerRadius, startAngle, endAngle, false);
      ctx.arc(currentCx, currentCy, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
    }

    ctx.fillStyle = color;
    ctx.fill();

    // 테두리
    const border = this.styleOptions.border;
    if (border && border.width && border.width > 0) {
      ctx.strokeStyle = border.color || '#151C2C';
      ctx.lineWidth = border.width;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 도넛 차트 중앙 요약 텍스트 렌더링
   */
  private drawCenterContent(
    ctx: CanvasRenderingContext2D,
    slices: PieSliceGeometry[]
  ): void {
    const first = slices[0];
    if (!first) return;
    const { cx, cy, innerRadius } = first;
    const opts = this.centerOptions;

    // 커스텀 렌더러가 지정된 경우
    if (opts?.renderCustom) {
      opts.renderCustom(ctx, { cx, cy, innerRadius });
      return;
    }

    const data = slices.map((s) => s.item);
    const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);

    const titleText =
      typeof opts?.title === 'function'
        ? opts.title(data, total)
        : opts?.title || total.toLocaleString();

    const subtitleText =
      typeof opts?.subtitle === 'function'
        ? opts.subtitle(data, total)
        : opts?.subtitle || 'Total';

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 메인 타이틀 (큰 숫자)
    ctx.font = opts?.titleFont || '700 20px Pretendard, -apple-system, sans-serif';
    ctx.fillStyle = opts?.titleColor || '#FFFFFF';
    ctx.fillText(titleText, cx, cy - 8);

    // 하단 서브타이틀
    ctx.font = opts?.subtitleFont || '500 11px Pretendard, -apple-system, sans-serif';
    ctx.fillStyle = opts?.subtitleColor || '#94A3B8';
    ctx.fillText(subtitleText, cx, cy + 14);

    ctx.restore();
  }

  /**
   * 데이터 라벨 및 리더 라인(Leader Line) 렌더링
   */
  private drawLabels(
    ctx: CanvasRenderingContext2D,
    slices: PieSliceGeometry[]
  ): void {
    const opts = this.labelOptions!;
    if (opts.position === 'none') return;

    ctx.save();
    ctx.font = opts.font || '600 11px Pretendard, -apple-system, sans-serif';

    slices.forEach((slice) => {
      // 5% 미만의 너무 작은 조각은 라벨 겹침 방지를 위해 스킵
      if (slice.percentage < 0.04) return;

      const { midAngle, innerRadius, outerRadius, cx, cy, item, percentage } = slice;
      const text = opts.formatter
        ? opts.formatter(item, percentage)
        : `${item.label} ${(percentage * 100).toFixed(0)}%`;

      if (opts.position === 'inside') {
        // 1. 조각 내부 라벨
        const r = (innerRadius + outerRadius) / 2;
        const lx = cx + Math.cos(midAngle) * r;
        const ly = cy + Math.sin(midAngle) * r;

        ctx.fillStyle = opts.color || '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, lx, ly);
      } else {
        // 2. 바깥쪽 가이드라인(Leader line) 라벨
        const lineStartRadius = outerRadius + 4;
        const lineBreakRadius = outerRadius + 14;

        const x0 = cx + Math.cos(midAngle) * lineStartRadius;
        const y0 = cy + Math.sin(midAngle) * lineStartRadius;

        const x1 = cx + Math.cos(midAngle) * lineBreakRadius;
        const y1 = cy + Math.sin(midAngle) * lineBreakRadius;

        const isRightSide = Math.cos(midAngle) >= 0;
        const x2 = x1 + (isRightSide ? 14 : -14);
        const y2 = y1;

        // 리더 라인 그리기
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // 텍스트 그리기
        ctx.fillStyle = opts.color || '#CBD5E1';
        ctx.textAlign = isRightSide ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x2 + (isRightSide ? 4 : -4), y2);
      }
    });

    ctx.restore();
  }
}
