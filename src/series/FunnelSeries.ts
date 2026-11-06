/**
 * @fileoverview 퍼널(Funnel) 차트 시리즈 렌더러 (FunnelSeries)
 *
 * [핵심 기능]
 * 1. 진행 방향 전환: 상하(`'vertical'`, 기본값) 및 좌우(`'horizontal'`) 퍼널 레이아웃 지원
 * 2. 도형 형태 선택: 사다리꼴 연결형(`'trapezoid'`) 및 중앙 정렬 바(`'bar'`) 지원
 * 3. 단계 간 전환율(Conversion Rate, 직전 단계 대비 % 또는 최초 단계 대비 %) 배지 및 라벨 렌더링
 * 4. 피그마(`figma.createNodeFromSvg`) 호환 순수 벡터(SVG) 직렬화 지원
 */

import type {
  DataItem,
  FunnelLabelOptions,
  FunnelStageGeometry,
  FunnelStyleOptions,
  Padding,
} from '../types';
import { drawRoundedRect } from '../utils/canvas';
import {
  escapeXml,
  fmt,
  parseSvgColor,
  svgRoundedRectElement,
  svgTextElement,
} from '../utils/svg';
import { resolveColor as resolveTokenColor } from '../utils/tokens';
import { DEFAULT_PALETTE } from './PieSeries';

export class FunnelSeries {
  private styleOptions: FunnelStyleOptions;
  private labelOptions: FunnelLabelOptions;

  constructor(styleOptions?: FunnelStyleOptions, labelOptions?: FunnelLabelOptions) {
    this.styleOptions = {
      direction: 'vertical',
      shape: 'trapezoid',
      gap: 4,
      borderRadius: 6,
      minSizeRatio: 0.16,
      neckStyle: 'flat',
      showConversion: true,
      conversionBase: 'previous',
      ...styleOptions,
    };
    this.labelOptions = {
      visible: true,
      position: 'inside',
      ...labelOptions,
    };
  }

  public updateOptions(styleOptions?: FunnelStyleOptions, labelOptions?: FunnelLabelOptions): void {
    if (styleOptions) {
      this.styleOptions = { ...this.styleOptions, ...styleOptions };
    }
    if (labelOptions) {
      this.labelOptions = { ...this.labelOptions, ...labelOptions };
    }
  }

  /**
   * 각 퍼널 단계의 채우기 색상을 결정합니다.
   */
  public resolveStageColor(item: DataItem, index: number): string {
    if (item.color) return resolveTokenColor(item.color);
    if (typeof this.styleOptions.colors === 'function') {
      return resolveTokenColor(this.styleOptions.colors(item, index));
    }
    if (Array.isArray(this.styleOptions.colors) && this.styleOptions.colors.length > 0) {
      return resolveTokenColor(this.styleOptions.colors[index % this.styleOptions.colors.length]);
    }
    return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
  }

