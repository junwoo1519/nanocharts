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
  ColorAccessor,
  BarBorderStyle,
  BorderRadius,
  BarGroupMode,
} from '../types';
import { BandScale } from '../scale/BandScale';
import { LinearScale } from '../scale/LinearScale';
import { drawRoundedRect, createGradient } from '../utils/canvas';
import { resolveColor as resolveTokenColor } from '../utils/tokens';
import {
  escapeXml,
  fmt,
  parseSvgColor,
  resolveSvgPaintAttrs,
  svgRoundedRectElement,
  svgTextElement,
} from '../utils/svg';

/**
 * 정규화된 다중 바 시리즈 내부 데이터 구조
 */
export interface NormalizedBarSeries {
  /** 시리즈 고유 식별 키 */
  key: string;
  /** 시리즈 표시 이름 */
  name: string;
  /** X축 슬롯별 데이터 배열 */
  items: DataItem[];
  /** 시리즈 색상 설정 */
  color?: ColorAccessor;
  /** 시리즈 외곽선 설정 */
  border?: BarBorderStyle | ((item: DataItem, index: number) => BarBorderStyle | undefined);
  /** 범례 및 툴팁용 대표 단색 */
  swatchColor: string;
}

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
  /** 원본 데이터 인덱스 (X축 슬롯 인덱스) */
  index: number;
  /** 다중 시리즈에서의 시리즈 고유 키 (선택) */
  seriesKey?: string;
  /** 다중 시리즈에서의 시리즈 이름 (선택) */
  seriesName?: string;
  /** 다중 시리즈에서의 시리즈 순서 인덱스 (선택) */
  seriesIndex?: number;
  /** 시리즈 전용 채우기 색상 오버라이드 (선택) */
  seriesColor?: ColorAccessor;
  /** 시리즈 전용 테두리 오버라이드 (선택) */
  seriesBorder?: BarBorderStyle | ((item: DataItem, index: number) => BarBorderStyle | undefined);
  /** 스택 모드 등에서 개별 바에 적용할 모서리 둥글기 오버라이드 (선택) */
  borderRadiusOverride?: BorderRadius;
  /** 대표 단색 (툴팁/범례 연동용) */
  swatchColor?: string;
  /** 100% 누적 모드일 때의 비율 (0 ~ 100) */
  percentage?: number;
}

export class BarSeries {
  private barOptions: BarStyleOptions;
  private labelOptions?: DataLabelOptions;

  constructor(barOptions?: BarStyleOptions, labelOptions?: DataLabelOptions) {
    this.barOptions = {
      widthRatio: 0.65,
      groupGap: 0.12,
      borderRadius: [4, 4, 0, 0],
      fill: '#4F46E5', // 기본 색상: 인디고
      ...barOptions,
    };
    this.labelOptions = labelOptions;
  }

  /**
   * 현재 설정된 다중 시리즈 바 배치 모드를 반환합니다.
   */
  public getMode(): BarGroupMode {
    if (this.barOptions.stacked) return 'stacked';
    return this.barOptions.mode || 'grouped';
  }

  /**
   * 단일 바의 기하학적 수치(X, Y, 너비, 높이)를 계산합니다.
   * 
   * 양수 값인 경우: 베이스라인(0)에서 위쪽으로 생성
   * 음수 값인 경우: 베이스라인(0)에서 아래쪽으로 생성
   * 
   * @param progress 애니메이션 진행률 (0.0 ~ 1.0, 기본값: 1)
   */
  getBarGeometry(
    item: DataItem,
    index: number,
    xScale: BandScale,
    yScale: LinearScale,
    progress: number = 1
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
    const fullHeight = isPositive ? baseZero - targetY : targetY - baseZero;
    const height = Math.max(0, fullHeight * progress);
    const y = isPositive ? baseZero - height : baseZero;

    return { x, y, width, height, item, index };
  }

