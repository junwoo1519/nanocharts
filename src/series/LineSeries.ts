/**
 * @fileoverview 라인 및 영역 시리즈 렌더러 (LineSeries)
 * 
 * [핵심 기능]
 * 1. 곡선 보간: 직선(linear), 3차 베지에 스플라인(smooth), 계단형(step) 지원
 * 2. 영역(Area) 그라데이션 채우기: 선 아래 영역을 부드러운 수직/수평 그라데이션으로 채움
 * 3. LTTB(Largest-Triangle-Three-Buckets) 다운샘플링: 수만 개 데이터에서도 피크(고점/저점)를 보존하며 60fps 보장
 * 4. 크로스헤어(Crosshair) 및 호버 포인트 글로우 하이라이트 렌더링
 */

import type {
  DataItem,
  LineStyleOptions,
  AreaStyleOptions,
  LinePointStyleOptions,
  DataLabelOptions,
  CrosshairOptions,
  LinePointGeometry,
  Padding,
} from '../types';
import { BandScale } from '../scale/BandScale';
import { LinearScale } from '../scale/LinearScale';
import { createGradient } from '../utils/canvas';

/**
 * LTTB (Largest-Triangle-Three-Buckets) 시각적 다운샘플링 알고리즘
 * 
 * 대용량 시계열/연속 데이터를 화면 픽셀 수에 맞게 축소할 때,
 * 단순 간격 추출이 아닌 삼각형 넓이가 최대가 되는 극값(고점/저점) 포인트를 선택하여
 * 원본 데이터의 시각적 실루엣을 왜곡 없이 보존합니다.
 * 
 * @param points 원본 좌표 포인트 배열
 * @param threshold 목표 샘플링 개수 (예: 600)
 * @returns 시각적 특징이 보존된 다운샘플링 포인트 배열
 */
export function downsampleLTTB(
  points: LinePointGeometry[],
  threshold: number
): LinePointGeometry[] {
  const len = points.length;
  if (threshold >= len || threshold < 3) {
    return points;
  }

  const sampled: LinePointGeometry[] = [];
  // 첫 번째 포인트는 항상 고정 포함
  sampled.push(points[0]);

  const bucketSize = (len - 2) / (threshold - 2);
  let a = 0; // 이전 버킷에서 선택된 포인트 인덱스

  for (let i = 0; i < threshold - 2; i++) {
    // 다음 버킷의 평균점(무게중심) 계산
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    if (avgRangeEnd >= len) avgRangeEnd = len;

    const avgRangeLength = avgRangeEnd - avgRangeStart;
    let avgX = 0;
    let avgY = 0;
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += points[j].x;
      avgY += points[j].y;
    }
    avgX /= Math.max(1, avgRangeLength);
    avgY /= Math.max(1, avgRangeLength);

    // 현재 버킷 내에서 삼각형 넓이를 최대화하는 포인트 탐색
    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;

    const pointAX = points[a].x;
    const pointAY = points[a].y;

    let maxArea = -1;
    let nextA = rangeOffs;

    for (let j = rangeOffs; j < rangeTo; j++) {
      const area = Math.abs(
        (pointAX - avgX) * (points[j].y - pointAY) -
          (pointAX - points[j].x) * (avgY - pointAY)
      );
      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }

    sampled.push(points[nextA]);
    a = nextA;
  }

  // 마지막 포인트도 항상 고정 포함
  sampled.push(points[len - 1]);
  return sampled;
}

/**
 * 정규화된 다중 라인/영역 시리즈 내부 데이터 구조
 */
export interface NormalizedLineSeries {
  /** 시리즈 고유 식별 키 */
  key: string;
  /** 시리즈 표시 이름 */
  name: string;
  /** X축 슬롯별 데이터 배열 */
  items: DataItem[];
  /** 누적(Stacked) 모드일 때 누적된 상단 수치 배열 */
  stackedValues?: number[];
  /** 누적(Stacked) 모드일 때 바로 아래 시리즈의 누적 수치 배열 */
  baseValues?: number[];
  /** 개별 시리즈 렌더러 인스턴스 */
  renderer: LineSeries;
  /** 범례 및 툴팁용 대표 단색 */
  swatchColor: string;
}

