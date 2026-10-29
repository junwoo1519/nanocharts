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
  PieChartOptions,
  Padding,
  PieSliceGeometry,
} from '../types';
import { LayerManager } from './LayerManager';
import { EventEmitter } from './EventEmitter';
import { Tooltip } from '../components/Tooltip';
import { PieSeries } from '../series/PieSeries';

export class PieChart extends EventEmitter {
  private container: HTMLElement;
  private options: PieChartOptions;
  private layerManager: LayerManager;
  private tooltip: Tooltip;
  private pieSeries: PieSeries;

  private width: number = 0;
  private height: number = 0;
  private padding: Padding;

  private resizeObserver: ResizeObserver;
  private slices: PieSliceGeometry[] = [];
  private hoveredIndex: number | null = null;

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
    this.pieSeries = new PieSeries(options.pie, options.labels, options.center);

    this.setupInteractions();

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.resize(width, height);
        }
      }
    });
    this.resizeObserver.observe(this.container);
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.layerManager.resize(width, height);
    this.render();
  }

  public render(): void {
    if (this.width <= 0 || this.height <= 0) return;

    // 조각 기하학 수치 재계산
    this.slices = this.pieSeries.calculateSlices(
      this.options.data || [],
      this.width,
      this.height,
      this.padding
    );

    // 데이터 레이어 렌더링
    const seriesCtx = this.layerManager.getContext('series');
    this.layerManager.clear('series');
    this.pieSeries.render(seriesCtx, this.slices, null);

    // 인터랙션 레이어 갱신
    this.renderHoverState();
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
      this.hoveredIndex = null;
      this.layerManager.clear('interaction');
      this.tooltip.hide();
    });
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
      // 반지름 범위 검사 (도넛 구멍 안쪽이나 외곽 밖 제외)
      if (distance >= slice.innerRadius && distance <= slice.outerRadius + 8) {
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
        this.renderHoverState();
        this.emit('hover', { item: targetSlice.item, index: foundIndex, slice: targetSlice });
      }

      // 툴팁 위치는 해당 조각의 외곽 중앙 쪽으로 표시
      const tooltipRadius = targetSlice.outerRadius * 0.85;
      const tx = cx + Math.cos(targetSlice.midAngle) * tooltipRadius;
      const ty = cy + Math.sin(targetSlice.midAngle) * tooltipRadius;

      if (this.options.tooltip?.formatter) {
        this.tooltip.show(tx, ty, targetSlice.item, foundIndex);
      } else {
        // 기본 파이 차트 툴팁 (퍼센트 포함)
        this.tooltip.show(tx, ty, {
          ...targetSlice.item,
          label: `${targetSlice.item.label} (${(targetSlice.percentage * 100).toFixed(1)}%)`,
        }, foundIndex);
      }
    } else {
      if (this.hoveredIndex !== null) {
        this.hoveredIndex = null;
        this.layerManager.clear('interaction');
        this.tooltip.hide();
      }
    }
  }

  /**
   * 호버된 조각을 인터랙션 레이어에 살짝 바깥쪽으로 팝아웃(Explode)시켜 그립니다.
   */
  private renderHoverState(): void {
    this.layerManager.clear('interaction');
    if (this.hoveredIndex === null) return;

    const slice = this.slices[this.hoveredIndex];
    if (!slice) return;

    const ctx = this.layerManager.getContext('interaction');
    // 호버된 조각 팝아웃 렌더링
    this.pieSeries.drawSingleSlice(ctx, slice, true);
  }

  public update(options: Partial<PieChartOptions>): void {
    if (options.data) this.options.data = options.data;
    if (options.pie || options.labels || options.center) {
      if (options.pie) this.options.pie = { ...this.options.pie, ...options.pie };
      if (options.labels) this.options.labels = { ...this.options.labels, ...options.labels };
      if (options.center) this.options.center = { ...this.options.center, ...options.center };
      this.pieSeries = new PieSeries(this.options.pie, this.options.labels, this.options.center);
    }
    if (options.padding) this.padding = { ...this.padding, ...options.padding };

    this.render();
  }

  public destroy(): void {
    this.resizeObserver.disconnect();
    this.layerManager.destroy();
    this.tooltip.destroy();
    this.clear();
  }
}