  /**
   * 데이터와 컨테이너 크기로부터 각 퍼널 단계의 사다리꼴/바 좌표를 계산합니다.
   */
  public calculateStages(
    data: DataItem[],
    width: number,
    height: number,
    padding: Padding,
    progress: number = 1
  ): FunnelStageGeometry[] {
    const count = data.length;
    if (count === 0) return [];

    const maxVal = Math.max(1, ...data.map((d) => Math.max(0, d.value)));
    const firstVal = Math.max(1, data[0]?.value ?? maxVal);

    const direction = this.styleOptions.direction || 'vertical';
    const shape = this.styleOptions.shape || 'trapezoid';
    const gap = Math.max(0, this.styleOptions.gap ?? 4);
    const minRatio = Math.max(0.08, Math.min(0.5, this.styleOptions.minSizeRatio ?? 0.16));
    const clampedProgress = Math.max(0, Math.min(1, progress));

    const isOutsideLabel =
      this.labelOptions.visible !== false && this.labelOptions.position === 'outside';

    const plotLeft = padding.left + (direction === 'vertical' && isOutsideLabel ? 10 : 0);
    const plotRight =
      width - padding.right - (direction === 'vertical' && isOutsideLabel ? 90 : 0);
    const plotTop = padding.top;
    const plotBottom =
      height - padding.bottom - (direction === 'horizontal' && isOutsideLabel ? 26 : 0);

    const availW = Math.max(40, plotRight - plotLeft);
    const availH = Math.max(40, plotBottom - plotTop);
    const centerX = plotLeft + availW / 2;
    const centerY = plotTop + availH / 2;

    const ratios = data.map((d) => {
      const r = Math.max(0, d.value) / maxVal;
      return minRatio + (1 - minRatio) * r;
    });

    const stages: FunnelStageGeometry[] = [];

    if (direction === 'horizontal') {
      const totalGaps = gap * Math.max(0, count - 1);
      const stepW = (availW - totalGaps) / count;

      for (let i = 0; i < count; i++) {
        const item = data[i];
        const prevVal = i > 0 ? Math.max(1, data[i - 1].value) : Math.max(1, item.value);
        const overallRatio = Math.max(0, item.value) / firstVal;
        const stepConversionRate = i === 0 ? 1 : Math.max(0, item.value) / prevVal;

        const rStart = ratios[i] * clampedProgress;
        const rEnd =
          shape === 'bar'
            ? rStart
            : i < count - 1
              ? ratios[i + 1] * clampedProgress
              : this.styleOptions.neckStyle === 'pinch'
                ? rStart * 0.55
                : rStart;

        const hStart = availH * rStart;
        const hEnd = availH * rEnd;

        const x0 = plotLeft + i * (stepW + gap);
        const x1 = x0 + stepW;
        const maxH = Math.max(hStart, hEnd);

        const points = [
          { x: x0, y: centerY - hStart / 2 },
          { x: x1, y: centerY - hEnd / 2 },
          { x: x1, y: centerY + hEnd / 2 },
          { x: x0, y: centerY + hStart / 2 },
        ];

        stages.push({
          index: i,
          item,
          color: this.resolveStageColor(item, i),
          points,
          x: x0,
          y: centerY - maxH / 2,
          width: stepW,
          height: maxH,
          cx: (x0 + x1) / 2,
          cy: centerY,
          overallRatio,
          stepConversionRate,
        });
      }
    } else {
      const totalGaps = gap * Math.max(0, count - 1);
      const stepH = (availH - totalGaps) / count;

      for (let i = 0; i < count; i++) {
        const item = data[i];
        const prevVal = i > 0 ? Math.max(1, data[i - 1].value) : Math.max(1, item.value);
        const overallRatio = Math.max(0, item.value) / firstVal;
        const stepConversionRate = i === 0 ? 1 : Math.max(0, item.value) / prevVal;

        const rTop = ratios[i] * clampedProgress;
        const rBottom =
          shape === 'bar'
            ? rTop
            : i < count - 1
              ? ratios[i + 1] * clampedProgress
              : this.styleOptions.neckStyle === 'pinch'
                ? rTop * 0.55
                : rTop;

        const wTop = availW * rTop;
        const wBottom = availW * rBottom;

        const y0 = plotTop + i * (stepH + gap);
        const y1 = y0 + stepH;
        const maxW = Math.max(wTop, wBottom);

        const points = [
          { x: centerX - wTop / 2, y: y0 },
          { x: centerX + wTop / 2, y: y0 },
          { x: centerX + wBottom / 2, y: y1 },
          { x: centerX - wBottom / 2, y: y1 },
        ];

        stages.push({
          index: i,
          item,
          color: this.resolveStageColor(item, i),
          points,
          x: centerX - maxW / 2,
          y: y0,
          width: maxW,
          height: stepH,
          cx: centerX,
          cy: (y0 + y1) / 2,
          overallRatio,
          stepConversionRate,
        });
      }
    }

    return stages;
  }