export class LineSeries {
  private lineOptions: Required<Omit<LineStyleOptions, 'dash'>> & { dash?: number[] };
  private areaOptions: AreaStyleOptions;
  private pointOptions: LinePointStyleOptions;
  private labelOptions?: DataLabelOptions;
  private crosshairOptions: CrosshairOptions;
  private samplingThreshold: number | false;

  constructor(
    lineOptions?: LineStyleOptions,
    areaOptions?: AreaStyleOptions,
    pointOptions?: LinePointStyleOptions,
    labelOptions?: DataLabelOptions,
    crosshairOptions?: CrosshairOptions,
    samplingThreshold: number | false = 600
  ) {
    this.lineOptions = {
      color: '#6366F1',
      width: 2.5,
      curve: 'smooth',
      tension: 0.35,
      ...lineOptions,
    };

    this.areaOptions = {
      visible: true,
      opacity: 1,
      ...areaOptions,
    };

    this.pointOptions = {
      visible: true,
      radius: 4,
      hoverRadius: 6,
      fill: '#0B0F19',
      borderWidth: 2,
      ...pointOptions,
    };

    this.labelOptions = labelOptions;

    this.crosshairOptions = {
      enabled: true,
      vertical: true,
      horizontal: false,
      color: 'rgba(148, 163, 184, 0.45)',
      width: 1,
      dash: [4, 4],
      ...crosshairOptions,
    };

    this.samplingThreshold = samplingThreshold;
  }

  /**
   * 단일 데이터 인덱스의 라인 포인트 좌표(슬롯 정중앙 X, 수치 Y)를 계산합니다.
   * 
   * @param overrideValue 누적(Stacked) 모드 등에서 Y좌표 계산에 사용할 대체 수치 (선택)
   */
  getPointGeometry(
    item: DataItem,
    index: number,
    xScale: BandScale,
    yScale: LinearScale,
    overrideValue?: number
  ): LinePointGeometry {
    const rawX = xScale.scale(index);
    const bandwidth = xScale.bandwidth();
    const x = rawX + bandwidth / 2;
    const y = yScale.scale(overrideValue !== undefined ? overrideValue : item.value);
    return { x, y, item, index };
  }

