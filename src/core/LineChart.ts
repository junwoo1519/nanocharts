/**
 * @fileoverview 라인 & 영역 차트 메인 클래스 (LineChart)
 * 
 * nanocharts의 라인(Line) 및 영역(Area) 차트 최상위 오케스트레이터입니다.
 * 
 * [주요 특징]
 * 1. 3단 멀티 레이어 Canvas 아키텍처로 크로스헤어 이동 시 60fps 보장
 * 2. 베지에 곡선(smooth), 직선(linear), 계단형(step) 보간 지원
 * 3. LTTB 다운샘플링 내장으로 수천~수만 개 시계열 데이터 즉시 렌더링
 * 4. O(1) 인덱스 역산 히트 테스팅, 마우스 휠 줌(Zoom) 및 드래그 팬(Pan) 지원
 */

import type {
  AreaStyleOptions,
  DataItem,
  LegendItem,
  LineChartOptions,
  LinePointGeometry,
  LinePointStyleOptions,
  LineStyleOptions,
  Padding,
  SvgExportOptions,
  TooltipEntry,
} from '../types';
import { LayerManager } from './LayerManager';
import { EventEmitter } from './EventEmitter';
import { Animator } from './Animator';
import { LinearScale } from '../scale/LinearScale';
import { BandScale } from '../scale/BandScale';
import { Grid } from '../components/Grid';
import { Axis } from '../components/Axis';
import { Tooltip } from '../components/Tooltip';
import { Legend } from '../components/Legend';
import { LineSeries, NormalizedLineSeries } from '../series/LineSeries';
import { DEFAULT_PALETTE } from '../series/PieSeries';
import {
  buildSvgAxesGroups,
  buildSvgGridGroup,
  buildSvgLegendGroup,
  wrapSvgDocument,
} from '../utils/svg';
import {
  computeResponsivePadding,
  normalizeResponsiveOptions,
  resolveContainerDimensions,
} from '../utils/responsive';
import { buildCssFontString } from '../utils/tokens';

export class LineChart extends EventEmitter {
  /** 차트가 마운트될 부모 DOM 엘리먼트 */
  private container: HTMLElement;
  /** 사용자 설정 옵션 객체 */
  private options: LineChartOptions;
  /** 3중 캔버스 레이어 관리자 */
  private layerManager: LayerManager;
  /** 부동형 툴팁 컴포넌트 */
  private tooltip: Tooltip;
  /** 범례 컴포넌트 */
  private legend: Legend;
  /** 라인/영역 렌더링 시리즈 모듈 */
  private lineSeries: LineSeries;

  /** 범례 필터링이 반영된 현재 활성 데이터 */
  private activeData: DataItem[] = [];
  /** 정규화된 전체 다중 라인 시리즈 목록 */
  private allNormalizedSeries: NormalizedLineSeries[] = [];
  /** 범례 필터링이 반영된 활성 다중 라인 시리즈 목록 */
  private activeSeries: NormalizedLineSeries[] = [];
  /** 현재 호버 중인 범례 키 */
  private hoveredLegendKey: string | null = null;
  /** 다중 시리즈에서 마우스 Y좌표와 가장 가까운 시리즈 키 */
  private hoveredSeriesKey: string | null = null;

  /** X축 밴드 스케일 */
  private xScale: BandScale;
  /** Y축 선형 수치 스케일 */
  private yScale: LinearScale;

  /** 차트 컨테이너 가로 크기 (px) */
  private width: number = 0;
  /** 차트 컨테이너 세로 크기 (px) */
  private height: number = 0;
  /** 플롯 영역 상하좌우 여백 */
  private padding: Padding;

  /** 컨테이너 크기 변경 감지 옵저버 */
  private resizeObserver: ResizeObserver;
  /** 애니메이션 엔진 인스턴스 */
  private animator: Animator = new Animator();
  /** 최초 1회 마운트 애니메이션 실행 여부 */
  private hasRenderedOnce: boolean = false;
  /** 현재 마우스가 올라가 있는 데이터 항목 인덱스 */
  private hoveredIndex: number | null = null;

  // 드래그 팬(Pan) 내부 상태 변수
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartView: [number, number] = [0, 0];
  private boundMouseUp: () => void;

