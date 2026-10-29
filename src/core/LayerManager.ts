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
    this.createLayer('background', 1);
    this.createLayer('series', 2);
    this.createLayer('interaction', 3);
  }

  private createLayer(type: LayerType, zIndex: number): void {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = zIndex.toString();
    canvas.style.pointerEvents = type === 'interaction' ? 'auto' : 'none';

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error(`Failed to get 2D context for layer: ${type}`);
    }

    this.canvases.set(type, canvas);
    this.contexts.set(type, ctx);
    this.container.appendChild(canvas);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dpr = window.devicePixelRatio || 1;

    for (const [type, canvas] of this.canvases.entries()) {
      canvas.width = Math.floor(width * this.dpr);
      canvas.height = Math.floor(height * this.dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = this.contexts.get(type)!;
      ctx.resetTransform();
      ctx.scale(this.dpr, this.dpr);
    }
  }

  getContext(type: LayerType): CanvasRenderingContext2D {
    return this.contexts.get(type)!;
  }

  getCanvas(type: LayerType): HTMLCanvasElement {
    return this.canvases.get(type)!;
  }

  clear(type: LayerType): void {
    const ctx = this.contexts.get(type);
    if (ctx) {
      ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  clearAll(): void {
    this.clear('background');
    this.clear('series');
    this.clear('interaction');
  }

  destroy(): void {
    for (const canvas of this.canvases.values()) {
      canvas.remove();
    }
    this.canvases.clear();
    this.contexts.clear();
  }

  getDimensions(): { width: number; height: number; dpr: number } {
    return { width: this.width, height: this.height, dpr: this.dpr };
  }
}
