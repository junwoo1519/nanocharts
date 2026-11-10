/**
 * @fileoverview 퍼널(Funnel) 차트 메인 클래스 (FunnelChart)
 *
 * nanocharts의 퍼널 차트 최상위 오케스트레이터입니다.
 *
 * [주요 특징]
 * 1. 진행 방향 전환: 상하(`'vertical'`, 기본값) 및 좌우(`'horizontal'`) 모두 지원
 * 2. 모양 전환: 사다리꼴 연결형(`'trapezoid'`) 및 직사각형 바(`'bar'`) 지원
 * 3. 단계 간 전환율(%) 자동 계산 및 다각형 내부 히트 테스팅, 범례 토글, SVG 벡터 추출 지원
 */

import type {
  DataItem,
  FunnelChartOptions,
  FunnelStageGeometry,
  LegendItem,
  Padding,
  SvgExportOptions,
} from '../types';
import { LayerManager } from './LayerManager';
import { EventEmitter } from './EventEmitter';
import { Animator } from './Animator';
import { Tooltip } from '../components/Tooltip';
import { Legend } from '../components/Legend';
import { FunnelSeries } from '../series/FunnelSeries';
import { buildSvgLegendGroup, wrapSvgDocument } from '../utils/svg';
import {
  normalizeResponsiveOptions,
  resolveContainerDimensions,
} from '../utils/responsive';
import { buildCssFontString } from '../utils/tokens';

export class FunnelChart extends EventEmitter {
  private container: HTMLElement;
  private options: FunnelChartOptions;
  private layerManager: LayerManager;
  private tooltip: Tooltip;
  private legend: Legend;
  private funnelSeries: FunnelSeries;

  private width: number = 0;
  private height: number = 0;
  private padding: Padding;

  private resizeObserver: ResizeObserver;
  private animator: Animator = new Animator();
  private hasRenderedOnce: boolean = false;
  private stages: FunnelStageGeometry[] = [];
  private hoveredIndex: number | null = null;

