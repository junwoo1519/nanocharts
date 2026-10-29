/**
 * @fileoverview 멀티 레이어 캔버스 매니저 (LayerManager)
 * 
 * 성능 병목을 제거하기 위해 3개의 Canvas 엘리먼트를 CSS absolute로 겹쳐서 관리합니다.
 * 
 * [레이어 분리 구조]
 * 1. background: 배경선, Y축 눈금, X축 라벨 (뷰포트 이동 시에만 렌더)
 * 2. series: 실제 데이터 바 렌더링 (데이터 변경 시에만 렌더)
 * 3. interaction: 마우스 호버 하이라이트 (마우스 움직일 때마다 60fps로 갱신)
 * 
 * 또한 고해상도(Retina / High-DPI) 디스플레이에서 차트가 흐릿해지지 않도록
 * window.devicePixelRatio를 반영한 물리 픽셀 버퍼 스케일링을 공통 처리합니다.
 */

export type LayerType = 'background' | 'series' | 'interaction';

export class LayerManager {
  private container: HTMLElement;
  private canvases: Map<LayerType, HTMLCanvasElement> = new Map();
  private contexts: Map<LayerType, CanvasRenderingContext2D> = new Map();
  private width: number = 0;
  private height: number = 0;
  private dpr: number = 1;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.style.position = 'relative';
    this.container.style.userSelect = 'none';

    this.dpr = window.devicePixelRatio || 1;
    // z-index 순서로 3개 캔버스 생성
    this.createLayer('background', 1);
    this.createLayer('series', 2);
    this.createLayer('interaction', 3);
  }

  /**
   * 지정된 zIndex와 속성으로 Canvas 엘리먼트를 생성하여 컨테이너에 추가합니다.
   */
  private createLayer(type: LayerType, zIndex: number): void {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = zIndex.toString();
    // 최상단 인터랙션 레이어만 마우스 이벤트를 수신하도록 설정
    canvas.style.pointerEvents = type === 'interaction' ? 'auto' : 'none';

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error(`Failed to get 2D context for layer: ${type}`);
    }

    this.canvases.set(type, canvas);
    this.contexts.set(type, ctx);
    this.container.appendChild(canvas);
  }

  /**
   * 컨테이너 크기 변경 시 모든 캔버스의 버퍼 해상도와 CSS 크기를 동기화합니다.
   * High-DPI(Retina) 보정을 위해 버퍼는 (크기 * dpr)로 확장하고, 컨텍스트 좌표계는 dpr 배율로 맞춥니다.
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dpr = window.devicePixelRatio || 1;

    for (const [type, canvas] of this.canvases.entries()) {
      // 1. 실제 캔버스 내부 메모리 해상도 (물리 픽셀)
      canvas.width = Math.floor(width * this.dpr);
      canvas.height = Math.floor(height * this.dpr);

      // 2. 화면에 표시될 CSS 크기 (논리 픽셀)
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // 3. 2D 컨텍스트 좌표계를 CSS 픽셀 단위로 통일
      const ctx = this.contexts.get(type)!;
      ctx.resetTransform();
      ctx.scale(this.dpr, this.dpr);
    }
  }

  /**
   * 특정 레이어의 CanvasRenderingContext2D 객체 가져오기
   */
  getContext(type: LayerType): CanvasRenderingContext2D {
    return this.contexts.get(type)!;
  }

  /**
   * 특정 레이어의 HTMLCanvasElement 객체 가져오기
   */
  getCanvas(type: LayerType): HTMLCanvasElement {
    return this.canvases.get(type)!;
  }

  /**
   * 특정 레이어의 화면만 즉시 지우기 (clearRect)
   */
  clear(type: LayerType): void {
    const ctx = this.contexts.get(type);
    if (ctx) {
      ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  /**
   * 3개 레이어 전체 화면 지우기
   */
  clearAll(): void {
    this.clear('background');
    this.clear('series');
    this.clear('interaction');
  }

  /**
   * 모든 DOM 캔버스 제거 및 메모리 해제
   */
  destroy(): void {
    for (const canvas of this.canvases.values()) {
      canvas.remove();
    }
    this.canvases.clear();
    this.contexts.clear();
  }

  /**
   * 현재 캔버스 크기 및 DPR 반환
   */
  getDimensions(): { width: number; height: number; dpr: number } {
    return { width: this.width, height: this.height, dpr: this.dpr };
  }
}
