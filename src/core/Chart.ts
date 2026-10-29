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
  /** 차트가 마운트될 부모 DOM 엘리먼트 */
  private container: HTMLElement;
  /** 사용자 설정 옵션 객체 */
  private options: BarChartOptions;
  /** 3중 캔버스 레이어 관리자 */
  private layerManager: LayerManager;
  /** 부동형 툴팁 컴포넌트 */
  private tooltip: Tooltip;
  /** 바 렌더링 시리즈 모듈 */
  private barSeries: BarSeries;

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
  /** 현재 마우스가 올라가 있는 데이터 항목 인덱스 */
  private hoveredIndex: number | null = null;

  // 드래그 팬(Pan) 내부 상태 변수
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartView: [number, number] = [0, 0];

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

    this.xScale = new BandScale();
    this.yScale = new LinearScale();

    this.initScales();
    this.setupInteractions();

    // 부모 컨테이너 크기 변화를 실시간 감지하여 자동 리사이징 & 리렌더링
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

  /**
   * 데이터 기반으로 X/Y 스케일의 도메인을 초기화합니다.
   */
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

    // 플롯 영역 내부 픽셀 범위 동기화
    const plotLeft = this.padding.left;
    const plotRight = width - this.padding.right;
    const plotTop = this.padding.top;
    const plotBottom = height - this.padding.bottom;

    this.xScale.range([plotLeft, plotRight]);
    // Canvas의 Y축은 아래로 갈수록 커지므로 위아래를 반전시킵니다.
    this.yScale.range([plotBottom, plotTop]);

    this.render();
  }

  /**
   * 차트의 모든 레이어(Background, Series, Interaction)를 순차적으로 렌더링합니다.
   */
  public render(): void {
    if (this.width <= 0 || this.height <= 0) return;

    // 1. Background 레이어: 격자선 및 축 렌더링
    const bgCtx = this.layerManager.getContext('background');
    this.layerManager.clear('background');
    Grid.render(bgCtx, this.options.grid, this.yScale, this.width, this.padding);
    Axis.renderYAxis(bgCtx, this.options.yAxis, this.yScale, this.padding);
    Axis.renderXAxis(bgCtx, this.options.xAxis, this.xScale, this.options.data, this.height, this.padding);

    // 2. Series 레이어: 바(Bar) 데이터 렌더링
    const seriesCtx = this.layerManager.getContext('series');
    this.layerManager.clear('series');
    this.barSeries.render(seriesCtx, this.options.data, this.xScale, this.yScale);

    // 3. Interaction 레이어: 호버 하이라이트 갱신
    this.renderHoverState();
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

  /**
   * 마우스 위치로부터 O(1)로 호버 대상을 찾아내고 하이라이트 및 툴팁을 표시합니다.
   */
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

    // O(1) 초고속 인덱스 역산!
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

    // 마우스가 바의 가로 폭 안에 위치하는지 판정
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

  /**
   * 호버된 바 1개만 인터랙션 레이어에 하이라이트 렌더링
   */
  private renderHoverState(specificGeom?: BarGeometry): void {
    this.layerManager.clear('interaction');
    if (this.hoveredIndex === null) return;

    const item = this.options.data[this.hoveredIndex];
    if (!item) return;

    const geom = specificGeom || this.barSeries.getBarGeometry(item, this.hoveredIndex, this.xScale, this.yScale);
    const ctx = this.layerManager.getContext('interaction');
    this.barSeries.renderHighlight(ctx, geom);
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
    const totalCount = this.options.data.length;

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
    const totalCount = this.options.data.length;

    // 휠 아래: 줌아웃(1.15배 확대), 휠 위: 줌인(0.85배 축소)
    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
    let newCount = Math.round(currentCount * zoomFactor);
    newCount = Math.max(minPoints, Math.min(totalCount, newCount));

    if (newCount === currentCount) return;

    // 마우스 커서의 상대적 위치 비율을 계산하여 커서 위치 중심으로 줌
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
   * 런타임에 차트의 데이터 및 옵션을 동적으로 갱신하고 다시 그립니다.
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
   * 줌/팬 상태를 초기화하여 전체 데이터를 한 화면에 표시합니다.
   */
  public resetZoom(): void {
    this.xScale.setViewport(0, this.options.data.length - 1);
    this.render();
  }

  /**
   * 차트 인스턴스를 파괴하고 ResizeObserver 및 DOM 캔버스 자원을 해제합니다.
   */
  public destroy(): void {
    this.resizeObserver.disconnect();
    this.layerManager.destroy();
    this.tooltip.destroy();
    this.clear();
  }
}