  /**
   * 다중 시리즈(Grouped / Stacked / Percent)의 특정 X축 슬롯(`slotIndex`)에 속한 모든 바의 기하 정보를 계산합니다.
   */
  public getMultiBarGeometriesAtSlot(
    slotIndex: number,
    activeSeries: NormalizedBarSeries[],
    xScale: BandScale,
    yScale: LinearScale,
    progress: number = 1
  ): BarGeometry[] {
    const seriesCount = activeSeries.length;
    if (seriesCount === 0) return [];

    const mode = this.getMode();
    const rawX = xScale.scale(slotIndex);
    const rawWidth = xScale.bandwidth();
    const ratio = Math.max(0.05, Math.min(1.0, this.barOptions.widthRatio ?? 0.65));
    const totalGroupWidth = rawWidth * ratio;
    const groupStartX = rawX + (rawWidth - totalGroupWidth) / 2;

    const geometries: BarGeometry[] = [];

    if (mode === 'grouped') {
      const stepWidth = totalGroupWidth / seriesCount;
      const gapRatio = seriesCount > 1 ? Math.max(0, Math.min(0.5, this.barOptions.groupGap ?? 0.12)) : 0;
      const barWidth = Math.max(1, stepWidth * (1 - gapRatio));
      const baseZero = yScale.scale(0);

      for (let s = 0; s < seriesCount; s++) {
        const series = activeSeries[s];
        const item = series.items[slotIndex];
        if (!item) continue;

        const x = groupStartX + s * stepWidth + (stepWidth - barWidth) / 2;
        const targetY = yScale.scale(item.value);
        const isPositive = item.value >= 0;
        const fullHeight = isPositive ? baseZero - targetY : targetY - baseZero;
        const height = Math.max(0, fullHeight * progress);
        const y = isPositive ? baseZero - height : baseZero;

        geometries.push({
          x,
          y,
          width: barWidth,
          height,
          item,
          index: slotIndex,
          seriesKey: series.key,
          seriesName: series.name,
          seriesIndex: s,
          seriesColor: series.color,
          seriesBorder: series.border,
          swatchColor: series.swatchColor,
        });
      }
      return geometries;
    }

    // Stacked 또는 Percent(100% 누적) 모드
    let posTotal = 0;
    let negTotal = 0;
    let topPosSeriesIdx = -1;
    let bottomNegSeriesIdx = -1;

    for (let s = 0; s < seriesCount; s++) {
      const val = activeSeries[s].items[slotIndex]?.value ?? 0;
      if (val > 0) {
        posTotal += val;
        topPosSeriesIdx = s;
      } else if (val < 0) {
        negTotal += Math.abs(val);
        bottomNegSeriesIdx = s;
      }
    }

    let posAcc = 0;
    let negAcc = 0;

    for (let s = 0; s < seriesCount; s++) {
      const series = activeSeries[s];
      const item = series.items[slotIndex];
      if (!item) continue;

      const rawVal = item.value;
      const isPositive = rawVal >= 0;
      let effectiveVal = rawVal;
      let percentage: number | undefined;

      if (mode === 'percent') {
        if (isPositive) {
          percentage = posTotal > 0 ? (rawVal / posTotal) * 100 : 0;
          effectiveVal = percentage;
        } else {
          percentage = negTotal > 0 ? (Math.abs(rawVal) / negTotal) * 100 : 0;
          effectiveVal = -percentage;
        }
      }

      if (isPositive) {
        const startVal = posAcc * progress;
        const endVal = (posAcc + effectiveVal) * progress;
        posAcc += effectiveVal;

        const yBottom = yScale.scale(startVal);
        const yTop = yScale.scale(endVal);
        const height = Math.max(0, yBottom - yTop);
        const y = yTop;

        const isTopCap = s === topPosSeriesIdx;
        geometries.push({
          x: groupStartX,
          y,
          width: totalGroupWidth,
          height,
          item,
          index: slotIndex,
          seriesKey: series.key,
          seriesName: series.name,
          seriesIndex: s,
          seriesColor: series.color,
          seriesBorder: series.border,
          swatchColor: series.swatchColor,
          borderRadiusOverride: isTopCap ? this.barOptions.borderRadius : 0,
          percentage,
        });
      } else {
        const startVal = negAcc * progress;
        const endVal = (negAcc + effectiveVal) * progress;
        negAcc += effectiveVal;

        const yTop = yScale.scale(startVal);
        const yBottom = yScale.scale(endVal);
        const height = Math.max(0, yBottom - yTop);
        const y = yTop;

        const isBottomCap = s === bottomNegSeriesIdx;
        geometries.push({
          x: groupStartX,
          y,
          width: totalGroupWidth,
          height,
          item,
          index: slotIndex,
          seriesKey: series.key,
          seriesName: series.name,
          seriesIndex: s,
          seriesColor: series.color,
          seriesBorder: series.border,
          swatchColor: series.swatchColor,
          borderRadiusOverride: isBottomCap ? this.barOptions.borderRadius : 0,
          percentage,
        });
      }
    }

    return geometries;
  }

