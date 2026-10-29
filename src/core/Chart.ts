import type {
  BarChartOptions,
  Padding,
} from '../types';
import { LayerManager } from './LayerManager';
import { EventEmitter } from './EventEmitter';
import { LinearScale } from '../scale/LinearScale';
import { BandScale } from '../scale/BandScale';
import { Grid } from '../components/Grid';
import { Axis } from '../components/Axis';
import { Tooltip } from '../components/Tooltip';
import { BarSeries, BarGeometry } from '../series/BarSeries';

export class BarChart extends EventEmitter {
  private container: HTMLElement;
  private options: BarChartOptions;
  private layerManager: LayerManager;
  private tooltip: Tooltip;
  private barSeries: BarSeries;

  private xScale: BandScale;
  private yScale: LinearScale;

  private width: number = 0;
  private height: number = 0;
  private padding: Padding;

  private resizeObserver: ResizeObserver;
  private hoveredIndex: number | null = null;

  // 드래그 팬(Pan) 상태
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartView: [number, number] = [0, 0];

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

    this.xScale = new BandScale();
    this.yScale = new LinearScale();

    this.initScales();
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

  private initScales(): void {
    const data = this.options.data || [];
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

    // Y축은 0에서 maxVal(양수인 경우) 또는 minVal ~ maxVal
    const yMin = minVal < 0 ? minVal : 0;
    const yMax = maxVal > 0 ? maxVal * 1.1 : 0; // 상단 여유 10%
    this.yScale.domain([yMin, yMax]).nice(5);
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    this.layerManager.resize(width, height);

    // 스케일 범위 업데이트
    const plotLeft = this.padding.left;
    const plotRight = width - this.padding.right;
    const plotTop = this.padding.top;
    const plotBottom = height - this.padding.bottom;

    this.xScale.range([plotLeft, plotRight]);
    this.yScale.range([plotBottom, plotTop]); // Canvas Y는 아래가 큰 값이므로 반전

    this.render();
  }

  public render(): void {
    if (this.width <= 0 || this.height <= 0) return;

    // 1. Background & Grid & Axis 레이어 렌더링
    const bgCtx = this.layerManager.getContext('background');
    this.layerManager.clear('background');
    Grid.render(bgCtx, this.options.grid, this.yScale, this.width, this.padding);
    Axis.renderYAxis(bgCtx, this.options.yAxis, this.yScale, this.padding);
    Axis.renderXAxis(bgCtx, this.options.xAxis, this.xScale, this.options.data, this.height, this.padding);

    // 2. Series (Data) 레이어 렌더링
    const seriesCtx = this.layerManager.getContext('series');
    this.layerManager.clear('series');
    this.barSeries.render(seriesCtx, this.options.data, this.xScale, this.yScale);

    // 3. Interaction 레이어 갱신
    this.renderHoverState();
  }

