/**
 * @fileoverview 파이/도넛 차트 메인 클래스 (PieChart)
 * 
 * nanocharts의 파이 및 도넛 차트 최상위 클래스입니다.
 * 
 * [주요 특징]
 * 1. 도넛 모드 자동 전환 (`pie.innerRadiusRatio: 0.6`)
 * 2. 부드러운 마우스 호버 팝아웃 (Explode) 인터랙션
 * 3. 극좌표계(atan2) 기반 정밀 히트 테스팅
 * 4. 도넛 중앙 요약 텍스트 및 외곽 가이드라인 라벨 지원
 */

import type {
  DataItem,
  LegendItem,
  PieChartOptions,
  Padding,
  PieSliceGeometry,
  SvgExportOptions,
} from '../types';
import { LayerManager } from './LayerManager';
import { EventEmitter } from './EventEmitter';
import { Animator } from './Animator';
import { Tooltip } from '../components/Tooltip';
import { Legend } from '../components/Legend';
import { PieSeries } from '../series/PieSeries';
import { buildSvgLegendGroup, wrapSvgDocument } from '../utils/svg';
import {
  normalizeResponsiveOptions,
  resolveContainerDimensions,
} from '../utils/responsive';
import { buildCssFontString } from '../utils/tokens';

export class PieChart extends EventEmitter {
  private container: HTMLElement;
  private options: PieChartOptions;
  private layerManager: LayerManager;
  private tooltip: Tooltip;
  private legend: Legend;
  private pieSeries: PieSeries;

  private width: number = 0;
  private height: number = 0;
  private padding: Padding;

  private resizeObserver: ResizeObserver;
  private animator: Animator = new Animator();
  private hasRenderedOnce: boolean = false;
  private slices: PieSliceGeometry[] = [];
  private hoveredIndex: number | null = null;
  /** 각 조각별 현재 호버 팝아웃 진행률 (0.0 ~ 1.0) */
  private hoverRatios: number[] = [];
  /** 호버 트랜지션 rAF 핸들 */
  private hoverRafId: number | null = null;