  /**
   * 현재 뷰포트 구간의 라인, 영역(Area), 포인트 마커, 데이터 라벨을 일괄 렌더링합니다.
   * 
   * @param progress 애니메이션 진행률 (0.0 ~ 1.0, 기본값: 1)
   * @param stackedValues 누적(Stacked) 모드 상단 수치 배열 (선택)
   * @param baseValues 누적(Stacked) 모드 하단 경계 수치 배열 (선택)
   */
  render(
    ctx: CanvasRenderingContext2D,
    data: DataItem[],
    xScale: BandScale,
    yScale: LinearScale,
    padding: Padding,
    width: number,
    height: number,
    progress: number = 1,
    stackedValues?: number[],
    baseValues?: number[]
  ): void {
    const [start, end] = xScale.getViewport();
    if (data.length === 0 || start > end) return;

    // 1. 뷰포트 내 포인트 좌표 계산 (경계에서 곡선이 자연스럽게 이어지도록 좌우 1개씩 여유 포함)
    const drawStart = Math.max(0, start - 1);
    const drawEnd = Math.min(data.length - 1, end + 1);

    const domain = yScale.domain();
    const baselineVal = domain[0] < 0 && domain[1] > 0 ? 0 : domain[0];
    const baselineY = yScale.scale(baselineVal);
    // 수직 상승 보간 비율 (좌->우 와이프와 함께 곡선이 부드럽게 솟아오르는 효과)
    const verticalProgress = progress >= 1 ? 1 : Math.min(1, 0.35 + 0.65 * progress);

    const rawPoints: LinePointGeometry[] = [];
    const rawBasePoints: LinePointGeometry[] = [];

    for (let i = drawStart; i <= drawEnd; i++) {
      const item = data[i];
      if (!item) continue;
      const topVal = stackedValues ? stackedValues[i] : undefined;
      const pt = this.getPointGeometry(item, i, xScale, yScale, topVal);
      if (verticalProgress < 1) {
        pt.y = baselineY + (pt.y - baselineY) * verticalProgress;
      }
      rawPoints.push(pt);

      if (baseValues) {
        const bPt = this.getPointGeometry(item, i, xScale, yScale, baseValues[i] ?? 0);
        if (verticalProgress < 1) {
          bPt.y = baselineY + (bPt.y - baselineY) * verticalProgress;
        }
        rawBasePoints.push(bPt);
      }
    }

    if (rawPoints.length === 0) return;

    // 2. 대용량 데이터인 경우 LTTB 다운샘플링 수행
    const shouldSample = Boolean(
      this.samplingThreshold && rawPoints.length > this.samplingThreshold && !baseValues
    );
    const points = shouldSample
      ? downsampleLTTB(rawPoints, this.samplingThreshold as number)
      : rawPoints;

    const plotLeft = padding.left;
    const plotRight = width - padding.right;
    const plotTop = padding.top;
    const plotBottom = height - padding.bottom;
    const plotWidth = Math.max(1, plotRight - plotLeft);
    const plotHeight = Math.max(1, plotBottom - plotTop);

    const clampedProgress = Math.max(0, Math.min(1.05, progress));
    const revealWidth = progress >= 1 ? plotWidth : plotWidth * clampedProgress;
    const revealRight = plotLeft + revealWidth;

    ctx.save();

    // 플롯 영역 클리핑 + 좌에서 우로 펼쳐지는 와이프(Wipe) 애니메이션 마스크
    ctx.beginPath();
    ctx.rect(plotLeft, plotTop - 12, revealWidth, plotHeight + 24);
    ctx.clip();

    // 3. 하단 영역(Area) 그라데이션 채우기
    if (this.areaOptions.visible && points.length >= 2) {
      this.drawArea(
        ctx,
        points,
        yScale,
        plotLeft,
        plotTop,
        plotWidth,
        plotHeight,
        rawBasePoints.length === points.length ? rawBasePoints : undefined
      );
    }

    // 4. 메인 라인(Line) 스트로크 그리기
    this.drawLine(ctx, points, plotLeft, plotTop, plotWidth, plotHeight);

    ctx.restore();

    // 5. 포인트 마커 및 수치 라벨 렌더링 (와이프 진행 위치에 맞춰 순차 노출)
    const visibleCount = end - start + 1;
    const showStaticPoints = this.pointOptions.visible && visibleCount <= 80;
    const showLabels = this.labelOptions?.visible && visibleCount <= 45;

    if (showStaticPoints || showLabels) {
      ctx.save();
      for (const pt of points) {
        if (pt.index < start || pt.index > end) continue;
        if (progress < 1 && pt.x > revealRight + 2) continue;

        if (showStaticPoints) {
          this.drawPointMarker(ctx, pt, false);
        }
        if (showLabels) {
          this.drawDataLabel(ctx, pt);
        }
      }
      ctx.restore();
    }
  }

  /**
   * 포인트 배열을 따라 곡선 경로(Path)를 생성합니다.
   * 
   * @param connectFromCurrent `true`이면 `moveTo` 대신 `lineTo`로 현재 경로에 이어서 그립니다 (스택 영역 하단 경계용).
   */
  private traceLinePath(
    ctx: CanvasRenderingContext2D,
    points: LinePointGeometry[],
    connectFromCurrent: boolean = false
  ): void {
    if (points.length === 0) return;

    if (connectFromCurrent) {
      ctx.lineTo(points[0].x, points[0].y);
    } else {
      ctx.moveTo(points[0].x, points[0].y);
    }

    if (points.length === 1) return;

    const curve = this.lineOptions.curve || 'smooth';
    const tension = Math.max(0, Math.min(1, this.lineOptions.tension ?? 0.35));

    if (curve === 'linear') {
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
    } else if (curve === 'step') {
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const midX = (prev.x + curr.x) / 2;
        ctx.lineTo(midX, prev.y);
        ctx.lineTo(midX, curr.y);
        ctx.lineTo(curr.x, curr.y);
      }
    } else {
      // 'smooth': Catmull-Rom / Cardinal Spline 기반 3차 베지에 곡선
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i > 0 ? i - 1 : 0];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