  /**
   * 마우스 좌표 `(mx, my)`가 특정 퍼널 단계 다각형 내부에 위치하는지 판정합니다 (Ray-casting).
   */
  public isPointInStage(mx: number, my: number, stage: FunnelStageGeometry): boolean {
    const pts = stage.points;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x;
      const yi = pts[i].y;
      const xj = pts[j].x;
      const yj = pts[j].y;

      const intersect =
        yi > my !== yj > my && mx < ((xj - xi) * (my - yi)) / (yj - yi + 0.00001) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * 퍼널 전체 단계 및 라벨, 전환율 배지를 Canvas 2D에 렌더링합니다.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    stages: FunnelStageGeometry[],
    hoveredIndex: number | null,
    progress: number = 1
  ): void {
    if (stages.length === 0) return;

    ctx.save();
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      this.drawStageShape(ctx, stage, hoveredIndex === i);
    }

    const labelAlpha = progress >= 1 ? 1 : Math.max(0, Math.min(1, (progress - 0.45) / 0.55));
    if (labelAlpha > 0.02) {
      ctx.save();
      ctx.globalAlpha = labelAlpha;
      this.drawLabelsAndConversions(ctx, stages);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawStageShape(
    ctx: CanvasRenderingContext2D,
    stage: FunnelStageGeometry,
    isHovered: boolean
  ): void {
    const shape = this.styleOptions.shape || 'trapezoid';
    const border = this.styleOptions.border;

    ctx.save();
    if (isHovered) {
      ctx.shadowColor = stage.color;
      ctx.shadowBlur = 14;
    }

    if (shape === 'bar') {
      drawRoundedRect(
        ctx,
        stage.x,
        stage.y,
        stage.width,
        stage.height,
        this.styleOptions.borderRadius ?? 6
      );
    } else {
      const pts = stage.points;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
    }

    ctx.fillStyle = stage.color;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    if (isHovered) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (border && border.width && border.width > 0) {
      ctx.strokeStyle = resolveTokenColor(border.color || '#FFFFFF');
      ctx.lineWidth = border.width;
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawLabelsAndConversions(
    ctx: CanvasRenderingContext2D,
    stages: FunnelStageGeometry[]
  ): void {
    const lOpts = this.labelOptions;
    const direction = this.styleOptions.direction || 'vertical';
    const showConv = this.styleOptions.showConversion !== false;
    const convBase = this.styleOptions.conversionBase || 'previous';
    const font = lOpts.font || '600 11px Pretendard, Inter, sans-serif';

    if (lOpts.visible !== false && lOpts.position !== 'none') {
      ctx.save();
      ctx.font = font;

      for (const stage of stages) {
        const rate = convBase === 'first' ? stage.overallRatio : stage.stepConversionRate;
        const pctStr = `${Math.round(rate * 100)}%`;
        const text = lOpts.formatter
          ? lOpts.formatter(stage.item, stage)
          : showConv && stage.index > 0
            ? `${stage.item.label} · ${stage.item.value.toLocaleString()} (${pctStr})`
            : `${stage.item.label} · ${stage.item.value.toLocaleString()}`;

        if (lOpts.position === 'outside') {
          ctx.fillStyle = resolveTokenColor(lOpts.color || '#64748B');
          if (direction === 'horizontal') {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(text, stage.cx, stage.y + stage.height + 8);
          } else {
            const rightEdge = Math.max(stage.points[1].x, stage.points[2].x);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, rightEdge + 10, stage.cy);
          }
        } else {
          ctx.fillStyle = resolveTokenColor(lOpts.color || '#FFFFFF');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, stage.cx, stage.cy);
        }
      }
      ctx.restore();
    }
  }

  /**
   * 피그마(`figma.createNodeFromSvg`) 호환 퍼널 단계 및 라벨 SVG 벡터 그룹을 생성합니다.
   */
  public toSvgElements(stages: FunnelStageGeometry[]): string {
    if (stages.length === 0) return '';

    const shape = this.styleOptions.shape || 'trapezoid';
    const direction = this.styleOptions.direction || 'vertical';
    const showConv = this.styleOptions.showConversion !== false;
    const convBase = this.styleOptions.conversionBase || 'previous';
    const border = this.styleOptions.border;

    let strokeAttr = '';
    if (border && border.width && border.width > 0) {
      const parsedBorder = parseSvgColor(border.color || '#FFFFFF');
      strokeAttr = ` stroke="${escapeXml(parsedBorder.color)}" stroke-width="${fmt(border.width)}"`;
    }

    const stageEls: string[] = [];
    const labelEls: string[] = [];
    const lOpts = this.labelOptions;
    const font = lOpts.font || '600 11px Pretendard, sans-serif';

    for (const stage of stages) {
      const parsedFill = parseSvgColor(stage.color);
      const fillAttr = `fill="${escapeXml(parsedFill.color)}"${
        parsedFill.opacity < 0.999 ? ` fill-opacity="${fmt(parsedFill.opacity)}"` : ''
      }`;
      const stageId = `Funnel Stage ${stage.index + 1}: ${stage.item.label} (${stage.item.value})`;

      if (shape === 'bar') {
        const rectEl = svgRoundedRectElement({
          id: stageId,
          x: stage.x,
          y: stage.y,
          width: stage.width,
          height: stage.height,
          radius: this.styleOptions.borderRadius ?? 6,
          fillAttrs: fillAttr,
          strokeAttrs: strokeAttr.trim(),
        });
        if (rectEl) stageEls.push(rectEl);
      } else {
        const d =
          stage.points
            .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${fmt(pt.x)} ${fmt(pt.y)}`)
            .join(' ') + ' Z';
        stageEls.push(`<path id="${escapeXml(stageId)}" d="${d}" ${fillAttr}${strokeAttr} />`);
      }

      if (lOpts.visible !== false && lOpts.position !== 'none') {
        const rate = convBase === 'first' ? stage.overallRatio : stage.stepConversionRate;
        const pctStr = `${Math.round(rate * 100)}%`;
        const text = lOpts.formatter
          ? lOpts.formatter(stage.item, stage)
          : showConv && stage.index > 0
            ? `${stage.item.label} · ${stage.item.value.toLocaleString()} (${pctStr})`
            : `${stage.item.label} · ${stage.item.value.toLocaleString()}`;

        if (lOpts.position === 'outside') {
          const fill = lOpts.color || '#64748B';
          if (direction === 'horizontal') {
            labelEls.push(
              svgTextElement({
                id: `Label: ${stage.item.label}`,
                x: stage.cx,
                y: stage.y + stage.height + 8,
                text,
                font,
                fill,
                align: 'center',
                baseline: 'top',
              })
            );
          } else {
            const rightEdge = Math.max(stage.points[1].x, stage.points[2].x);
            labelEls.push(
              svgTextElement({
                id: `Label: ${stage.item.label}`,
                x: rightEdge + 10,
                y: stage.cy,
                text,
                font,
                fill,
                align: 'left',
                baseline: 'middle',
              })
            );
          }
        } else {
          labelEls.push(
            svgTextElement({
              id: `Label: ${stage.item.label}`,
              x: stage.cx,
              y: stage.cy,
              text,
              font,
              fill: lOpts.color || '#FFFFFF',
              align: 'center',
              baseline: 'middle',
            })
          );
        }
      }
    }

    const groups: string[] = [];
    if (stageEls.length > 0) {
      groups.push(`<g id="Funnel Stages">\n    ${stageEls.join('\n    ')}\n  </g>`);
    }
    if (labelEls.length > 0) {
      groups.push(`<g id="Funnel Labels">\n    ${labelEls.join('\n    ')}\n  </g>`);
    }
    return groups.join('\n  ');
  }
}