  constructor(container: string | HTMLElement, options: FunnelChartOptions) {
    super();

    const el =
      typeof container === 'string' ? document.querySelector<HTMLElement>(container) : container;
    if (!el) {
      throw new Error(`Invalid container element or selector: ${container}`);
    }
    this.container = el;
    this.options = { ...options };

    this.padding = {
      top: 24,
      right: 24,
      bottom: 24,
      left: 24,
      ...options.padding,
    };

    this.layerManager = new LayerManager(this.container);
    this.tooltip = new Tooltip(this.container, options.tooltip);

    const labelFont = options.font
      ? buildCssFontString(options.font, options.font.size ?? 11, options.font.weight ?? 600)
      : undefined;

    this.funnelSeries = new FunnelSeries(
      options.funnel,
      labelFont ? { font: labelFont, ...options.labels } : options.labels
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
              this.render(false);
            }
            this.tooltip.hide();
            return;
          }
          const stageIdx = this.stages.findIndex(
            (s) => this.getItemLegendKey(s.item, s.index) === legendItem.key
          );
          if (stageIdx !== -1) {
            this.hoveredIndex = stageIdx;
            this.render(false);
            const target = this.stages[stageIdx];
            this.showStageTooltip(target.cx, target.cy, target, stageIdx);
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
            1.5
          );
          const effectiveH = rawH > 10 ? rawH : height;
          if (rawW !== this.width || effectiveH !== this.height) {
            this.resize(rawW, effectiveH);
          }
        }
      }
    });
    this.resizeObserver.observe(this.container);

    const initialDims = resolveContainerDimensions(this.container, this.options.responsive, 1.5);
    if (initialDims.width > 0 && initialDims.height > 0) {
      this.resize(initialDims.width, initialDims.height);
    }
  }

  private resolveLegendOptions(legendOpt?: FunnelChartOptions['legend']) {
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
        position: 'top' as const,
        align: 'center' as const,
        markerShape: 'rounded' as const,
        ...fontFields,
      };
    }
    return {
      position: 'top' as const,
      align: 'center' as const,
      markerShape: 'rounded' as const,
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
      color: this.funnelSeries.resolveStageColor(item, idx),
      value: item.value,
    }));
    this.legend.setItems(items);
  }

  public getEffectivePadding(targetW?: number, targetH?: number): Padding {
    const w = targetW || this.width || 640;
    const h = targetH || this.height || 400;
    const reserved = this.legend.getReservedPadding();
    const wScale = Math.max(0.68, Math.min(1.0, ((w - 200) / (600 - 200)) * 0.32 + 0.68));
    const hScale = Math.max(0.68, Math.min(1.0, ((h - 160) / (380 - 160)) * 0.32 + 0.68));
    const padScale = Math.min(wScale, hScale);
    return {
      top: Math.round(this.padding.top * padScale) + (reserved.top ?? 0),
      right: Math.round(this.padding.right * padScale) + (reserved.right ?? 0),
      bottom: Math.round(this.padding.bottom * padScale) + (reserved.bottom ?? 0),
      left: Math.round(this.padding.left * padScale) + (reserved.left ?? 0),
    };
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.layerManager.resize(width, height);

    const resp = normalizeResponsiveOptions(this.options.responsive, 1.5);
    const isCompact = resp.enabled && width < resp.compactBreakpoint;
    if (resp.onResize) {
      resp.onResize(width, height, isCompact);
    }
    this.emit('resize', { width, height, isCompact });

    const shouldAnimate = !this.hasRenderedOnce;
    this.hasRenderedOnce = true;
    this.render(shouldAnimate);
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
          color: this.funnelSeries.resolveStageColor(item, idx),
        });
      }
    });

    const effPadding = this.getEffectivePadding();
    const seriesCtx = this.layerManager.getContext('series');

    if (animate && this.options.animation !== false) {
      this.animator.start(this.options.animation, (progress) => {
        this.stages = this.funnelSeries.calculateStages(
          activeData,
          this.width,
          this.height,
          effPadding,
          progress
        );
        this.layerManager.clear('series');
        this.funnelSeries.render(seriesCtx, this.stages, this.hoveredIndex, progress);
      });
    } else {
      this.animator.cancel();
      this.stages = this.funnelSeries.calculateStages(
        activeData,
        this.width,
        this.height,
        effPadding,
        1
      );
      this.layerManager.clear('series');
      this.funnelSeries.render(seriesCtx, this.stages, this.hoveredIndex, 1);
    }
  }

  public replayAnimation(): void {
    this.render(true);
  }

  private setupInteractions(): void {
    const interactionCanvas = this.layerManager.getCanvas('interaction');

    interactionCanvas.addEventListener('mousemove', (e) => {
      const rect = interactionCanvas.getBoundingClientRect();
      this.handleHover(e.clientX - rect.left, e.clientY - rect.top);
    });

    interactionCanvas.addEventListener('mouseleave', () => {
      if (this.hoveredIndex !== null) {
        this.hoveredIndex = null;
        this.render(false);
      }
      this.legend.setHoveredKey(null);
      this.tooltip.hide();
    });

    const onTouch = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = interactionCanvas.getBoundingClientRect();
      this.handleHover(touch.clientX - rect.left, touch.clientY - rect.top);
    };
    interactionCanvas.addEventListener('touchstart', onTouch, { passive: true });
    interactionCanvas.addEventListener('touchmove', onTouch, { passive: true });
  }

  private showStageTooltip(
    tx: number,
    ty: number,
    stage: FunnelStageGeometry,
    index: number
  ): void {
    if (this.options.tooltip?.formatter) {
      this.tooltip.show(tx, ty, stage.item, index);
    } else {
      const stepPct = (stage.stepConversionRate * 100).toFixed(1);
      const totalPct = (stage.overallRatio * 100).toFixed(1);
      const labelSuffix =
        index === 0 ? `(100%)` : `(전환 ${stepPct}% · 전체 ${totalPct}%)`;
      this.tooltip.show(
        tx,
        ty,
        {
          ...stage.item,
          label: `${stage.item.label} ${labelSuffix}`,
        },
        index
      );
    }
  }

  private handleHover(mouseX: number, mouseY: number): void {
    let foundIndex: number | null = null;
    for (let i = 0; i < this.stages.length; i++) {
      if (this.funnelSeries.isPointInStage(mouseX, mouseY, this.stages[i])) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex !== null) {
      const target = this.stages[foundIndex];
      if (this.hoveredIndex !== foundIndex) {
        this.hoveredIndex = foundIndex;
        this.legend.setHoveredKey(this.getItemLegendKey(target.item, target.index));
        this.render(false);
        this.emit('hover', { item: target.item, index: foundIndex, stage: target });
      }
      this.showStageTooltip(mouseX, mouseY - 10, target, foundIndex);
    } else if (this.hoveredIndex !== null) {
      this.hoveredIndex = null;
      this.legend.setHoveredKey(null);
      this.render(false);
      this.tooltip.hide();
    }
  }

  public update(options: Partial<FunnelChartOptions>): void {
    const hasNewData = Boolean(options.data);
    this.options = { ...this.options, ...options };
    if (options.padding) {
      this.padding = { ...this.padding, ...options.padding };
    }
    const labelFont = this.options.font
      ? buildCssFontString(this.options.font, this.options.font.size ?? 11, this.options.font.weight ?? 600)
      : undefined;
    this.funnelSeries.updateOptions(
      this.options.funnel,
      labelFont ? { font: labelFont, ...this.options.labels } : this.options.labels
    );
    if (options.legend !== undefined || options.font !== undefined) {
      this.legend.updateOptions(this.resolveLegendOptions(this.options.legend), true);
    }
    if (hasNewData || options.funnel) {
      this.syncLegend();
    }
    this.render(hasNewData);
  }

  /**
   * 현재 퍼널 차트를 피그마(`figma.createNodeFromSvg`)에서 레이어별로 편집 가능한 순수 벡터(SVG) 문자열로 추출합니다.
   */
  public toSVG(exportOptions?: SvgExportOptions): string {
    const svgW = exportOptions?.width || this.width || 640;
    const svgH = exportOptions?.height || this.height || 400;

    const rawData = this.options.data || [];
    const activeData: DataItem[] = [];
    rawData.forEach((item, idx) => {
      const key = this.getItemLegendKey(item, idx);
      if (this.legend.isKeyActive(key)) {
        activeData.push({
          ...item,
          color: this.funnelSeries.resolveStageColor(item, idx),
        });
      }
    });

    const effPadding = this.getEffectivePadding(svgW, svgH);
    const exportStages = this.funnelSeries.calculateStages(
      activeData,
      svgW,
      svgH,
      effPadding,
      1
    );

    const defs: string[] = [];
    const body: string[] = [];

    const funnelSvg = this.funnelSeries.toSvgElements(exportStages);
    if (funnelSvg) body.push(funnelSvg);

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
      defs,
      body,
      backgroundColor: exportOptions?.backgroundColor,
      backgroundRadius: exportOptions?.backgroundRadius,
    });
  }

  public destroy(): void {
    this.animator.cancel();
    this.resizeObserver.disconnect();
    this.layerManager.destroy();
    this.tooltip.destroy();
    this.legend.destroy();
    this.clear();
  }
}