  /**
   * LineChart 인스턴스를 생성하고 초기화합니다.
   * 
   * @param container DOM 선택자 문자열(예: '#line-chart') 또는 HTMLElement 객체
   * @param options 라인 차트 옵션 설정
   */
  constructor(container: string | HTMLElement, options: LineChartOptions) {
    super();

    const el = typeof container === 'string' ? document.querySelector<HTMLElement>(container) : container;
    if (!el) {
      throw new Error(`Invalid container element or selector: ${container}`);
    }
    this.container = el;
    this.options = { ...options };

    this.padding = {
      top: 30,
      right: 20,
      bottom: 40,
      left: 50,
      ...options.padding,
    };

    this.layerManager = new LayerManager(this.container);
    this.tooltip = new Tooltip(this.container, options.tooltip);
    const defaultLabelFont = options.font
      ? buildCssFontString(options.font, options.font.size ?? 11, options.font.weight ?? 600)
      : undefined;
    this.lineSeries = new LineSeries(
      options.line,
      options.area,
      options.points,
      defaultLabelFont ? { font: defaultLabelFont, ...options.labels } : options.labels,
      options.crosshair,
      options.samplingThreshold ?? 600
    );
    const hasMultiSeries = Boolean(options.series && options.series.length > 0);
    const legendOpts =
      typeof options.legend === 'boolean'
        ? {
            visible: options.legend,
            fontFamily: options.font?.family,
            fontSize: options.font?.size ? options.font.size + 1 : undefined,
            fontWeight: options.font?.weight,
          }
        : options.legend || options.font
          ? {
              fontFamily: options.font?.family,
              fontSize: options.font?.size ? options.font.size + 1 : undefined,
              fontWeight: options.font?.weight,
              ...options.legend,
            }
          : undefined;
    this.legend = new Legend(
      this.container,
      legendOpts,
      {
        onToggle: (item, active) => {
          this.hoveredIndex = null;
          this.hoveredSeriesKey = null;
          this.tooltip.hide();
          this.initScales();
          this.syncScaleRanges();
          this.emit('legendToggle', { item, active });
          this.render(true);
        },
        onHover: (legendItem) => {
          this.hoveredLegendKey = legendItem?.key ?? null;
          this.renderHoverState();
        },
      },
      hasMultiSeries
    );

    this.xScale = new BandScale();
    this.yScale = new LinearScale();

    this.boundMouseUp = () => {
      this.isDragging = false;
    };

    this.syncLegend();
    this.initScales();
    this.setupInteractions();

    // 부모 컨테이너 크기 변화를 실시간 감지하여 자동 리사이징 & 리렌더링
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rawW = Math.round(entry.contentRect.width);
        const rawH = Math.round(entry.contentRect.height);
        if (rawW > 0) {
          const { height } = resolveContainerDimensions(
            this.container,
            this.options.responsive,
            1.6
          );
          const effectiveH = rawH > 10 ? rawH : height;
          if (rawW !== this.width || effectiveH !== this.height) {
            this.resize(rawW, effectiveH);
          }
        }
      }
    });
    this.resizeObserver.observe(this.container);

    // 컨테이너가 레이아웃 크기를 가지고 있거나 반응형 자동 높이 계산이 가능한 경우 즉시 첫 렌더링 수행
    const initialDims = resolveContainerDimensions(this.container, this.options.responsive, 1.6);
    if (initialDims.width > 0 && initialDims.height > 0) {
      this.resize(initialDims.width, initialDims.height);
    }
  }

  /**
   * 현재 차트가 다중 라인 시리즈(Multi-Line) 모드인지 여부를 반환합니다.
   */
  private isMultiSeries(): boolean {
    return Boolean(this.options.series && this.options.series.length > 0);
  }

  /**
   * 다중 라인 시리즈 옵션을 내부 표준 구조(`NormalizedLineSeries[]`)로 정규화합니다.
   */
  private normalizeMultiSeries(): NormalizedLineSeries[] {
    const rawSeries = this.options.series || [];
    if (rawSeries.length === 0) return [];

    const maxLen = Math.max(0, ...rawSeries.map((s) => s.data.length));
    const xLabels = this.options.xLabels;

    return rawSeries.map((s, sIdx) => {
      const key = s.id || s.name || `series-${sIdx}`;
      const defaultColor = DEFAULT_PALETTE[sIdx % DEFAULT_PALETTE.length];
      const color = s.color ?? defaultColor;
      const primaryHex = typeof color === 'string' ? color : color.from;

      const mergedLine: LineStyleOptions = {
        ...this.options.line,
        color,
        width: s.width ?? this.options.line?.width ?? 2.5,
        curve: s.curve ?? this.options.line?.curve ?? 'smooth',
        dash: s.dash ?? this.options.line?.dash,
      };

      let mergedArea: AreaStyleOptions;
      if (typeof s.area === 'boolean') {
        mergedArea = {
          ...this.options.area,
          visible: s.area,
          opacity: this.options.area?.opacity ?? (this.options.stacked ? 0.55 : 0.25),
        };
      } else if (s.area) {
        mergedArea = {
          ...this.options.area,
          visible: true,
          opacity: this.options.stacked ? 0.55 : 0.25,
          ...s.area,
        };
      } else {
        mergedArea = {
          ...this.options.area,
          visible: this.options.area?.visible ?? true,
          opacity: this.options.area?.opacity ?? (this.options.stacked ? 0.55 : 0.22),
        };
      }

      const mergedPoints: LinePointStyleOptions = {
        ...this.options.points,
        ...s.points,
        borderColor: s.points?.borderColor ?? primaryHex,
      };

      const defaultLabelFont = this.options.font
        ? buildCssFontString(this.options.font, this.options.font.size ?? 11, this.options.font.weight ?? 600)
        : undefined;
      const renderer = new LineSeries(
        mergedLine,
        mergedArea,
        mergedPoints,
        defaultLabelFont ? { font: defaultLabelFont, ...this.options.labels } : this.options.labels,
        this.options.crosshair,
        this.options.samplingThreshold ?? 600
      );

      const items: DataItem[] = [];
      for (let i = 0; i < maxLen; i++) {
        const rawItem = s.data[i];
        const fallbackLabel =
          xLabels?.[i] ?? (typeof rawItem === 'object' && rawItem?.label ? rawItem.label : `#${i + 1}`);
        if (typeof rawItem === 'number') {
          items.push({
            id: `${key}-${i}`,
            label: fallbackLabel,
            value: rawItem,
            category: s.name,
          });
        } else if (rawItem) {
          items.push({
            ...rawItem,
            label: xLabels?.[i] ?? rawItem.label ?? fallbackLabel,
            category: rawItem.category ?? s.name,
          });
        } else {
          items.push({
            id: `${key}-${i}`,
            label: fallbackLabel,
            value: 0,
            category: s.name,
          });
        }
      }

      return {
        key,
        name: s.name,
        items,
        renderer,
        swatchColor: primaryHex,
      };
    });
  }

  /**
   * 데이터 항목에서 범례 식별 키를 추출합니다.
   */
  private getItemLegendKey(item: DataItem, fallbackIndex: number): string {
    if (item.category) return item.category;
    return String(item.id ?? item.label ?? fallbackIndex);
  }

  /**
   * 데이터 및 스타일 옵션으로부터 범례 항목을 구성하고 동기화합니다.
   */
  private syncLegend(): void {
    if (this.isMultiSeries()) {
      this.allNormalizedSeries = this.normalizeMultiSeries();
      const items: LegendItem[] = this.allNormalizedSeries.map((s) => ({
        key: s.key,
        label: s.name,
        color: s.swatchColor,
      }));
      this.legend.setItems(items);
      return;
    }

    this.allNormalizedSeries = [];
    const rawData = this.options.data || [];
    const hasCategory = rawData.some((d) => Boolean(d.category));
    const items: LegendItem[] = [];

    if (hasCategory) {
      const seen = new Map<string, { item: DataItem; index: number }>();
      rawData.forEach((item, idx) => {
        const key = item.category || item.label;
        if (!seen.has(key)) {
          seen.set(key, { item, index: idx });
        }
      });

      const colors = Array.from(seen.values()).map(({ item, index }) =>
        this.lineSeries.resolveSwatchColor(item, index)
      );
      const allSameColor = colors.length > 1 && colors.every((c) => c === colors[0]);

      let catIdx = 0;
      for (const [key, { item, index }] of seen.entries()) {
        const color = allSameColor
          ? DEFAULT_PALETTE[catIdx % DEFAULT_PALETTE.length]
          : this.lineSeries.resolveSwatchColor(item, index);
        items.push({ key, label: key, color });
        catIdx++;
      }
    } else {
      rawData.forEach((item, idx) => {
        const key = this.getItemLegendKey(item, idx);
        items.push({
          key,
          label: item.label,
          color: this.lineSeries.resolveSwatchColor(item, idx),
          value: item.value,
        });
      });
    }

    this.legend.setItems(items);
  }

  public getEffectivePadding(targetW?: number, targetH?: number): Padding {
    const reserved = this.legend.getReservedPadding();
    const responsiveBase = computeResponsivePadding({
      basePadding: this.padding,
      userPadding: this.options.padding,
      width: targetW || this.width,
      height: targetH || this.height,
      yScale: this.yScale,
      yAxis: this.options.yAxis,
      legend: this.options.legend,
      responsive: this.options.responsive,
    });
    return {
      top: responsiveBase.top + (reserved.top ?? 0),
      right: responsiveBase.right + (reserved.right ?? 0),
      bottom: responsiveBase.bottom + (reserved.bottom ?? 0),
      left: responsiveBase.left + (reserved.left ?? 0),
    };
  }

  private syncScaleRanges(): void {
    if (this.width <= 0 || this.height <= 0) return;
    const eff = this.getEffectivePadding();
    this.xScale.range([eff.left, Math.max(eff.left + 20, this.width - eff.right)]);
    this.yScale.range([Math.max(eff.top + 20, this.height - eff.bottom), eff.top]);
  }

  /**
   * 데이터 기반으로 X/Y 스케일의 도메인을 초기화합니다.
   */
  private initScales(): void {
    if (this.isMultiSeries()) {
      if (this.allNormalizedSeries.length === 0) {
        this.allNormalizedSeries = this.normalizeMultiSeries();
      }
      this.activeSeries = this.allNormalizedSeries.filter((s) => this.legend.isKeyActive(s.key));
      const refSeries = this.activeSeries[0] || this.allNormalizedSeries[0];
      this.activeData = refSeries ? refSeries.items : [];
      const slotCount = this.activeData.length;
      this.xScale.setDomainCount(slotCount);

      let maxVal = 0;
      let minVal = 0;

      if (this.options.stacked) {
        const runningSum = new Array<number>(slotCount).fill(0);
        for (const s of this.activeSeries) {
          s.baseValues = [...runningSum];
          s.stackedValues = new Array<number>(slotCount);
          for (let i = 0; i < slotCount; i++) {
            const val = s.items[i]?.value ?? 0;
            runningSum[i] += val;
            s.stackedValues[i] = runningSum[i];
            if (runningSum[i] > maxVal) maxVal = runningSum[i];
            if (runningSum[i] < minVal) minVal = runningSum[i];
          }
        }
      } else {
        for (const s of this.activeSeries) {
          s.baseValues = undefined;
          s.stackedValues = undefined;
          for (const d of s.items) {
            if (d.value > maxVal) maxVal = d.value;
            if (d.value < minVal) minVal = d.value;
          }
        }
      }

      if (maxVal === 0 && minVal === 0) {
        maxVal = 100;
      }

      const yMin = minVal < 0 ? minVal * 1.1 : 0;
      const yMax = maxVal > 0 ? maxVal * 1.1 : 0;
      this.yScale.domain([yMin, yMax]).nice(5);
      return;
    }

    this.activeSeries = [];
    const rawData = this.options.data || [];
    this.activeData = rawData.filter((item, idx) =>
      this.legend.isKeyActive(this.getItemLegendKey(item, idx))
    );
    const data = this.activeData;
    this.xScale.setDomainCount(data.length);

    let maxVal = 0;
    let minVal = 0;
    for (const d of data) {
      if (d.value > maxVal) maxVal = d.value;
      if (d.value < minVal) minVal = d.value;
    }

    if (maxVal === 0 && minVal === 0) {
      maxVal = 100;
    }

    const yMin = minVal < 0 ? minVal * 1.1 : 0;
    const yMax = maxVal > 0 ? maxVal * 1.1 : 0;
    this.yScale.domain([yMin, yMax]).nice(5);
  }

  /**
   * 차트 크기를 재설정하고 모든 레이어를 다시 그립니다.
   */
  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    this.layerManager.resize(width, height);
    this.syncScaleRanges();

    const resp = normalizeResponsiveOptions(this.options.responsive, 1.6);
    const isCompact = resp.enabled && width < resp.compactBreakpoint;
    if (resp.onResize) {
      resp.onResize(width, height, isCompact);
    }
    this.emit('resize', { width, height, isCompact });

    const shouldAnimate = !this.hasRenderedOnce;
    this.hasRenderedOnce = true;
    this.render(shouldAnimate);
  }

  /**
   * 차트의 모든 레이어(Background, Series, Interaction)를 순차적으로 렌더링합니다.
   * 
   * @param animate `true` 전달 시 좌에서 우로 펼쳐지는 와이프(Wipe) 애니메이션을 재생합니다.
   */
  public render(animate: boolean = false): void {
    if (this.width <= 0 || this.height <= 0) return;

    const effPadding = this.getEffectivePadding();
    const isMulti = this.isMultiSeries();

    // 1. Background 레이어: 격자선 및 축 렌더링
    const bgCtx = this.layerManager.getContext('background');
    this.layerManager.clear('background');
    const axisFont = this.options.font ? buildCssFontString(this.options.font, 11, 500) : undefined;
    const xAxisOpt = axisFont ? { font: axisFont, ...this.options.xAxis } : this.options.xAxis;
    const yAxisOpt = axisFont ? { font: axisFont, ...this.options.yAxis } : this.options.yAxis;

    Grid.render(bgCtx, this.options.grid, this.yScale, this.width, effPadding, this.xScale, this.height);
    Axis.renderYAxis(bgCtx, yAxisOpt, this.yScale, effPadding);
    Axis.renderXAxis(bgCtx, xAxisOpt, this.xScale, this.activeData, this.height, effPadding);

    const seriesCtx = this.layerManager.getContext('series');

    const drawAllSeries = (progress: number) => {
      if (isMulti) {
        for (const s of this.activeSeries) {
          s.renderer.render(
            seriesCtx,
            s.items,
            this.xScale,
            this.yScale,
            effPadding,
            this.width,
            this.height,
            progress,
            s.stackedValues,
            s.baseValues
          );
        }
      } else {
        this.lineSeries.render(
          seriesCtx,
          this.activeData,
          this.xScale,
          this.yScale,
          effPadding,
          this.width,
          this.height,
          progress
        );
      }
    };

    // 2. Series 레이어: 라인 및 영역(Area) 애니메이션 또는 즉시 렌더링
    if (animate && this.options.animation !== false) {
      this.layerManager.clear('interaction');
      this.animator.start(this.options.animation, (progress) => {
        this.layerManager.clear('series');
        drawAllSeries(progress);
        if (progress >= 1) {
          this.renderHoverState();
        }
      });
    } else {
      this.animator.cancel();
      this.layerManager.clear('series');
      drawAllSeries(1);
      this.renderHoverState();
    }
  }

  /**
   * 현재 차트 데이터에 대해 와이프(Wipe) 애니메이션을 처음부터 다시 재생합니다.
   */
  public replayAnimation(): void {
    this.render(true);
  }

  /**
   * 마우스 이벤트(호버, 드래그 팬, 휠 줌) 리스너를 설정합니다.
   */
  private setupInteractions(): void {
    const interactionCanvas = this.layerManager.getCanvas('interaction');

    interactionCanvas.addEventListener('mousemove', (e) => {
      const rect = interactionCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isDragging) {
        this.handlePan(mouseX);
        return;
      }

      this.handleHover(mouseX, mouseY);
    });

    interactionCanvas.addEventListener('mouseleave', () => {
      this.hoveredIndex = null;
      this.hoveredSeriesKey = null;
      this.legend.setHoveredKey(null);
      this.layerManager.clear('interaction');
      this.tooltip.hide();
      this.isDragging = false;
    });

    if (this.options.pan?.enabled !== false) {
      interactionCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        this.isDragging = true;
        const rect = interactionCanvas.getBoundingClientRect();
        this.dragStartX = e.clientX - rect.left;
        this.dragStartView = this.xScale.getViewport();
      });

      window.addEventListener('mouseup', this.boundMouseUp);
    }

    if (this.options.zoom?.enabled !== false) {
      interactionCanvas.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          this.handleZoom(e);
        },
        { passive: false }
      );
    }

    // 모바일/태블릿 터치 인터랙션 지원 (터치 크로스헤어 & 스와이프 팬)
    interactionCanvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const rect = interactionCanvas.getBoundingClientRect();
        const tx = touch.clientX - rect.left;
        const ty = touch.clientY - rect.top;
        this.dragStartX = tx;
        this.dragStartView = this.xScale.getViewport();
        this.handleHover(tx, ty);
      },
      { passive: true }
    );

    interactionCanvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const rect = interactionCanvas.getBoundingClientRect();
        const tx = touch.clientX - rect.left;
        const ty = touch.clientY - rect.top;
        const [vStart, vEnd] = this.xScale.getViewport();
        const isZoomedIn = vStart > 0 || vEnd < Math.max(0, this.activeData.length - 1);
        if (isZoomedIn && this.options.pan?.enabled !== false) {
          this.handlePan(tx);
        } else {
          this.handleHover(tx, ty);
        }
      },
      { passive: true }
    );
  }

  /**
   * 마우스 X 위치로부터 O(1)로 가장 가까운 데이터 포인트를 역산하여
   * 크로스헤어, 포인트 하이라이트 및 툴팁을 표시합니다.
   */
  private handleHover(mouseX: number, mouseY: number): void {
    const effPadding = this.getEffectivePadding();
    const plotTop = effPadding.top;
    const plotBottom = this.height - effPadding.bottom;
    const plotLeft = effPadding.left;
    const plotRight = this.width - effPadding.right;

    if (mouseX < plotLeft || mouseX > plotRight || mouseY < plotTop || mouseY > plotBottom) {
      if (this.hoveredIndex !== null || this.hoveredSeriesKey !== null) {
        this.hoveredIndex = null;
        this.hoveredSeriesKey = null;
        this.legend.setHoveredKey(null);
        this.layerManager.clear('interaction');
        this.tooltip.hide();
      }
      return;
    }

    const index = this.xScale.invert(mouseX);
    const slotItem = this.activeData[index];

    if (!slotItem) {
      if (this.hoveredIndex !== null || this.hoveredSeriesKey !== null) {
        this.hoveredIndex = null;
        this.hoveredSeriesKey = null;
        this.legend.setHoveredKey(null);
        this.layerManager.clear('interaction');
        this.tooltip.hide();
      }
      return;
    }

    // 다중 라인(Multi-Line / Stacked Area) 호버 처리
    if (this.isMultiSeries()) {
      if (this.activeSeries.length === 0) return;

      const pointsAtSlot: { series: NormalizedLineSeries; pt: LinePointGeometry }[] = [];
      let closestSeriesKey: string | null = null;
      let minDistY = Infinity;
      let closestPt: LinePointGeometry | null = null;

      for (const s of this.activeSeries) {
        const sItem = s.items[index];
        if (!sItem) continue;
        const overrideVal = s.stackedValues ? s.stackedValues[index] : undefined;
        const pt = s.renderer.getPointGeometry(sItem, index, this.xScale, this.yScale, overrideVal);
        pointsAtSlot.push({ series: s, pt });

        const dist = Math.abs(pt.y - mouseY);
        if (dist < minDistY) {
          minDistY = dist;
          closestSeriesKey = s.key;
          closestPt = pt;
        }
      }

      if (pointsAtSlot.length === 0 || !closestPt) return;

      if (this.hoveredIndex !== index || this.hoveredSeriesKey !== closestSeriesKey) {
        this.hoveredIndex = index;
        this.hoveredSeriesKey = closestSeriesKey;
        this.legend.setHoveredKey(closestSeriesKey);
        this.renderHoverState(closestPt);
        this.emit('hover', {
          item: closestPt.item,
          index,
          seriesKey: closestSeriesKey,
          point: closestPt,
        });
      }

      const entries: TooltipEntry[] = pointsAtSlot.map(({ series, pt }) => ({
        seriesKey: series.key,
        seriesName: series.name,
        color: series.swatchColor,
        value: pt.item.value,
        item: pt.item,
        highlighted: series.key === closestSeriesKey,
      }));

      const topY = Math.min(...pointsAtSlot.map((p) => p.pt.y));
      const totalSum = pointsAtSlot.reduce((acc, p) => acc + p.pt.item.value, 0);
      const showTotal = Boolean(this.options.stacked && pointsAtSlot.length > 1);

      this.tooltip.showMulti(
        closestPt.x,
        topY,
        slotItem.label,
        entries,
        index,
        showTotal ? '합계 (Total)' : undefined,
        showTotal ? totalSum.toLocaleString() : undefined
      );
      return;
    }

    const pt = this.lineSeries.getPointGeometry(slotItem, index, this.xScale, this.yScale);

    if (this.hoveredIndex !== index) {
      this.hoveredIndex = index;
      this.legend.setHoveredKey(this.getItemLegendKey(slotItem, index));
      this.renderHoverState(pt);
      this.emit('hover', { item: slotItem, index, point: pt });
    }
    this.tooltip.show(pt.x, pt.y, slotItem, index);
  }

  /**
   * 인터랙션 레이어에 크로스헤어와 호버된 포인트 마커를 렌더링합니다.
   */
  private renderHoverState(specificPoint?: LinePointGeometry): void {
    this.layerManager.clear('interaction');
    const ctx = this.layerManager.getContext('interaction');
    const effPadding = this.getEffectivePadding();

    if (this.isMultiSeries()) {
      if (this.hoveredIndex !== null) {
        const index = this.hoveredIndex;
        let crosshairDrawn = false;
        const crosshairY = specificPoint?.y ?? effPadding.top;

        for (const s of this.activeSeries) {
          const sItem = s.items[index];
          if (!sItem) continue;
          const overrideVal = s.stackedValues ? s.stackedValues[index] : undefined;
          const pt = s.renderer.getPointGeometry(sItem, index, this.xScale, this.yScale, overrideVal);

          if (!crosshairDrawn) {
            this.lineSeries.renderCrosshair(ctx, pt.x, crosshairY, effPadding, this.width, this.height);
            crosshairDrawn = true;
          }
          s.renderer.renderMarkerHighlight(ctx, pt);
        }
        return;
      }

      if (this.hoveredLegendKey !== null) {
        const targetSeries = this.activeSeries.find((s) => s.key === this.hoveredLegendKey);
        if (!targetSeries) return;
        const [start, end] = this.xScale.getViewport();
        for (let i = start; i <= end; i++) {
          const item = targetSeries.items[i];
          if (!item) continue;
          const overrideVal = targetSeries.stackedValues ? targetSeries.stackedValues[i] : undefined;
          const pt = targetSeries.renderer.getPointGeometry(item, i, this.xScale, this.yScale, overrideVal);
          targetSeries.renderer.renderMarkerHighlight(ctx, pt);
        }
      }
      return;
    }

    if (this.hoveredIndex !== null) {
      const item = this.activeData[this.hoveredIndex];
      if (!item) return;

      const pt =
        specificPoint ||
        this.lineSeries.getPointGeometry(item, this.hoveredIndex, this.xScale, this.yScale);
      this.lineSeries.renderHighlight(ctx, pt, effPadding, this.width, this.height);
      return;
    }

    if (this.hoveredLegendKey !== null) {
      const [start, end] = this.xScale.getViewport();
      for (let i = start; i <= end; i++) {
        const item = this.activeData[i];
        if (!item) continue;
        if (this.getItemLegendKey(item, i) === this.hoveredLegendKey) {
          const pt = this.lineSeries.getPointGeometry(item, i, this.xScale, this.yScale);
          this.lineSeries.renderMarkerHighlight(ctx, pt);
        }
      }
    }
  }

  /**
   * 마우스 드래그 이동 거리에 따라 뷰포트 윈도우를 좌우로 이동(Pan)합니다.
   */
  private handlePan(currentMouseX: number): void {
    const deltaX = currentMouseX - this.dragStartX;
    const step = this.xScale.step();
    if (step <= 0) return;

    const deltaIndex = Math.round(-deltaX / step);
    const [origStart, origEnd] = this.dragStartView;
    const visibleCount = origEnd - origStart;
    const totalCount = this.activeData.length;

    let newStart = origStart + deltaIndex;
    let newEnd = newStart + visibleCount;

    if (newStart < 0) {
      newStart = 0;
      newEnd = visibleCount;
    }
    if (newEnd >= totalCount) {
      newEnd = totalCount - 1;
      newStart = Math.max(0, newEnd - visibleCount);
    }

    this.xScale.setViewport(newStart, newEnd);
    this.render();
  }

  /**
   * 마우스 휠 이벤트 시 커서 위치를 중심으로 뷰포트를 확대/축소(Zoom)합니다.
   */
  private handleZoom(e: WheelEvent): void {
    const [start, end] = this.xScale.getViewport();
    const currentCount = end - start + 1;
    const minPoints = this.options.zoom?.minPoints ?? 5;
    const totalCount = this.activeData.length;
    if (totalCount === 0) return;

    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
    let newCount = Math.round(currentCount * zoomFactor);
    newCount = Math.max(Math.min(minPoints, totalCount), Math.min(totalCount, newCount));

    if (newCount === currentCount) return;

    const effPadding = this.getEffectivePadding();
    const rect = this.layerManager.getCanvas('interaction').getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseRatio = Math.max(
      0,
      Math.min(1, (mouseX - effPadding.left) / (this.width - effPadding.left - effPadding.right))
    );

    const change = newCount - currentCount;
    let newStart = Math.round(start - change * mouseRatio);
    let newEnd = newStart + newCount - 1;

    if (newStart < 0) {
      newStart = 0;
      newEnd = Math.min(totalCount - 1, newCount - 1);
    }
    if (newEnd >= totalCount) {
      newEnd = totalCount - 1;
      newStart = Math.max(0, newEnd - newCount + 1);
    }

    this.xScale.setViewport(newStart, newEnd);
    this.render();
  }

  /**
   * 런타임에 차트의 데이터 및 옵션을 동적으로 갱신하고 다시 그립니다.
   */
  public update(options: Partial<LineChartOptions>): void {
    const hasNewData = Boolean(options.data || options.series || options.xLabels);
    const hasStackedChange = options.stacked !== undefined && options.stacked !== this.options.stacked;

    if (options.data !== undefined) {
      this.options.data = options.data;
    }
    if (options.series !== undefined) {
      this.options.series = options.series;
    }
    if (options.xLabels !== undefined) {
      this.options.xLabels = options.xLabels;
    }
    if (options.stacked !== undefined) {
      this.options.stacked = options.stacked;
    }
    if (options.animation !== undefined) {
      this.options.animation = options.animation;
    }
    const hasStyleChange = Boolean(
      options.line ||
        options.area ||
        options.points ||
        options.labels ||
        options.crosshair ||
        options.samplingThreshold !== undefined
    );
    if (hasStyleChange) {
      if (options.line) this.options.line = { ...this.options.line, ...options.line };
      if (options.area) this.options.area = { ...this.options.area, ...options.area };
      if (options.points) this.options.points = { ...this.options.points, ...options.points };
      if (options.labels) this.options.labels = { ...this.options.labels, ...options.labels };
      if (options.crosshair) this.options.crosshair = { ...this.options.crosshair, ...options.crosshair };
      if (options.samplingThreshold !== undefined) {
        this.options.samplingThreshold = options.samplingThreshold;
      }

      this.lineSeries = new LineSeries(
        this.options.line,
        this.options.area,
        this.options.points,
        this.options.labels,
        this.options.crosshair,
        this.options.samplingThreshold ?? 600
      );
    }
    if (options.legend !== undefined) {
      this.options.legend = options.legend;
      this.legend.updateOptions(options.legend, this.isMultiSeries());
    }
    if (hasNewData || hasStyleChange || hasStackedChange || options.legend !== undefined) {
      this.syncLegend();
    }
    if (hasNewData || hasStyleChange || hasStackedChange || options.legend !== undefined) {
      this.initScales();
    }
    if (options.padding) {
      this.padding = { ...this.padding, ...options.padding };
    }
    if (options.grid) this.options.grid = options.grid;
    if (options.xAxis) this.options.xAxis = options.xAxis;
    if (options.yAxis) this.options.yAxis = options.yAxis;

    this.syncScaleRanges();

    this.render(hasNewData || hasStackedChange);
  }

  /**
   * 줌/팬 상태를 초기화하여 전체 데이터를 한 화면에 표시합니다.
   */
  public resetZoom(): void {
    this.xScale.setViewport(0, Math.max(0, this.activeData.length - 1));
    this.render(false);
  }

  /**
   * 현재 라인/영역 차트를 피그마(`figma.createNodeFromSvg`)에서 레이어별로 편집 가능한 순수 벡터(SVG) 문자열로 추출합니다.
   * 
   * @param exportOptions 추출 크기, 배경색, 범례/그리드 포함 여부 설정
   * @returns 표준 SVG XML 문자열
   */
  public toSVG(exportOptions?: SvgExportOptions): string {
    const svgW = exportOptions?.width || this.width || 640;
    const svgH = exportOptions?.height || this.height || 400;
    const effPadding = this.getEffectivePadding(svgW, svgH);

    this.xScale.range([effPadding.left, svgW - effPadding.right]);
    this.yScale.range([svgH - effPadding.bottom, effPadding.top]);

    const defs: string[] = [];
    const body: string[] = [];

    const axisFont = this.options.font ? buildCssFontString(this.options.font, 11, 500) : undefined;
    const xAxisOpt = axisFont ? { font: axisFont, ...this.options.xAxis } : this.options.xAxis;
    const yAxisOpt = axisFont ? { font: axisFont, ...this.options.yAxis } : this.options.yAxis;

    if (exportOptions?.includeGrid !== false) {
      const gridSvg = buildSvgGridGroup(
        this.options.grid,
        this.yScale,
        svgW,
        effPadding,
        this.xScale,
        svgH
      );
      if (gridSvg) body.push(gridSvg);
    }

    const axesSvg = buildSvgAxesGroups(
      xAxisOpt,
      yAxisOpt,
      this.xScale,
      this.yScale,
      this.activeData,
      svgH,
      effPadding
    );
    if (axesSvg) body.push(axesSvg);

    if (this.isMultiSeries()) {
      this.activeSeries.forEach((s, idx) => {
        const seriesSvg = s.renderer.toSvgElements({
          seriesName: s.name,
          seriesIdSuffix: String(idx),
          data: s.items,
          xScale: this.xScale,
          yScale: this.yScale,
          padding: effPadding,
          width: svgW,
          height: svgH,
          defs,
          stackedValues: s.stackedValues,
          baseValues: s.baseValues,
        });
        if (seriesSvg) body.push(seriesSvg);
      });
    } else {
      const seriesSvg = this.lineSeries.toSvgElements({
        seriesName: 'Main',
        seriesIdSuffix: 'main',
        data: this.activeData,
        xScale: this.xScale,
        yScale: this.yScale,
        padding: effPadding,
        width: svgW,
        height: svgH,
        defs,
      });
      if (seriesSvg) body.push(seriesSvg);
    }

    if (exportOptions?.includeLegend !== false && this.legend.isVisible()) {
      const legendSvg = buildSvgLegendGroup(
        this.legend.getItems(),
        this.legend.getOptions(),
        svgW,
        svgH
      );
      if (legendSvg) body.push(legendSvg);
    }

    this.syncScaleRanges();

    return wrapSvgDocument({
      width: svgW,
      height: svgH,
      defs,
      body,
      backgroundColor: exportOptions?.backgroundColor,
      backgroundRadius: exportOptions?.backgroundRadius,
    });
  }

  /**
   * 차트 인스턴스를 파괴하고 ResizeObserver 및 DOM 캔버스 자원을 해제합니다.
   */
  public destroy(): void {
    this.animator.cancel();
    window.removeEventListener('mouseup', this.boundMouseUp);
    this.resizeObserver.disconnect();
    this.layerManager.destroy();
    this.tooltip.destroy();
    this.legend.destroy();
    this.clear();
  }
}
