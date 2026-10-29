import { DataItem, TooltipOptions } from '../types';

export class Tooltip {
  private element: HTMLElement;
  private container: HTMLElement;
  private options?: TooltipOptions;

  constructor(container: HTMLElement, options?: TooltipOptions) {
    this.container = container;
    this.options = options;

    this.element = document.createElement('div');
    this.element.className = options?.className || 'canvas-chart-tooltip';
    this.applyDefaultStyles();
    this.container.appendChild(this.element);
  }

  private applyDefaultStyles(): void {
    const el = this.element;
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9999';
    el.style.padding = '8px 12px';
    el.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    el.style.backdropFilter = 'blur(6px)';
    el.style.color = '#FFFFFF';
    el.style.borderRadius = '6px';
    el.style.fontSize = '12px';
    el.style.lineHeight = '1.4';
    el.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    el.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
    el.style.transition = 'opacity 0.1s ease-out, transform 0.05s ease-out';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -100%)';
    el.style.whiteSpace = 'nowrap';
  }

  show(x: number, y: number, item: DataItem, index: number): void {
    if (this.options?.enabled === false) return;

    if (this.options?.formatter) {
      this.element.innerHTML = this.options.formatter(item, index);
    } else {
      this.element.innerHTML = `
        <div style="font-weight: 600; color: #94A3B8; margin-bottom: 2px;">${item.label}</div>
        <div style="font-size: 14px; font-weight: 700; color: #F8FAFC;">
          ${typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
        </div>
      `;
    }

    // 툴팁 위치 조정
    const offsetY = -12;
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y + offsetY}px`;
    this.element.style.opacity = '1';
  }

  hide(): void {
    this.element.style.opacity = '0';
  }

  destroy(): void {
    this.element.remove();
  }
}