  private setupInteractions(): void {
    const interactionCanvas = this.layerManager.getCanvas('interaction');

    // 마우스 이동 (호버 & 툴팁)
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
      this.layerManager.clear('interaction');
      this.tooltip.hide();
      this.isDragging = false;
    });

    // 드래그 팬 (Pan)
    if (this.options.pan?.enabled !== false) {
      interactionCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // 좌클릭만
        this.isDragging = true;
        const rect = interactionCanvas.getBoundingClientRect();
        this.dragStartX = e.clientX - rect.left;
        this.dragStartView = this.xScale.getViewport();
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });
    }

    // 마우스 휠 줌 (Zoom)
    if (this.options.zoom?.enabled !== false) {
      interactionCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.handleZoom(e);
      }, { passive: false });
    }
  }

  private handleHover(mouseX: number, mouseY: number): void {
    const plotTop = this.padding.top;
    const plotBottom = this.height - this.padding.bottom;
    const plotLeft = this.padding.left;
    const plotRight = this.width - this.padding.right;

    // 플롯 영역 밖이면 호버 해제
    if (mouseX < plotLeft || mouseX > plotRight || mouseY < plotTop || mouseY > plotBottom) {
      if (this.hoveredIndex !== null) {
        this.hoveredIndex = null;
        this.layerManager.clear('interaction');
        this.tooltip.hide();
      }
      return;
    }

    // O(1) 인덱스 역산!
    const index = this.xScale.invert(mouseX);
    const item = this.options.data[index];

    if (!item) {
      if (this.hoveredIndex !== null) {
        this.hoveredIndex = null;
        this.layerManager.clear('interaction');
        this.tooltip.hide();
      }
      return;
    }

    const geom = this.barSeries.getBarGeometry(item, index, this.xScale, this.yScale);

    // 마우스가 바의 가로 범위 안에 있는지 검사
    const isInsideBarX = mouseX >= geom.x && mouseX <= geom.x + geom.width;
    if (isInsideBarX) {
      if (this.hoveredIndex !== index) {
        this.hoveredIndex = index;
        this.renderHoverState(geom);
        this.emit('hover', { item, index, geometry: geom });
      }
      this.tooltip.show(geom.x + geom.width / 2, geom.y, item, index);
    } else {
      if (this.hoveredIndex !== null) {
        this.hoveredIndex = null;
        this.layerManager.clear('interaction');
        this.tooltip.hide();
      }
    }
  }

  private renderHoverState(specificGeom?: BarGeometry): void {
    this.layerManager.clear('interaction');
    if (this.hoveredIndex === null) return;

    const item = this.options.data[this.hoveredIndex];
    if (!item) return;

    const geom = specificGeom || this.barSeries.getBarGeometry(item, this.hoveredIndex, this.xScale, this.yScale);
    const ctx = this.layerManager.getContext('interaction');
    this.barSeries.renderHighlight(ctx, geom);
  }

  private handlePan(currentMouseX: number): void {
    const deltaX = currentMouseX - this.dragStartX;
    const step = this.xScale.step();
    if (step <= 0) return;

    const deltaIndex = Math.round(-deltaX / step);
    const [origStart, origEnd] = this.dragStartView;
    const visibleCount = origEnd - origStart;
    const totalCount = this.options.data.length;

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

  private handleZoom(e: WheelEvent): void {
    const [start, end] = this.xScale.getViewport();
    const currentCount = end - start + 1;
    const minPoints = this.options.zoom?.minPoints ?? 5;
    const totalCount = this.options.data.length;

    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85; // 아래 휠: 줌아웃, 위 휠: 줌인
    let newCount = Math.round(currentCount * zoomFactor);
    newCount = Math.max(minPoints, Math.min(totalCount, newCount));

    if (newCount === currentCount) return;

    // 마우스 위치를 중심으로 줌 확대/축소
    const rect = this.layerManager.getCanvas('interaction').getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseRatio = Math.max(0, Math.min(1, (mouseX - this.padding.left) / (this.width - this.padding.left - this.padding.right)));

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
   * 데이터 및 옵션 업데이트
   */
  public update(options: Partial<BarChartOptions>): void {
    if (options.data) {
      this.options.data = options.data;
      this.initScales();
    }
    if (options.bar || options.labels) {
      if (options.bar) this.options.bar = { ...this.options.bar, ...options.bar };
      if (options.labels) this.options.labels = { ...this.options.labels, ...options.labels };
      this.barSeries = new BarSeries(this.options.bar, this.options.labels);
    }
    if (options.padding) {
      this.padding = { ...this.padding, ...options.padding };
    }
    if (options.grid) this.options.grid = options.grid;
    if (options.xAxis) this.options.xAxis = options.xAxis;
    if (options.yAxis) this.options.yAxis = options.yAxis;

    const plotLeft = this.padding.left;
    const plotRight = this.width - this.padding.right;
    const plotTop = this.padding.top;
    const plotBottom = this.height - this.padding.bottom;
    this.xScale.range([plotLeft, plotRight]);
    this.yScale.range([plotBottom, plotTop]);

    this.render();
  }

  /**
   * 뷰포트 초기화 (전체 보기)
   */
  public resetZoom(): void {
    this.xScale.setViewport(0, this.options.data.length - 1);
    this.render();
  }

  public destroy(): void {
    this.resizeObserver.disconnect();
    this.layerManager.destroy();
    this.tooltip.destroy();
    this.clear();
  }
}