  /**
   * 시리즈 레이어에 현재 뷰포트 내의 모든 바를 일괄 렌더링합니다 (단일 시리즈).
   * 뷰포트 컬링을 적용하여 화면 밖의 데이터는 연산 및 그리기를 완전히 스킵합니다.
   * 
   * @param progress 애니메이션 진행률 (0.0 ~ 1.0, 기본값: 1)
   */
  render(
    ctx: CanvasRenderingContext2D,
    data: DataItem[],
    xScale: BandScale,
    yScale: LinearScale,
    progress: number = 1
  ): void {
    const [start, end] = xScale.getViewport();
    if (data.length === 0 || start > end) return;

    ctx.save();

    const labelAlpha = progress >= 1 ? 1 : Math.max(0, Math.min(1, (progress - 0.55) / 0.45));

    for (let i = start; i <= end; i++) {
      const item = data[i];
      if (!item) continue;

      const geom = this.getBarGeometry(item, i, xScale, yScale, progress);
      this.drawSingleBar(ctx, geom);

      // 데이터 라벨 표시 옵션이 켜져 있는 경우 라벨 렌더링 (애니메이션 후반부에 페이드인)
      if (this.labelOptions?.visible && labelAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = labelAlpha;
        this.drawDataLabel(ctx, geom);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /**
   * 다중 시리즈(Grouped / Stacked / Percent) 바를 일괄 렌더링합니다.
   */
  public renderMulti(
    ctx: CanvasRenderingContext2D,
    activeSeries: NormalizedBarSeries[],
    xScale: BandScale,
    yScale: LinearScale,
    progress: number = 1
  ): void {
    const [start, end] = xScale.getViewport();
    if (activeSeries.length === 0 || start > end) return;

    ctx.save();
    const labelAlpha = progress >= 1 ? 1 : Math.max(0, Math.min(1, (progress - 0.55) / 0.45));
    const isStacked = this.getMode() !== 'grouped';

    for (let i = start; i <= end; i++) {
      const geoms = this.getMultiBarGeometriesAtSlot(i, activeSeries, xScale, yScale, progress);
      for (let gIdx = 0; gIdx < geoms.length; gIdx++) {
        const geom = geoms[gIdx];
        this.drawSingleBar(ctx, geom);

        if (this.labelOptions?.visible && labelAlpha > 0.01) {
          // 스택 모드에서 top-outside 라벨이면 최상단 바에만 그리거나 충분한 높이의 바 내부에 표시
          if (isStacked && (this.labelOptions.position || 'top-outside') === 'top-outside') {
            if (gIdx === geoms.length - 1) {
              ctx.save();
              ctx.globalAlpha = labelAlpha;
              this.drawDataLabel(ctx, geom);
              ctx.restore();
            }
          } else if (!isStacked || geom.height >= 15) {
            ctx.save();
            ctx.globalAlpha = labelAlpha;
            this.drawDataLabel(ctx, geom);
            ctx.restore();
          }
        }
      }
    }

    ctx.restore();
  }

  /**
   * 단일 바(Bar) 그리기 (모서리 둥글기, 채우기, 테두리)
   */
  private drawSingleBar(ctx: CanvasRenderingContext2D, geom: BarGeometry): void {
    const { x, y, width, height } = geom;
    if (width <= 0 || height <= 0) return;

    // 1. 둥근 모서리 경로 생성
    const radius = geom.borderRadiusOverride !== undefined ? geom.borderRadiusOverride : this.barOptions.borderRadius;
    drawRoundedRect(ctx, x, y, width, height, radius);

    // 2. 채우기 스타일 적용 (단색, 그라데이션, 조건부 콜백)
    ctx.fillStyle = this.resolveColor(ctx, geom);
    ctx.fill();

    // 3. 외곽 테두리(Border) 렌더링
    const border = this.resolveBorder(geom);
    if (border && border.width > 0) {
      ctx.strokeStyle = resolveTokenColor(border.color);
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
    const radius = geom.borderRadiusOverride !== undefined ? geom.borderRadiusOverride : this.barOptions.borderRadius;
    drawRoundedRect(ctx, x, y, width, height, radius);

    const hoverOpt = this.barOptions.hover;

    // 다중 시리즈이거나 커스텀 색상이 지정된 경우 반투명 화이트 하이라이트로 원래 시리즈 색상을 보존
    if (hoverOpt?.fill && !geom.seriesColor) {
      const fillStyle = typeof hoverOpt.fill === 'function' ? hoverOpt.fill(item, index) : hoverOpt.fill;
      if (typeof fillStyle === 'string') {
        ctx.fillStyle = resolveTokenColor(fillStyle);
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
    ctx.strokeStyle = resolveTokenColor(hoverBorder.color);
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
    const color = resolveTokenColor(
      typeof opts.color === 'function'
        ? opts.color(item, index)
        : opts.color || (pos.startsWith('inside') ? '#FFFFFF' : '#334155')
    );

    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';

    const text =
      geom.percentage !== undefined && this.getMode() === 'percent' && !opts.formatter
        ? `${geom.percentage.toFixed(0)}%`
        : opts.formatter
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
   * 범례(Legend) 아이콘 등에 표시할 대표 단색(Hex/RGB) 문자열을 반환합니다.
   */
  public resolveSwatchColor(item: DataItem, index: number, seriesColor?: ColorAccessor): string {
    let style: ColorStyle = item.color || '#4F46E5';
    if (item.color) {
      style = item.color;
    } else if (seriesColor) {
      style = typeof seriesColor === 'function' ? seriesColor(item, index) : seriesColor;
    } else if (typeof this.barOptions.fill === 'function') {
      style = this.barOptions.fill(item, index);
    } else if (this.barOptions.fill) {
      style = this.barOptions.fill;
    }
    const raw = typeof style === 'string' ? style : style.from;
    return resolveTokenColor(raw);
  }

  /**
   * 바의 원본 ColorStyle 객체(단색 문자열 또는 GradientConfig)를 반환합니다.
   */
  public resolveColorStyle(geom: BarGeometry): ColorStyle {
    const { item, index, seriesColor } = geom;
    if (item.color) return item.color;
    if (seriesColor) {
      return typeof seriesColor === 'function' ? seriesColor(item, index) : seriesColor;
    }
    if (typeof this.barOptions.fill === 'function') {
      return this.barOptions.fill(item, index);
    }
    return this.barOptions.fill || '#4F46E5';
  }

  /**
   * 바의 채우기 스타일(단색, 그라데이션, 함수 콜백)을 최종 캔버스 FillStyle로 변환
   */
  private resolveColor(
    ctx: CanvasRenderingContext2D,
    geom: BarGeometry
  ): string | CanvasGradient {
    const { x, y, width, height } = geom;
    const style = this.resolveColorStyle(geom);

    if (typeof style === 'string') {
      return resolveTokenColor(style);
    }

    return createGradient(ctx, x, y, width, height, style);
  }

  /**
   * 바의 테두리 옵션 계산
   */
  private resolveBorder(
    geom: BarGeometry
  ): BarBorderStyle | undefined {
    const { item, index, seriesBorder } = geom;
    if (seriesBorder) {
      return typeof seriesBorder === 'function' ? seriesBorder(item, index) : seriesBorder;
    }
    if (typeof this.barOptions.border === 'function') {
      return this.barOptions.border(item, index);
    }
    return this.barOptions.border;
  }

  /**
   * 피그마(`figma.createNodeFromSvg`) 호환 SVG 벡터 그룹(`<g id="Bars">`, `<g id="Data Labels">`)을 생성합니다.
   */
  public toSvgElements(
    data: DataItem[],
    activeSeries: NormalizedBarSeries[],
    isMulti: boolean,
    xScale: BandScale,
    yScale: LinearScale,
    defs: string[]
  ): string {
    const [start, end] = xScale.getViewport();
    if (start > end) return '';

    const barEls: string[] = [];
    const labelEls: string[] = [];
    const isStacked = this.getMode() !== 'grouped';

    const buildSingleGeomSvg = (geom: BarGeometry, gradSuffix: string, drawLabel: boolean) => {
      if (geom.width <= 0 || geom.height <= 0) return;

      const style = this.resolveColorStyle(geom);
      const fillAttrs = resolveSvgPaintAttrs(
        'fill',
        style,
        defs,
        `bar-grad-${gradSuffix}`,
        geom.x,
        geom.y,
        geom.width,
        geom.height
      );

      const border = this.resolveBorder(geom);
      let strokeAttrs = '';
      if (border && border.width > 0) {
        const parsedBorder = parseSvgColor(border.color);
        const dashAttr = border.dash && border.dash.length > 0 ? ` stroke-dasharray="${border.dash.join(' ')}"` : '';
        strokeAttrs = `stroke="${escapeXml(parsedBorder.color)}" stroke-width="${fmt(border.width)}"${dashAttr}`;
      }

      const radius =
        geom.borderRadiusOverride !== undefined ? geom.borderRadiusOverride : this.barOptions.borderRadius;
      const barId = geom.seriesName
        ? `Bar: ${geom.seriesName} - ${geom.item.label} (${geom.item.value})`
        : `Bar: ${geom.item.label} (${geom.item.value})`;

      const rectEl = svgRoundedRectElement({
        id: barId,
        x: geom.x,
        y: geom.y,
        width: geom.width,
        height: geom.height,
        radius,
        fillAttrs,
        strokeAttrs,
      });
      if (rectEl) barEls.push(rectEl);

      if (drawLabel && this.labelOptions?.visible && geom.width >= 14) {
        const pos = this.labelOptions.position || 'top-outside';
        if (pos !== 'none') {
          const offset = this.labelOptions.offset ?? 6;
          const font = this.labelOptions.font || '600 11px Pretendard, sans-serif';
          const color =
            typeof this.labelOptions.color === 'function'
              ? this.labelOptions.color(geom.item, geom.index)
              : this.labelOptions.color || (pos.startsWith('inside') ? '#FFFFFF' : '#94A3B8');

          const text =
            geom.percentage !== undefined && this.getMode() === 'percent' && !this.labelOptions.formatter
              ? `${geom.percentage.toFixed(0)}%`
              : this.labelOptions.formatter
                ? this.labelOptions.formatter(geom.item.value, geom.item, geom.index)
                : geom.item.value.toLocaleString();

          const centerX = geom.x + geom.width / 2;
          let labelY = geom.y;
          let baseline: 'top' | 'middle' | 'bottom' = 'bottom';

          switch (pos) {
            case 'top-outside':
              baseline = 'bottom';
              labelY = geom.y - offset;
              break;
            case 'inside-top':
              baseline = 'top';
              labelY = geom.y + offset;
              break;
            case 'inside-center':
              baseline = 'middle';
              labelY = geom.y + geom.height / 2;
              break;
            case 'inside-bottom':
              baseline = 'bottom';
              labelY = geom.y + geom.height - offset;
              break;
            case 'bottom-outside':
              baseline = 'top';
              labelY = geom.y + geom.height + offset;
              break;
          }

          labelEls.push(
            svgTextElement({
              id: `Label: ${geom.item.label} (${text})`,
              x: centerX,
              y: labelY,
              text,
              font,
              fill: color,
              align: 'center',
              baseline,
            })
          );
        }
      }
    };

    if (isMulti) {
      for (let i = start; i <= end; i++) {
        const geoms = this.getMultiBarGeometriesAtSlot(i, activeSeries, xScale, yScale, 1);
        geoms.forEach((geom, gIdx) => {
          const shouldDrawLabel =
            isStacked && (this.labelOptions?.position || 'top-outside') === 'top-outside'
              ? gIdx === geoms.length - 1
              : !isStacked || geom.height >= 15;
          buildSingleGeomSvg(geom, `${i}-${gIdx}`, shouldDrawLabel);
        });
      }
    } else {
      for (let i = start; i <= end; i++) {
        const item = data[i];
        if (!item) continue;
        const geom = this.getBarGeometry(item, i, xScale, yScale, 1);
        buildSingleGeomSvg(geom, `${i}`, true);
      }
    }

    const groups: string[] = [];
    if (barEls.length > 0) {
      groups.push(`<g id="Bars">\n    ${barEls.join('\n    ')}\n  </g>`);
    }
    if (labelEls.length > 0) {
      groups.push(`<g id="Data Labels">\n    ${labelEls.join('\n    ')}\n  </g>`);
    }
    return groups.join('\n  ');
  }
}
