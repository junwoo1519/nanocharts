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
import {
  buildSvgPieSlicePathData,
  escapeXml,
  fmt,
  parseSvgColor,
  svgTextElement,
} from '../utils/svg';

/** 기본 모던 컬러 팔레트 */
export const DEFAULT_PALETTE = [
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
   * 데이터 항목의 채우기 색상을 결정합니다.
   */
  public resolveSliceColor(item: DataItem, index: number): string {
    if (item.color) return item.color;
    if (typeof this.styleOptions.colors === 'function') {
      return this.styleOptions.colors(item, index);
    }
    if (Array.isArray(this.styleOptions.colors) && this.styleOptions.colors.length > 0) {
      return this.styleOptions.colors[index % this.styleOptions.colors.length];
    }
    return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
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
      const color = this.resolveSliceColor(item, index);

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
   * 
   * @param hoverState 현재 호버된 조각 인덱스(`number | null`) 또는 조각별 호버 진행률 배열(`number[]`, 0.0 ~ 1.0)
   * @param progress 최초 등장 애니메이션 진행률 (0.0 ~ 1.0, 기본값: 1)
   */
  render(
    ctx: CanvasRenderingContext2D,
    slices: PieSliceGeometry[],
    hoverState: number | null | number[],
    progress: number = 1
  ): void {
    if (slices.length === 0) return;

    ctx.save();

    const clampedProgress = Math.max(0, Math.min(1, progress));
    // 12시 방향(-PI/2)부터 시계 방향으로 360도 회전하며 펼쳐지는 최대 각도
    const maxSweepAngle = -Math.PI / 2 + clampedProgress * Math.PI * 2;
    // 반지름도 85% -> 100%로 부드럽게 확장
    const radiusScale = progress >= 1 ? 1 : 0.85 + 0.15 * progress;

    const resolveHoverRatio = (index: number): number => {
      if (progress < 1) return 0;
      if (Array.isArray(hoverState)) return hoverState[index] ?? 0;
      return hoverState === index ? 1 : 0;
    };

    // 1. 일반 조각들을 먼저 그리고, 호버 애니메이션 중인 조각은 가장 위에 그려 그림자/경계선이 가려지지 않게 처리
    const activeIndices: number[] = [];

    slices.forEach((slice, i) => {
      if (progress < 1 && slice.startAngle >= maxSweepAngle) return;

      const hoverRatio = resolveHoverRatio(i);
      if (hoverRatio > 0.01) {
        activeIndices.push(i);
        return;
      }

      const animatedSlice: PieSliceGeometry =
        progress >= 1
          ? slice
          : {
              ...slice,
              endAngle: Math.min(slice.endAngle, maxSweepAngle),
              innerRadius: slice.innerRadius * radiusScale,
              outerRadius: slice.outerRadius * radiusScale,
            };

      this.drawSingleSlice(ctx, animatedSlice, 0);
    });

    // 호버 중인 조각들을 최상단에 렌더링
    for (const idx of activeIndices) {
      this.drawSingleSlice(ctx, slices[idx], resolveHoverRatio(idx));
    }

    const textAlpha = progress >= 1 ? 1 : Math.max(0, Math.min(1, (progress - 0.55) / 0.45));

    if (textAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = textAlpha;

      // 2. 도넛 중앙 텍스트 렌더링 (innerRadius가 있을 때)
      if (slices[0] && slices[0].innerRadius > 15) {
        this.drawCenterContent(ctx, slices);
      }

      // 3. 데이터 라벨 렌더링 (호버 오프셋 동기화)
      if (this.labelOptions?.visible) {
        this.drawLabels(ctx, slices, resolveHoverRatio);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 단일 파이/도넛 조각 그리기 (연속적인 호버 Explode 진행률 및 스케일/글로우 지원)
   * 
   * @param hoverInput `boolean` 또는 `0.0 ~ 1.0` 사이의 호버 애니메이션 진행률
   */
  drawSingleSlice(
    ctx: CanvasRenderingContext2D,
    slice: PieSliceGeometry,
    hoverInput: boolean | number = 0
  ): void {
    const { startAngle, endAngle, innerRadius, outerRadius, midAngle, cx, cy, color } = slice;
    if (endAngle <= startAngle) return;

    const hoverRatio =
      typeof hoverInput === 'boolean' ? (hoverInput ? 1 : 0) : Math.max(0, Math.min(1.2, hoverInput));

    // 호버 시 중심에서 바깥쪽으로 이동할 오프셋 벡터 및 외곽 반지름 확장 계산
    const explodeDist = (this.styleOptions.hoverExplode ?? 10) * hoverRatio;
    const offsetX = Math.cos(midAngle) * explodeDist;
    const offsetY = Math.sin(midAngle) * explodeDist;
    const currentOuterRadius = outerRadius + 4 * hoverRatio;

    const currentCx = cx + offsetX;
    const currentCy = cy + offsetY;

    ctx.save();

    // 호버 정도에 비례하는 부드러운 글로우 드롭섀도우 효과
    if (hoverRatio > 0.02) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16 * hoverRatio;
      ctx.shadowOffsetX = offsetX * 0.35;
      ctx.shadowOffsetY = offsetY * 0.35;
    }

    ctx.beginPath();

    if (innerRadius <= 0) {
      // 1. 순수 파이 차트 (부채꼴)
      ctx.moveTo(currentCx, currentCy);
      ctx.arc(currentCx, currentCy, currentOuterRadius, startAngle, endAngle, false);
      ctx.closePath();
    } else {
      // 2. 도넛 차트 (도넛 링 형태: 외곽 아크 -> 안쪽 역방향 아크)
      ctx.arc(currentCx, currentCy, currentOuterRadius, startAngle, endAngle, false);
      ctx.arc(currentCx, currentCy, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
    }

    ctx.fillStyle = color;
    ctx.fill();

    // 그림자가 테두리에는 중복 적용되지 않도록 초기화
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 기본 테두리 또는 호버 하이라이트 테두리
    const border = this.styleOptions.border;
    if (hoverRatio > 0.05) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.65 * Math.min(1, hoverRatio)})`;
      ctx.lineWidth = 1.5 * Math.min(1, hoverRatio);
      ctx.stroke();
    } else if (border && border.width && border.width > 0) {
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
    slices: PieSliceGeometry[],
    resolveHoverRatio?: (index: number) => number
  ): void {
    const opts = this.labelOptions!;
    if (opts.position === 'none') return;

    ctx.save();
    ctx.font = opts.font || '600 11px Pretendard, -apple-system, sans-serif';

    slices.forEach((slice, idx) => {
      // 5% 미만의 너무 작은 조각은 라벨 겹침 방지를 위해 스킵
      if (slice.percentage < 0.04) return;

      const hoverRatio = resolveHoverRatio ? resolveHoverRatio(idx) : 0;
      const explodeDist = (this.styleOptions.hoverExplode ?? 10) * hoverRatio;
      const offsetX = Math.cos(slice.midAngle) * explodeDist;
      const offsetY = Math.sin(slice.midAngle) * explodeDist;

      const { midAngle, innerRadius, item, percentage } = slice;
      const outerRadius = slice.outerRadius + 4 * hoverRatio;
      const cx = slice.cx + offsetX;
      const cy = slice.cy + offsetY;

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

  /**
   * 피그마(`figma.createNodeFromSvg`) 호환 파이/도넛 조각, 중앙 텍스트, 리더라인 라벨 SVG 벡터 그룹을 생성합니다.
   */
  public toSvgElements(slices: PieSliceGeometry[]): string {
    if (slices.length === 0) return '';

    const sliceEls: string[] = [];
    const labelEls: string[] = [];
    const border = this.styleOptions.border;
    let strokeAttr = '';
    if (border && border.width && border.width > 0) {
      const parsedBorder = parseSvgColor(border.color || '#151C2C');
      strokeAttr = ` stroke="${escapeXml(parsedBorder.color)}" stroke-width="${fmt(border.width)}"`;
    }

    slices.forEach((slice) => {
      const pathD = buildSvgPieSlicePathData(
        slice.cx,
        slice.cy,
        slice.innerRadius,
        slice.outerRadius,
        slice.startAngle,
        slice.endAngle
      );
      if (!pathD) return;
      const parsedFill = parseSvgColor(slice.color);
      const pctText = `${(slice.percentage * 100).toFixed(1)}%`;
      sliceEls.push(
        `<path id="Slice: ${escapeXml(slice.item.label)} (${pctText})" d="${pathD}" fill="${escapeXml(parsedFill.color)}"${strokeAttr} />`
      );
    });

    const groups: string[] = [];
    if (sliceEls.length > 0) {
      groups.push(`<g id="Pie Slices">\n    ${sliceEls.join('\n    ')}\n  </g>`);
    }

    // 도넛 중앙 텍스트
    if (slices[0] && slices[0].innerRadius > 15) {
      const { cx, cy } = slices[0];
      const data = slices.map((s) => s.item);
      const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
      const opts = this.centerOptions;

      const titleText =
        typeof opts?.title === 'function'
          ? opts.title(data, total)
          : opts?.title !== undefined
            ? opts.title
            : total.toLocaleString();

      const subtitleText =
        typeof opts?.subtitle === 'function'
          ? opts.subtitle(data, total)
          : opts?.subtitle !== undefined
            ? opts.subtitle
            : 'Total';

      const centerEls: string[] = [];
      if (titleText) {
        centerEls.push(
          svgTextElement({
            id: 'Center Title',
            x: cx,
            y: cy - 8,
            text: titleText,
            font: opts?.titleFont || '700 20px Pretendard, sans-serif',
            fill: opts?.titleColor || '#FFFFFF',
            align: 'center',
            baseline: 'middle',
          })
        );
      }
      if (subtitleText) {
        centerEls.push(
          svgTextElement({
            id: 'Center Subtitle',
            x: cx,
            y: cy + 14,
            text: subtitleText,
            font: opts?.subtitleFont || '500 11px Pretendard, sans-serif',
            fill: opts?.subtitleColor || '#94A3B8',
            align: 'center',
            baseline: 'middle',
          })
        );
      }
      if (centerEls.length > 0) {
        groups.push(`<g id="Donut Center">\n    ${centerEls.join('\n    ')}\n  </g>`);
      }
    }

    // 데이터 라벨 및 리더 라인
    const lOpts = this.labelOptions;
    if (lOpts?.visible && lOpts.position !== 'none') {
      const font = lOpts.font || '600 11px Pretendard, sans-serif';
      slices.forEach((slice) => {
        if (slice.percentage < 0.04) return;
        const { midAngle, innerRadius, outerRadius, cx, cy, item, percentage } = slice;
        const text = lOpts.formatter
          ? lOpts.formatter(item, percentage)
          : `${item.label} ${(percentage * 100).toFixed(0)}%`;

        if (lOpts.position === 'inside') {
          const r = (innerRadius + outerRadius) / 2;
          const lx = cx + Math.cos(midAngle) * r;
          const ly = cy + Math.sin(midAngle) * r;
          labelEls.push(
            svgTextElement({
              id: `Label: ${item.label}`,
              x: lx,
              y: ly,
              text,
              font,
              fill: lOpts.color || '#FFFFFF',
              align: 'center',
              baseline: 'middle',
            })
          );
        } else {
          const lineStartRadius = outerRadius + 4;
          const lineBreakRadius = outerRadius + 14;
          const x0 = cx + Math.cos(midAngle) * lineStartRadius;
          const y0 = cy + Math.sin(midAngle) * lineStartRadius;
          const x1 = cx + Math.cos(midAngle) * lineBreakRadius;
          const y1 = cy + Math.sin(midAngle) * lineBreakRadius;
          const isRightSide = Math.cos(midAngle) >= 0;
          const x2 = x1 + (isRightSide ? 14 : -14);
          const y2 = y1;

          const leaderPath = `<path id="Leader: ${escapeXml(item.label)}" d="M ${fmt(x0)} ${fmt(y0)} L ${fmt(x1)} ${fmt(y1)} L ${fmt(x2)} ${fmt(y2)}" fill="none" stroke="#94A3B8" stroke-opacity="0.4" stroke-width="1" />`;
          const textEl = svgTextElement({
            id: `Label: ${item.label}`,
            x: x2 + (isRightSide ? 4 : -4),
            y: y2,
            text,
            font,
            fill: lOpts.color || '#CBD5E1',
            align: isRightSide ? 'left' : 'right',
            baseline: 'middle',
          });
          labelEls.push(`<g id="Slice Label: ${escapeXml(item.label)}">${leaderPath}${textEl}</g>`);
        }
      });

      if (labelEls.length > 0) {
        groups.push(`<g id="Pie Labels">\n    ${labelEls.join('\n    ')}\n  </g>`);
      }
    }

    return groups.join('\n  ');
  }
}
