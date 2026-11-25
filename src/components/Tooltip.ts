import { DataItem, TooltipEntry, TooltipOptions } from '../types';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSafeValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString() : '-';
  }
  return value == null ? '-' : escapeHtml(value);
}

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
    el.style.boxSizing = 'border-box';
    el.style.margin = '0';
    el.style.textAlign = 'left';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9999';
    el.style.padding = '8px 12px';
    el.style.backgroundColor = 'rgba(15, 23, 42, 0.92)';
    el.style.backdropFilter = 'blur(8px)';
    el.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    el.style.color = '#FFFFFF';
    el.style.borderRadius = '8px';
    el.style.fontSize = '12px';
    el.style.lineHeight = '1.4';
    el.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    el.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.25), 0 4px 6px -4px rgba(0, 0, 0, 0.15)';
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
        <div style="font-weight: 600; color: #94A3B8; margin-bottom: 2px;">${escapeHtml(item.label)}</div>
        <div style="font-size: 14px; font-weight: 700; color: #F8FAFC;">
          ${formatSafeValue(item.value)}
        </div>
      `;
    }

    this.positionTooltip(x, y);
  }

  /**
   * 다중 시리즈(Multi-Series / Stacked) 통합 툴팁 표시
   */
  showMulti(
    x: number,
    y: number,
    title: string,
    entries: TooltipEntry[],
    index: number,
    footerLabel?: string,
    footerValue?: string
  ): void {
    if (this.options?.enabled === false || entries.length === 0) return;

    if (this.options?.multiFormatter) {
      this.element.innerHTML = this.options.multiFormatter(title, entries, index);
    } else {
      const rowsHtml = entries
        .map((entry) => {
          const isBold = entry.highlighted ? '700' : '500';
          const nameColor = entry.highlighted ? '#F8FAFC' : '#CBD5E1';
          const safeColor = escapeHtml(entry.color);
          const pctStr =
            typeof entry.percentage === 'number' && Number.isFinite(entry.percentage)
              ? ` <span style="color:#94A3B8;font-size:11px;">(${entry.percentage.toFixed(1)}%)</span>`
              : '';
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:3px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${safeColor};box-shadow:${entry.highlighted ? `0 0 6px ${safeColor}` : 'none'};"></span>
                <span style="color:${nameColor};font-weight:${isBold};">${escapeHtml(entry.seriesName)}</span>
              </div>
              <div style="font-weight:700;color:#F8FAFC;">
                ${formatSafeValue(entry.value)}${pctStr}
              </div>
            </div>
          `;
        })
        .join('');

      const footerHtml =
        footerLabel && footerValue
          ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:6px;padding-top:5px;border-top:1px solid rgba(148,163,184,0.2);font-size:11px;">
               <span style="color:#94A3B8;font-weight:600;">${escapeHtml(footerLabel)}</span>
               <span style="color:#38BDF8;font-weight:700;">${escapeHtml(footerValue)}</span>
             </div>`
          : '';

      this.element.innerHTML = `
        <div style="font-weight: 600; color: #94A3B8; margin-bottom: 4px; font-size: 11px;">${escapeHtml(title)}</div>
        ${rowsHtml}
        ${footerHtml}
      `;
    }

    this.positionTooltip(x, y);
  }

  private positionTooltip(x: number, y: number): void {
    const gap = 12;
    const edgePadding = 8;
    const containerW = this.container.clientWidth || 0;
    const containerH = this.container.clientHeight || 0;
    const tipW = this.element.offsetWidth || 0;
    const tipH = this.element.offsetHeight || 0;

    // 1. 좌우 경계 클램핑 (컨테이너 좌/우 밖으로 잘림 방지)
    let clampedX = x;
    if (containerW > 0 && tipW > 0) {
      const halfW = tipW / 2;
      const minX = Math.min(containerW / 2, halfW + edgePadding);
      const maxX = Math.max(containerW / 2, containerW - halfW - edgePadding);
      clampedX = Math.max(minX, Math.min(maxX, x));
    }

    // 2. 상단 공간 부족 시 하단으로 자동 반전(Flip)
    const fitsAbove = tipH > 0 ? y - gap - tipH >= edgePadding : y >= 40;
    let top: number;
    let transformY: string;

    if (fitsAbove) {
      top = y - gap;
      transformY = '-100%';
    } else {
      const maxTop = containerH > 0 && tipH > 0 ? Math.max(edgePadding, containerH - tipH - edgePadding) : y + gap;
      top = Math.min(maxTop, y + gap);
      transformY = '0%';
    }

    this.element.style.left = `${clampedX}px`;
    this.element.style.top = `${Math.max(edgePadding, top)}px`;
    this.element.style.transform = `translate(-50%, ${transformY})`;
    this.element.style.opacity = '1';
  }

  hide(): void {
    this.element.style.opacity = '0';
  }

  destroy(): void {
    this.element.remove();
  }
}
