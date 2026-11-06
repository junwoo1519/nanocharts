/**
 * @fileoverview 메인 바 차트 클래스 (BarChart)
 * 
 * nanocharts의 최상위 오케스트레이터입니다.
 * 
 * [주요 책임]
 * 1. 3중 Canvas 레이어 라이프사이클 및 ResizeObserver 자동 반응형 관리
 * 2. LinearScale(Y축 수치), BandScale(X축 이산형) 스케일 계산 및 동기화
 * 3. 렌더 파이프라인 조율 (Background -> Data Series -> Interaction)
 * 4. 마우스 인터랙션: O(1) 초고속 호버 하이라이트 & 툴팁 제어
 * 5. 대용량 인터랙션: 마우스 휠 줌(Zoom) 및 마우스 드래그 팬(Pan) 지원
 */

import type {
  BarChartOptions,
  DataItem,
  LegendItem,
  Padding,
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
import { BarSeries, BarGeometry, NormalizedBarSeries } from '../series/BarSeries';
import { DEFAULT_PALETTE } from '../series/PieSeries';

export class BarChart extends EventEmitter {
  /** 차트가 마운트될 부모 DOM 엘리먼트 */
  private container: HTMLElement;
  /** 사용자 설정 옵션 객체 */
  private options: BarChartOptions;
  /** 3중 캔버스 레이어 관리자 */
  private layerManager: LayerManager;
  /** 부동형 툴팁 컴포넌트 */
  private tooltip: Tooltip;
  /** 범례 컴포넌트 */
  private legend: Legend;
  /** 바 렌더링 시리즈 모듈 */
  private barSeries: BarSeries;

  /** 범례 필터링이 반영된 현재 활성 데이터 (단일 시리즈 또는 X축 슬롯 라벨 기준) */
  private activeData: DataItem[] = [];
  /** 정규화된 전체 다중 시리즈 목록 */
  private allNormalizedSeries: NormalizedBarSeries[] = [];
  /** 범례 필터링이 반영된 활성 다중 시리즈 목록 */
  private activeSeries: NormalizedBarSeries[] = [];
  /** 현재 호버 중인 범례 키 */
  private hoveredLegendKey: string | null = null;
  /** 다중 시리즈에서 현재 마우스가 직접 가리키는 개별 시리즈 키 */
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
   * BarChart 인스턴스를 생성하고 초기화합니다.
   * 
   * @param container DOM 선택자 문자열(예: '#my-chart') 또는 HTMLElement 객체
   * @param options 차트 옵션 설정
   */
  constructor(container: string | HTMLElement, options: BarChartOptions) {
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
    this.barSeries = new BarSeries(options.bar, options.labels);
    const hasMultiSeries = Boolean(options.series && options.series.length > 0);
    this.legend = new Legend(
      this.container,
      options.legend,
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
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (width !== this.width || height !== this.height) {
            this.resize(width, height);
          }
        }
      }
    });
    this.resizeObserver.observe(this.container);

    // 컨테이너가 이미 레이아웃 크기를 가지고 있다면 즉시 첫 렌더링 수행
    if (this.container.clientWidth > 0 && this.container.clientHeight > 0) {
      this.resize(this.container.clientWidth, this.container.clientHeight);
    }
  }

  /**
   * 현재 차트가 다중 시리즈(Multi-Series) 모드인지 여부를 반환합니다.
   */
  private isMultiSeries(): boolean {
    return Boolean(this.options.series && this.options.series.length > 0);
  }

  /**
   * 다중 시리즈 옵션을 내부 표준 구조(`NormalizedBarSeries[]`)로 정규화합니다.
   */
  private normalizeMultiSeries(): NormalizedBarSeries[] {
    const rawSeries = this.options.series || [];
    if (rawSeries.length === 0) return [];

    const maxLen = Math.max(0, ...rawSeries.map((s) => s.data.length));
    const xLabels = this.options.xLabels;

    return rawSeries.map((s, sIdx) => {
      const key = s.id || s.name || `series-${sIdx}`;
      const defaultColor = DEFAULT_PALETTE[sIdx % DEFAULT_PALETTE.length];
      const color = s.color ?? defaultColor;

      const items: DataItem[] = [];
      for (let i = 0; i < maxLen; i++) {
        const rawItem = s.data[i];
        const fallbackLabel = xLabels?.[i] ?? (typeof rawItem === 'object' && rawItem?.label ? rawItem.label : `#${i + 1}`);
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

      const sampleItem = items[0] || { label: s.name, value: 0 };
      const swatchColor = this.barSeries.resolveSwatchColor(sampleItem, 0, color);

      return {
        key,
        name: s.name,
        items,
        color,
        border: s.border,
        swatchColor,
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
        this.barSeries.resolveSwatchColor(item, index)
      );
      const allSameColor = colors.length > 1 && colors.every((c) => c === colors[0]);

      let catIdx = 0;
      for (const [key, { item, index }] of seen.entries()) {
        const color = allSameColor
          ? DEFAULT_PALETTE[catIdx % DEFAULT_PALETTE.length]
          : this.barSeries.resolveSwatchColor(item, index);
        items.push({ key, label: key, color });
        catIdx++;
      }
    } else {
      rawData.forEach((item, idx) => {
        const key = this.getItemLegendKey(item, idx);
        items.push({
          key,
          label: item.label,
          color: this.barSeries.resolveSwatchColor(item, idx),
          value: item.value,
        });
      });
    }

    this.legend.setItems(items);
  }

  private getEffectivePadding(): Padding {
    const reserved = this.legend.getReservedPadding();
    return {
      top: this.padding.top + (reserved.top ?? 0),
      right: this.padding.right + (reserved.right ?? 0),
      bottom: this.padding.bottom + (reserved.bottom ?? 0),
      left: this.padding.left + (reserved.left ?? 0),
    };
  }

  private syncScaleRanges(): void {
    if (this.width <= 0 || this.height <= 0) return;
    const eff = this.getEffectivePadding();
    this.xScale.range([eff.left, this.width - eff.right]);
    this.yScale.range([this.height - eff.bottom, eff.top]);
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

      const mode = this.barSeries.getMode();
      if (mode === 'percent') {
        let hasNegative = false;
        for (const s of this.activeSeries) {
          if (s.items.some((it) => it.value < 0)) {
            hasNegative = true;
            break;
          }
        }
        this.yScale.domain([hasNegative ? -100 : 0, 100]).nice(5);
        return;
      }

      let maxVal = 0;
      let minVal = 0;

      if (mode === 'stacked') {
        for (let i = 0; i < slotCount; i++) {
          let posSum = 0;
          let negSum = 0;
          for (const s of this.activeSeries) {
            const v = s.items[i]?.value ?? 0;
            if (v >= 0) posSum += v;
            else negSum += v;
          }
          if (posSum > maxVal) maxVal = posSum;
          if (negSum < minVal) minVal = negSum;
        }
      } else {
        for (const s of this.activeSeries) {
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

    // Y축 범위 계산 (상단 10% 여유 패딩 적용 후 nice 확장)
    const yMin = minVal < 0 ? minVal : 0;
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

    const shouldAnimate = !this.hasRenderedOnce;
    this.hasRenderedOnce = true;
    this.render(shouldAnimate);
  }

  /**
   * 차트의 모든 레이어(Background, Series, Interaction)를 순차적으로 렌더링합니다.
   * 
   * @param animate `true` 전달 시 설정된 애니메이션 옵션에 따라 성장(Grow) 애니메이션을 재생합니다.
   */
  public render(animate: boolean = false): void {
    if (this.width <= 0 || this.height <= 0) return;

    const effPadding = this.getEffectivePadding();
    const isMulti = this.isMultiSeries();

    // 1. Background 레이어: 격자선 및 축 렌더링 (애니메이션 중에도 1회만 고정 렌더링)
    const bgCtx = this.layerManager.getContext('background');
    this.layerManager.clear('background');
    Grid.render(bgCtx, this.options.grid, this.yScale, this.width, effPadding);
    Axis.renderYAxis(bgCtx, this.options.yAxis, this.yScale, effPadding);
    Axis.renderXAxis(bgCtx, this.options.xAxis, this.xScale, this.activeData, this.height, effPadding);

    const seriesCtx = this.layerManager.getContext('series');

    // 2. Series 레이어: 애니메이션 또는 즉시 렌더링
    if (animate && this.options.animation !== false) {
      this.layerManager.clear('interaction');
      this.animator.start(this.options.animation, (progress) => {
        this.layerManager.clear('series');
        if (isMulti) {
          this.barSeries.renderMulti(seriesCtx, this.activeSeries, this.xScale, this.yScale, progress);
        } else {
          this.barSeries.render(seriesCtx, this.activeData, this.xScale, this.yScale, progress);
        }
        if (progress >= 1) {
          this.renderHoverState();
        }
      });
    } else {
      this.animator.cancel();
      this.layerManager.clear('series');
      if (isMulti) {
        this.barSeries.renderMulti(seriesCtx, this.activeSeries, this.xScale, this.yScale, 1);
      } else {
        this.barSeries.render(seriesCtx, this.activeData, this.xScale, this.yScale, 1);
      }
      this.renderHoverState();
    }
  }

  /**
   * 현재 차트 데이터에 대해 성장(Grow) 애니메이션을 처음부터 다시 재생합니다.
   */
  public replayAnimation(): void {
    this.render(true);
  }

  /**
   * 마우스 이벤트(호버, 클릭, 드래그 팬, 휠 줌) 리스너를 설정합니다.
   */
  private setupInteractions(): void {
    const interactionCanvas = this.layerManager.getCanvas('interaction');

    // 마우스 이동 (호버 & 툴팁 감지)
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

    // 캔버스 밖으로 마우스가 나갔을 때
    interactionCanvas.addEventListener('mouseleave', () => {
      this.hoveredIndex = null;
      this.hoveredSeriesKey = null;
      this.legend.setHoveredKey(null);
      this.layerManager.clear('interaction');
      this.tooltip.hide();
      this.isDragging = false;
    });

    // 드래그 좌우 스크롤 (Pan)
    if (this.options.pan?.enabled !== false) {
      interactionCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // 마우스 좌클릭만 처리
        this.isDragging = true;
        const rect = interactionCanvas.getBoundingClientRect();
        this.dragStartX = e.clientX - rect.left;
        this.dragStartView = this.xScale.getViewport();
      });

      window.addEventListener('mouseup', this.boundMouseUp);
    }

    // 마우스 휠 줌 (Zoom)
    if (this.options.zoom?.enabled !== false) {
      interactionCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.handleZoom(e);
      }, { passive: false });
    }
  }

  /**
   * 마우스 위치로부터 O(1)로 호버 대상을 찾아내고 하이라이트 및 툴팁을 표시합니다.
   */
  private handleHover(mouseX: number, mouseY: number): void {
    const effPadding = this.getEffectivePadding();
    const plotTop = effPadding.top;
    const plotBottom = this.height - effPadding.bottom;
    const plotLeft = effPadding.left;
    const plotRight = this.width - effPadding.right;

    // 플롯 영역 밖이면 호버 해제
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

    // O(1) 초고속 인덱스 역산!
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

    // 다중 시리즈(Grouped / Stacked / Percent) 호버 판정
    if (this.isMultiSeries()) {
      const geoms = this.barSeries.getMultiBarGeometriesAtSlot(
        index,
        this.activeSeries,
        this.xScale,
        this.yScale,
        1
      );
      if (geoms.length === 0) return;

      const minX = Math.min(...geoms.map((g) => g.x));
      const maxX = Math.max(...geoms.map((g) => g.x + g.width));

      if (mouseX < minX || mouseX > maxX) {
        if (this.hoveredIndex !== null || this.hoveredSeriesKey !== null) {
          this.hoveredIndex = null;
          this.hoveredSeriesKey = null;
          this.legend.setHoveredKey(null);
          this.layerManager.clear('interaction');
          this.tooltip.hide();
        }
        return;
      }

      const isStacked = this.barSeries.getMode() !== 'grouped';
      let hitGeom: BarGeometry | undefined;
      if (isStacked) {
        hitGeom = geoms.find(
          (g) => mouseX >= g.x && mouseX <= g.x + g.width && mouseY >= g.y && mouseY <= g.y + g.height
        );
      } else {
        hitGeom = geoms.find((g) => mouseX >= g.x && mouseX <= g.x + g.width);
      }

      const newSeriesKey = hitGeom?.seriesKey ?? null;
      if (this.hoveredIndex !== index || this.hoveredSeriesKey !== newSeriesKey) {
        this.hoveredIndex = index;
        this.hoveredSeriesKey = newSeriesKey;
        this.legend.setHoveredKey(newSeriesKey);
        this.renderHoverState(hitGeom);
        this.emit('hover', {
          item: hitGeom?.item ?? slotItem,
          index,
          seriesKey: newSeriesKey,
          geometry: hitGeom ?? geoms[0],
        });
      }

      const topY = Math.min(...geoms.map((g) => g.y));
      const centerX = (minX + maxX) / 2;

      if (this.options.tooltip?.shared === false && hitGeom) {
        this.tooltip.show(hitGeom.x + hitGeom.width / 2, hitGeom.y, hitGeom.item, index);
      } else {
        const entries: TooltipEntry[] = geoms.map((g) => ({
          seriesKey: g.seriesKey || '',
          seriesName: g.seriesName || g.item.label,
          color: g.swatchColor || '#6366F1',
          value: g.item.value,
          percentage: g.percentage,
          item: g.item,
          highlighted: g.seriesKey === newSeriesKey,
        }));
        const totalSum = geoms.reduce((acc, g) => acc + g.item.value, 0);
        const showTotal = this.barSeries.getMode() === 'stacked' && geoms.length > 1;
        this.tooltip.showMulti(
          hitGeom && !isStacked ? hitGeom.x + hitGeom.width / 2 : centerX,
          hitGeom && !isStacked ? hitGeom.y : topY,
          slotItem.label,
          entries,
          index,
          showTotal ? '합계 (Total)' : undefined,
          showTotal ? totalSum.toLocaleString() : undefined
        );
      }
      return;
    }

    const geom = this.barSeries.getBarGeometry(slotItem, index, this.xScale, this.yScale);

    // 마우스가 바의 가로 폭 안에 위치하는지 판정
    const isInsideBarX = mouseX >= geom.x && mouseX <= geom.x + geom.width;
    if (isInsideBarX) {
      if (this.hoveredIndex !== index) {
        this.hoveredIndex = index;
        this.legend.setHoveredKey(this.getItemLegendKey(slotItem, index));
        this.renderHoverState(geom);
        this.emit('hover', { item: slotItem, index, geometry: geom });
      }
      this.tooltip.show(geom.x + geom.width / 2, geom.y, slotItem, index);
    } else {
      if (this.hoveredIndex !== null) {
        this.hoveredIndex = null;
        this.legend.setHoveredKey(null);
        this.layerManager.clear('interaction');
        this.tooltip.hide();
      }
    }
  }

  /**
   * 호버된 바 또는 호버된 범례 그룹의 바들을 인터랙션 레이어에 하이라이트 렌더링
   */
  private renderHoverState(specificGeom?: BarGeometry): void {
    this.layerManager.clear('interaction');
    const ctx = this.layerManager.getContext('interaction');

    if (this.isMultiSeries()) {
      if (this.hoveredIndex !== null) {
        const geoms = this.barSeries.getMultiBarGeometriesAtSlot(
          this.hoveredIndex,
          this.activeSeries,
          this.xScale,
          this.yScale,
          1
        );
        if (specificGeom) {
          this.barSeries.renderHighlight(ctx, specificGeom);
        } else if (this.hoveredSeriesKey) {
          const target = geoms.find((g) => g.seriesKey === this.hoveredSeriesKey);
          if (target) this.barSeries.renderHighlight(ctx, target);
        } else {
          for (const g of geoms) {
            this.barSeries.renderHighlight(ctx, g);
          }
        }
        return;
      }

      if (this.hoveredLegendKey !== null) {
        const [start, end] = this.xScale.getViewport();
        for (let i = start; i <= end; i++) {
          const geoms = this.barSeries.getMultiBarGeometriesAtSlot(
            i,
            this.activeSeries,
            this.xScale,
            this.yScale,
            1
          );
          for (const g of geoms) {
            if (g.seriesKey === this.hoveredLegendKey) {
              this.barSeries.renderHighlight(ctx, g);
            }
          }
        }
      }
      return;
    }

    if (this.hoveredIndex !== null) {
      const item = this.activeData[this.hoveredIndex];
      if (!item) return;

      const geom = specificGeom || this.barSeries.getBarGeometry(item, this.hoveredIndex, this.xScale, this.yScale);
      this.barSeries.renderHighlight(ctx, geom);
      return;
    }

    if (this.hoveredLegendKey !== null) {
      const [start, end] = this.xScale.getViewport();
      for (let i = start; i <= end; i++) {
        const item = this.activeData[i];
        if (!item) continue;
        if (this.getItemLegendKey(item, i) === this.hoveredLegendKey) {
          const geom = this.barSeries.getBarGeometry(item, i, this.xScale, this.yScale);
          this.barSeries.renderHighlight(ctx, geom);
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

    // 경계 범위 보정
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

    // 휠 아래: 줌아웃(1.15배 확대), 휠 위: 줌인(0.85배 축소)
    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
    let newCount = Math.round(currentCount * zoomFactor);
    newCount = Math.max(Math.min(minPoints, totalCount), Math.min(totalCount, newCount));

    if (newCount === currentCount) return;

    // 마우스 커서의 상대적 위치 비율을 계산하여 커서 위치 중심으로 줌
    const effPadding = this.getEffectivePadding();
    const rect = this.layerManager.getCanvas('interaction').getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseRatio = Math.max(0, Math.min(1, (mouseX - effPadding.left) / (this.width - effPadding.left - effPadding.right)));

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
  public update(options: Partial<BarChartOptions>): void {
    const hasNewData = Boolean(options.data || options.series || options.xLabels);
    const hasModeChange = Boolean(
      options.bar &&
        (options.bar.mode !== undefined || options.bar.stacked !== undefined)
    );

    if (options.data !== undefined) {
      this.options.data = options.data;
    }
    if (options.series !== undefined) {
      this.options.series = options.series;
    }
    if (options.xLabels !== undefined) {
      this.options.xLabels = options.xLabels;
    }
    if (options.animation !== undefined) {
      this.options.animation = options.animation;
    }
    if (options.bar || options.labels) {
      if (options.bar) this.options.bar = { ...this.options.bar, ...options.bar };
      if (options.labels) this.options.labels = { ...this.options.labels, ...options.labels };
      this.barSeries = new BarSeries(this.options.bar, this.options.labels);
    }
    if (options.legend !== undefined) {
      this.options.legend = options.legend;
      this.legend.updateOptions(options.legend, this.isMultiSeries());
    }
    if (hasNewData || options.bar || options.legend !== undefined) {
      this.syncLegend();
    }
    if (hasNewData || hasModeChange || options.legend !== undefined) {
      this.initScales();
    }
    if (options.padding) {
      this.padding = { ...this.padding, ...options.padding };
    }
    if (options.grid) this.options.grid = options.grid;
    if (options.xAxis) this.options.xAxis = options.xAxis;
    if (options.yAxis) this.options.yAxis = options.yAxis;

    this.syncScaleRanges();

    this.render(hasNewData || hasModeChange);
  }

  /**
   * 줌/팬 상태를 초기화하여 전체 데이터를 한 화면에 표시합니다.
   */
  public resetZoom(): void {
    this.xScale.setViewport(0, Math.max(0, this.activeData.length - 1));
    this.render(false);
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