        const cp1x = p1.x + ((p2.x - p0.x) * tension) / 2;
        const cp1y = p1.y + ((p2.y - p0.y) * tension) / 2;
        const cp2x = p2.x - ((p3.x - p1.x) * tension) / 2;
        const cp2y = p2.y - ((p3.y - p1.y) * tension) / 2;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    }
  }

  /**
   * 라인 아래 영역(Area) 채우기 (단일 영역 및 Stacked Area 하단 곡선 경계 지원)
   */
  private drawArea(
    ctx: CanvasRenderingContext2D,
    points: LinePointGeometry[],
    yScale: LinearScale,
    plotLeft: number,
    plotTop: number,
    plotWidth: number,
    plotHeight: number,
    basePoints?: LinePointGeometry[]
  ): void {
    const first = points[0];
    const last = points[points.length - 1];
    const domain = yScale.domain();
    const baselineVal = domain[0] < 0 && domain[1] > 0 ? 0 : domain[0];
    const baselineY = yScale.scale(baselineVal);

    ctx.save();
    ctx.beginPath();
    this.traceLinePath(ctx, points, false);

    if (basePoints && basePoints.length > 0) {
      const reversedBase = [...basePoints].reverse();
      this.traceLinePath(ctx, reversedBase, true);
    } else {
      ctx.lineTo(last.x, baselineY);
      ctx.lineTo(first.x, baselineY);
    }
    ctx.closePath();

    if (this.areaOptions.opacity !== undefined) {
      ctx.globalAlpha = this.areaOptions.opacity;
    }

    if (this.areaOptions.fill) {
      if (typeof this.areaOptions.fill === 'string') {
        ctx.fillStyle = this.areaOptions.fill;
      } else {
        ctx.fillStyle = createGradient(
          ctx,
          plotLeft,
          plotTop,
          plotWidth,
          plotHeight,
          this.areaOptions.fill
        );
      }
    } else {
      // 기본값: 라인 색상에서 투명해지는 수직 그라데이션 자동 생성
      const baseColor = this.getPrimaryLineColor();
      const grad = ctx.createLinearGradient(0, plotTop, 0, plotTop + plotHeight);
      grad.addColorStop(0, this.withAlpha(baseColor, 0.42));
      grad.addColorStop(1, this.withAlpha(baseColor, 0.02));
      ctx.fillStyle = grad;
    }

    ctx.fill();
    ctx.restore();
  }

  /**
   * 메인 선(Line) 그리기
   */
  private drawLine(
    ctx: CanvasRenderingContext2D,
    points: LinePointGeometry[],
    plotLeft: number,
    plotTop: number,
    plotWidth: number,
    plotHeight: number
  ): void {
    ctx.save();
    ctx.beginPath();

    if (points.length === 1) {
      ctx.arc(points[0].x, points[0].y, this.lineOptions.width, 0, Math.PI * 2);
      ctx.fillStyle = this.getPrimaryLineColor();
      ctx.fill();
      ctx.restore();
      return;
    }

    this.traceLinePath(ctx, points);

    const colorOpt = this.lineOptions.color;
    if (typeof colorOpt === 'string') {
      ctx.strokeStyle = colorOpt;
    } else {
      ctx.strokeStyle = createGradient(ctx, plotLeft, plotTop, plotWidth, plotHeight, colorOpt);
    }

    ctx.lineWidth = this.lineOptions.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (this.lineOptions.dash && this.lineOptions.dash.length > 0) {
      ctx.setLineDash(this.lineOptions.dash);
    } else {
      ctx.setLineDash([]);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * 단일 데이터 포인트 원형 마커 그리기
   */
  private drawPointMarker(
    ctx: CanvasRenderingContext2D,
    pt: LinePointGeometry,
    isHovered: boolean
  ): void {
    const radius = isHovered
      ? (this.pointOptions.hoverRadius ?? 6)
      : (this.pointOptions.radius ?? 4);
    if (radius <= 0) return;

    const { x, y, item, index } = pt;
    const primaryColor = item.color || this.getPrimaryLineColor();

    const fillColor =
      typeof this.pointOptions.fill === 'function'
        ? this.pointOptions.fill(item, index)
        : this.pointOptions.fill || '#0B0F19';

    const borderColor =
      typeof this.pointOptions.borderColor === 'function'
        ? this.pointOptions.borderColor(item, index)
        : this.pointOptions.borderColor || primaryColor;

    ctx.save();

    // 호버 상태일 때 외부 반투명 글로우 헤일로(Halo) 렌더링
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = this.withAlpha(borderColor, 0.25);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isHovered ? borderColor : fillColor;
    ctx.fill();

    const borderWidth = this.pointOptions.borderWidth ?? 2;
    if (borderWidth > 0) {
      ctx.strokeStyle = isHovered ? '#FFFFFF' : borderColor;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 포인트 상단/하단에 데이터 수치 라벨 렌더링
   */
  private drawDataLabel(ctx: CanvasRenderingContext2D, pt: LinePointGeometry): void {
    const opts = this.labelOptions;
    if (!opts || !opts.visible || opts.position === 'none') return;

    const { x, y, item, index } = pt;
    const offset = opts.offset ?? 8;
    const font = opts.font || '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const color =
      typeof opts.color === 'function'
        ? opts.color(item, index)
        : opts.color || '#94A3B8';

    const text = opts.formatter
      ? opts.formatter(item.value, item, index)
      : item.value.toLocaleString();

    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';

    if (opts.position === 'bottom-outside' || opts.position === 'inside-bottom') {
      ctx.textBaseline = 'top';
      ctx.fillText(text, x, y + offset);
    } else {
      ctx.textBaseline = 'bottom';
      ctx.fillText(text, x, y - offset);
    }

    ctx.restore();
  }

  /**
   * 인터랙션 레이어: 크로스헤어(수직/수평 점선)만 단독으로 렌더링합니다 (다중 시리즈 공유용).
   */
  public renderCrosshair(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    padding: Padding,
    width: number,
    height: number
  ): void {
    if (this.crosshairOptions.enabled === false) return;

    const plotLeft = padding.left;
    const plotRight = width - padding.right;
    const plotTop = padding.top;
    const plotBottom = height - padding.bottom;

    ctx.save();
    ctx.strokeStyle = this.crosshairOptions.color || 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = this.crosshairOptions.width ?? 1;
    if (this.crosshairOptions.dash) {
      ctx.setLineDash(this.crosshairOptions.dash);
    }

    ctx.beginPath();
    if (this.crosshairOptions.vertical !== false) {
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
    }
    if (this.crosshairOptions.horizontal) {
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * 인터랙션 레이어: 크로스헤어(수직/수평 점선) 및 호버 포인트 강조 효과를 렌더링합니다.
   */
  renderHighlight(
    ctx: CanvasRenderingContext2D,
    pt: LinePointGeometry,
    padding: Padding,
    width: number,
    height: number
  ): void {
    this.renderCrosshair(ctx, pt.x, pt.y, padding, width, height);
    this.renderMarkerHighlight(ctx, pt);
  }

  /**
   * 크로스헤어 없이 포인트 마커만 강조 렌더링합니다 (범례 호버 연동용).
   */
  public renderMarkerHighlight(ctx: CanvasRenderingContext2D, pt: LinePointGeometry): void {
    ctx.save();
    this.drawPointMarker(ctx, pt, true);
    ctx.restore();
  }

  /**
   * 범례(Legend) 아이콘에 표시할 대표 색상 문자열을 반환합니다.
   */
  public resolveSwatchColor(item: DataItem, index: number): string {
    if (item.color) return item.color;
    const bc = this.pointOptions.borderColor;
    if (typeof bc === 'function') return bc(item, index);
    if (typeof bc === 'string') return bc;
    return this.getPrimaryLineColor();
  }

  /**
   * 라인의 대표 색상 문자열을 추출합니다.
   */
  private getPrimaryLineColor(): string {
    const c = this.lineOptions.color;
    return typeof c === 'string' ? c : c.from;
  }

  /**
   * Hex 또는 RGB 색상 문자열에 알파(투명도) 값을 적용한 rgba 문자열을 반환합니다.
   */
  private withAlpha(color: string, alpha: number): string {
    const trimmed = color.trim();
    if (trimmed.startsWith('#')) {
      let hex = trimmed.slice(1);
      if (hex.length === 3) {
        hex = hex
          .split('')
          .map((ch) => ch + ch)
          .join('');
      }
      if (hex.length >= 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    if (trimmed.startsWith('rgb(')) {
      const nums = trimmed.slice(4, -1);
      return `rgba(${nums}, ${alpha})`;
    }
    return trimmed;
  }
}