  constructor(container: string | HTMLElement, options: PieChartOptions) {
    super();

    const el = typeof container === 'string' ? document.querySelector<HTMLElement>(container) : container;
    if (!el) {
      throw new Error(`Invalid container element or selector: ${container}`);
    }
    this.container = el;
    this.options = { ...options };

    this.padding = {
      top: 20,
      right: 20,
      bottom: 20,
      left: 20,
      ...options.padding,
    };

    this.layerManager = new LayerManager(this.container);
    this.tooltip = new Tooltip(this.container, options.tooltip);
    const labelFont = options.font
      ? buildCssFontString(options.font, options.font.size ?? 11, options.font.weight ?? 600)
      : undefined;
    const centerOpts =
      options.center && options.font
        ? {
            titleFont: buildCssFontString(options.font, (options.font.size ?? 11) + 9, 700),
            subtitleFont: buildCssFontString(options.font, options.font.size ?? 11, 500),
            ...options.center,
          }
        : options.center;
    this.pieSeries = new PieSeries(
      options.pie,
      labelFont ? { font: labelFont, ...options.labels } : options.labels,
      centerOpts
    );
    this.legend = new Legend(
      this.container,
      this.resolveLegendOptions(options.legend),
      {
        onToggle: (item, active) => {
          this.hoveredIndex = null;
          this.tooltip.hide();
          this.emit('legendToggle', { item, active });
          this.render(true);
        },
        onHover: (legendItem) => {
          if (!legendItem) {
            if (this.hoveredIndex !== null) {
              this.hoveredIndex = null;
              this.startHoverTransition();
            }
            this.tooltip.hide();
            return;
          }
          const sliceIdx = this.slices.findIndex(
            (s) => this.getItemLegendKey(s.item, s.index) === legendItem.key
          );
          if (sliceIdx !== -1) {
            this.hoveredIndex = sliceIdx;
            this.startHoverTransition();
            const targetSlice = this.slices[sliceIdx];
            const tx = targetSlice.cx + Math.cos(targetSlice.midAngle) * (targetSlice.outerRadius * 0.85);
            const ty = targetSlice.cy + Math.sin(targetSlice.midAngle) * (targetSlice.outerRadius * 0.85);
            this.showSliceTooltip(tx, ty, targetSlice, sliceIdx);
          }
        },
      },
      true
    );
    this.syncLegend();

    this.setupInteractions();

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rawW = Math.round(entry.contentRect.width);
        const rawH = Math.round(entry.contentRect.height);
        if (rawW > 0) {
          const { height } = resolveContainerDimensions(
            this.container,
            this.options.responsive,
            1.35
          );
          const effectiveH = rawH > 10 ? rawH : height;
          if (rawW !== this.width || effectiveH !== this.height) {
            this.resize(rawW, effectiveH);
          }
        }
      }
    });
    this.resizeObserver.observe(this.container);

    const initialDims = resolveContainerDimensions(this.container, this.options.responsive, 1.35);
    if (initialDims.width > 0 && initialDims.height > 0) {
      this.resize(initialDims.width, initialDims.height);
    }
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.layerManager.resize(width, height);

    const resp = normalizeResponsiveOptions(this.options.responsive, 1.35);
    const isCompact = resp.enabled && width < resp.compactBreakpoint;
    if (resp.onResize) {
      resp.onResize(width, height, isCompact);
    }
    this.emit('resize', { width, height, isCompact });

    const shouldAnimate = !this.hasRenderedOnce;
    this.hasRenderedOnce = true;
    this.render(shouldAnimate);
  }

  private resolveLegendOptions(legendOpt?: PieChartOptions['legend']) {
    const fontFields = this.options.font
      ? {
          fontFamily: this.options.font.family,
          fontSize: this.options.font.size ? this.options.font.size + 1 : undefined,
          fontWeight: this.options.font.weight,
        }
      : {};
    if (typeof legendOpt === 'boolean') {
      return {
        visible: legendOpt,
        position: 'bottom' as const,
        align: 'center' as const,
        markerShape: 'circle' as const,
        ...fontFields,
      };
    }
    return {
      position: 'bottom' as const,
      align: 'center' as const,
      markerShape: 'circle' as const,
      ...fontFields,
      ...legendOpt,
    };
  }

  private getItemLegendKey(item: DataItem, fallbackIndex: number): string {
    return String(item.id ?? item.label ?? fallbackIndex);
  }

  private syncLegend(): void {
    const data = this.options.data || [];
    const items: LegendItem[] = data.map((item, idx) => ({
      key: this.getItemLegendKey(item, idx),
      label: item.label,
      color: this.pieSeries.resolveSliceColor(item, idx),
      value: item.value,
    }));
    this.legend.setItems(items);
  }

  public getEffectivePadding(targetW?: number, targetH?: number): Padding {
    const w = targetW || this.width || 640;
    const h = targetH || this.height || 400;
    const reserved = this.legend.getReservedPadding();
    const wScale = Math.max(0.65, Math.min(1.0, ((w - 200) / (600 - 200)) * 0.35 + 0.65));
    const hScale = Math.max(0.65, Math.min(1.0, ((h - 160) / (380 - 160)) * 0.35 + 0.65));
    const padScale = Math.min(wScale, hScale);
    return {
      top: Math.round(this.padding.top * padScale) + (reserved.top ?? 0),
      right: Math.round(this.padding.right * padScale) + (reserved.right ?? 0),
      bottom: Math.round(this.padding.bottom * padScale) + (reserved.bottom ?? 0),
      left: Math.round(this.padding.left * padScale) + (reserved.left ?? 0),
    };
  }

  public render(animate: boolean = false): void {
    if (this.width <= 0 || this.height <= 0) return;

    const rawData = this.options.data || [];
    const activeData: DataItem[] = [];
    rawData.forEach((item, idx) => {
      const key = this.getItemLegendKey(item, idx);
      if (this.legend.isKeyActive(key)) {
        activeData.push({
          ...item,
          color: this.pieSeries.resolveSliceColor(item, idx),
        });
      }
    });

    // 조각 기하학 수치 재계산
    const effectivePadding = this.getEffectivePadding(this.width, this.height);
    this.slices = this.pieSeries.calculateSlices(
      activeData,
      this.width,
      this.height,
      effectivePadding
    );

    if (this.hoverRatios.length !== this.slices.length) {
      this.hoverRatios = new Array(this.slices.length).fill(0);
    }

    const seriesCtx = this.layerManager.getContext('series');

    if (animate && this.options.animation !== false) {
      this.stopHoverTransition();
      this.hoverRatios.fill(0);
      this.layerManager.clear('interaction');
      this.animator.start(this.options.animation, (progress) => {
        this.layerManager.clear('series');
        this.pieSeries.render(seriesCtx, this.slices, this.hoverRatios, progress);
        if (progress >= 1 && this.hoveredIndex !== null) {
          this.startHoverTransition();
        }
      });
    } else {
      this.animator.cancel();
      this.layerManager.clear('series');
      this.pieSeries.render(seriesCtx, this.slices, this.hoverRatios, 1);
    }
  }

  /**
   * 현재 파이/도넛 차트에 대해 회전(Sweep) 애니메이션을 처음부터 다시 재생합니다.
   */
  public replayAnimation(): void {
    this.render(true);
  }

  private setupInteractions(): void {
    const interactionCanvas = this.layerManager.getCanvas('interaction');

    interactionCanvas.addEventListener('mousemove', (e) => {
      const rect = interactionCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.handleHover(mouseX, mouseY);
    });

    interactionCanvas.addEventListener('mouseleave', () => {
      if (this.hoveredIndex !== null) {
        this.hoveredIndex = null;
        this.startHoverTransition();
      }
      this.legend.setHoveredKey(null);
      this.tooltip.hide();
    });

    // 모바일/태블릿 터치 호버 지원
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = interactionCanvas.getBoundingClientRect();
      this.handleHover(touch.clientX - rect.left, touch.clientY - rect.top);
    };
    interactionCanvas.addEventListener('touchstart', onTouch, { passive: true });
    interactionCanvas.addEventListener('touchmove', onTouch, { passive: true });
  }

  private showSliceTooltip(tx: number, ty: number, targetSlice: PieSliceGeometry, index: number): void {
    if (this.options.tooltip?.formatter) {
      this.tooltip.show(tx, ty, targetSlice.item, index);
    } else {
      this.tooltip.show(
        tx,
        ty,
        {
          ...targetSlice.item,
          label: `${targetSlice.item.label} (${(targetSlice.percentage * 100).toFixed(1)}%)`,
        },
        index
      );
    }
  }

  /**
   * 마우스 좌표 (mouseX, mouseY)로부터 극좌표(거리 r, 각도 theta)를 계산하여
   * 어떤 파이 조각에 커서가 위치하는지 검출합니다.
   */
  private handleHover(mouseX: number, mouseY: number): void {
    if (this.slices.length === 0) return;

    const first = this.slices[0];
    const { cx, cy } = first;

    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 마우스의 각도 계산 (-PI ~ +PI)
    let angle = Math.atan2(dy, dx);

    // 각도를 12시 방향(-PI/2) 기준으로 0 ~ 2*PI 범위로 정규화
    if (angle < -Math.PI / 2) {
      angle += 2 * Math.PI;
    }

    let foundIndex: number | null = null;

    for (let i = 0; i < this.slices.length; i++) {
      const slice = this.slices[i];
      // 반지름 범위 검사 (도넛 구멍 안쪽이나 외곽 밖 제외, 팝아웃 여유 거리 포함)
      const currentRatio = this.hoverRatios[i] ?? 0;
      const extraRadius = (this.options.pie?.hoverExplode ?? 10) * currentRatio + 10;
      if (distance >= slice.innerRadius && distance <= slice.outerRadius + extraRadius) {
        let sAngle = slice.startAngle;
        let eAngle = slice.endAngle;

        if (sAngle < -Math.PI / 2) sAngle += 2 * Math.PI;
        if (eAngle < -Math.PI / 2) eAngle += 2 * Math.PI;

        if (angle >= sAngle && angle <= eAngle) {
          foundIndex = i;
          break;
        }
      }
    }

    if (foundIndex !== null) {
      const targetSlice = this.slices[foundIndex];
      if (this.hoveredIndex !== foundIndex) {
        this.hoveredIndex = foundIndex;
        this.startHoverTransition();
        this.legend.setHoveredKey(this.getItemLegendKey(targetSlice.item, targetSlice.index));
        this.emit('hover', { item: targetSlice.item, index: foundIndex, slice: targetSlice });
      }

      // 툴팁 위치는 해당 조각의 외곽 중앙 쪽으로 표시
      const currentRatio = this.hoverRatios[foundIndex] ?? 0;
      const explodeOffset = (this.options.pie?.hoverExplode ?? 10) * currentRatio;
      const tooltipRadius = targetSlice.outerRadius * 0.82 + explodeOffset;
      const tx = cx + Math.cos(targetSlice.midAngle) * tooltipRadius;
      const ty = cy + Math.sin(targetSlice.midAngle) * tooltipRadius;

      this.showSliceTooltip(tx, ty, targetSlice, foundIndex);
    } else {
      if (this.hoveredIndex !== null) {
        this.hoveredIndex = null;
        this.startHoverTransition();
        this.legend.setHoveredKey(null);
        this.tooltip.hide();
      }
    }
  }

  /**
   * 각 조각의 호버 비율(`hoverRatios[i]`)을 목표 상태(`0` 또는 `1`)로
   * 매 프레임 부드럽게 보간(Lerp)하여 팝아웃/복귀 애니메이션을 구동합니다.
   */
  private startHoverTransition(): void {
    if (this.animator.isAnimating()) return;
    if (this.hoverRafId !== null) return;

    const step = () => {
      let needsMoreFrames = false;
      const smoothing = 0.22; // 60fps 기준 약 180~220ms 동안 부드럽게 감속 수렴

      for (let i = 0; i < this.slices.length; i++) {
        const target = this.hoveredIndex === i ? 1 : 0;
        const current = this.hoverRatios[i] ?? 0;
        const diff = target - current;

        if (Math.abs(diff) > 0.004) {
          this.hoverRatios[i] = current + diff * smoothing;
          needsMoreFrames = true;
        } else {
          this.hoverRatios[i] = target;
        }
      }

      const seriesCtx = this.layerManager.getContext('series');
      this.layerManager.clear('series');
      this.pieSeries.render(seriesCtx, this.slices, this.hoverRatios, 1);

      if (needsMoreFrames) {
        this.hoverRafId = requestAnimationFrame(step);
      } else {
        this.hoverRafId = null;
      }
    };

    this.hoverRafId = requestAnimationFrame(step);
  }

  private stopHoverTransition(): void {
    if (this.hoverRafId !== null) {
      cancelAnimationFrame(this.hoverRafId);
      this.hoverRafId = null;
    }
  }

  public update(options: Partial<PieChartOptions>): void {
    const hasNewData = Boolean(options.data);
    if (options.data) this.options.data = options.data;
    if (options.animation !== undefined) this.options.animation = options.animation;
    if (options.pie || options.labels || options.center) {
      if (options.pie) this.options.pie = { ...this.options.pie, ...options.pie };
      if (options.labels) this.options.labels = { ...this.options.labels, ...options.labels };
      if (options.center) this.options.center = { ...this.options.center, ...options.center };
      this.pieSeries = new PieSeries(this.options.pie, this.options.labels, this.options.center);
    }
    if (options.legend !== undefined) {
      this.options.legend = options.legend;
      this.legend.updateOptions(this.resolveLegendOptions(options.legend), true);
    }
    if (hasNewData || options.pie || options.legend !== undefined) {
      this.syncLegend();
    }
    if (options.padding) this.padding = { ...this.padding, ...options.padding };

    this.render(hasNewData);
  }

  /**
   * 현재 파이/도넛 차트를 피그마(`figma.createNodeFromSvg`)에서 레이어별로 편집 가능한 순수 벡터(SVG) 문자열로 추출합니다.
   * 
   * @param exportOptions 추출 크기, 배경색, 범례 포함 여부 설정
   * @returns 표준 SVG XML 문자열
   */
  public toSVG(exportOptions?: SvgExportOptions): string {
    const svgW = exportOptions?.width || this.width || 560;
    const svgH = exportOptions?.height || this.height || 400;

    const rawData = this.options.data || [];
    const activeData: DataItem[] = [];
    rawData.forEach((item, idx) => {
      const key = this.getItemLegendKey(item, idx);
      if (this.legend.isKeyActive(key)) {
        activeData.push({
          ...item,
          color: this.pieSeries.resolveSliceColor(item, idx),
        });
      }
    });

    const effectivePadding = this.getEffectivePadding(svgW, svgH);
    const slices = this.pieSeries.calculateSlices(activeData, svgW, svgH, effectivePadding);
    const body: string[] = [];

    const pieSvg = this.pieSeries.toSvgElements(slices);
    if (pieSvg) body.push(pieSvg);

    if (exportOptions?.includeLegend !== false && this.legend.isVisible()) {
      const legendSvg = buildSvgLegendGroup(
        this.legend.getItems(),
        this.legend.getOptions(),
        svgW,
        svgH
      );
      if (legendSvg) body.push(legendSvg);
    }

    return wrapSvgDocument({
      width: svgW,
      height: svgH,
      defs: [],
      body,
      backgroundColor: exportOptions?.backgroundColor,
      backgroundRadius: exportOptions?.backgroundRadius,
    });
  }

  public destroy(): void {
    this.animator.cancel();
    this.stopHoverTransition();
    this.resizeObserver.disconnect();
    this.layerManager.destroy();
    this.tooltip.destroy();
    this.legend.destroy();
    this.clear();
  }
}
