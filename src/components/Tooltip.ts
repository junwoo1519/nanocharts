import {
  DataItem,
  TooltipEntry,
  TooltipOptions,
  TooltipPlacement,
  TooltipRenderContext,
  TooltipTheme,
} from '../types';
import { resolveColor } from '../utils/tokens';

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

function toCssLength(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

interface ResolvedTooltipPalette {
  background: string;
  color: string;
  titleColor: string;
  valueColor: string;
  mutedColor: string;
  seriesNameColor: string;
  seriesNameHighlightColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: string;
  padding: string;
  shadow: string;
  backdropFilter: string;
  fontFamily: string;
  fontSize: number;
  footerDividerColor: string;
  footerValueColor: string;
}

const THEME_PRESETS: Record<TooltipTheme, ResolvedTooltipPalette> = {
  dark: {
    background: 'rgba(15, 23, 42, 0.92)',
    color: '#FFFFFF',
    titleColor: '#94A3B8',
    valueColor: '#F8FAFC',
    mutedColor: '#94A3B8',
    seriesNameColor: '#CBD5E1',
    seriesNameHighlightColor: '#F8FAFC',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: '8px',
    padding: '8px 12px',
    shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.25), 0 4px 6px -4px rgba(0, 0, 0, 0.15)',
    backdropFilter: 'blur(8px)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 12,
    footerDividerColor: 'rgba(148, 163, 184, 0.2)',
    footerValueColor: '#38BDF8',
  },
  light: {
    background: 'rgba(255, 255, 255, 0.96)',
    color: '#0F172A',
    titleColor: '#64748B',
    valueColor: '#0F172A',
    mutedColor: '#64748B',
    seriesNameColor: '#475569',
    seriesNameHighlightColor: '#0F172A',
    borderColor: 'rgba(15, 23, 42, 0.1)',
    borderWidth: 1,
    borderRadius: '8px',
    padding: '8px 12px',
    shadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 4px 10px -4px rgba(15, 23, 42, 0.08)',
    backdropFilter: 'blur(8px)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 12,
    footerDividerColor: 'rgba(15, 23, 42, 0.08)',
    footerValueColor: '#2563EB',
  },
};

export class Tooltip {
  private element: HTMLElement;
  private contentEl: HTMLElement;
  private arrowEl: HTMLElement;
  private container: HTMLElement;
  private options?: TooltipOptions;
  private palette: ResolvedTooltipPalette = THEME_PRESETS.dark;
  private isVisible: boolean = false;

  constructor(container: HTMLElement, options?: TooltipOptions) {
    this.container = container;
    this.options = options;

    this.element = document.createElement('div');
    this.contentEl = document.createElement('div');
    this.contentEl.style.position = 'relative';
    this.contentEl.style.zIndex = '1';

    this.arrowEl = document.createElement('div');
    this.arrowEl.setAttribute('aria-hidden', 'true');

    this.element.appendChild(this.contentEl);
    this.element.appendChild(this.arrowEl);

    this.element.addEventListener('mouseleave', (e: MouseEvent) => {
      if (this.options?.interactive && !this.container.contains(e.relatedTarget as Node | null)) {
        this.hide();
      }
    });

    this.applyStyles();
    this.container.appendChild(this.element);
  }

  /**
   * 툴팁이 인터랙티브 모드(`interactive: true`)인지 여부를 반환합니다.
   */
  public isInteractive(): boolean {
    return this.options?.interactive === true;
  }

  /**
   * 전달된 이벤트 타겟이 툴팁 DOM 내부에 포함되어 있는지 확인합니다.
   */
  public contains(target: EventTarget | null): boolean {
    return Boolean(target && typeof Node !== 'undefined' && target instanceof Node && this.element.contains(target));
  }

  /**
   * 런타임에 툴팁 옵션(테마, 스타일, 포맷터, 배치 등)을 동적으로 갱신합니다.
   */
  public updateOptions(options?: TooltipOptions): void {
    this.options = options;
    this.applyStyles();
    if (options?.enabled === false) {
      this.hide();
    }
  }

  private resolvePalette(): ResolvedTooltipPalette {
    const theme: TooltipTheme = this.options?.theme === 'light' ? 'light' : 'dark';
    const base = THEME_PRESETS[theme];
    const custom = this.options?.style;
    if (!custom) return base;

    const background = custom.background ? resolveColor(custom.background, this.container) : base.background;
    const color = custom.color ? resolveColor(custom.color, this.container) : base.color;
    const titleColor = custom.titleColor ? resolveColor(custom.titleColor, this.container) : base.titleColor;
    const valueColor = custom.valueColor
      ? resolveColor(custom.valueColor, this.container)
      : custom.color
        ? color
        : base.valueColor;
    const mutedColor = custom.mutedColor ? resolveColor(custom.mutedColor, this.container) : base.mutedColor;
    const borderColor = custom.borderColor ? resolveColor(custom.borderColor, this.container) : base.borderColor;

    return {
      ...base,
      background,
      color,
      titleColor,
      valueColor,
      mutedColor,
      seriesNameColor: custom.color ? color : base.seriesNameColor,
      seriesNameHighlightColor: custom.valueColor ? valueColor : custom.color ? color : base.seriesNameHighlightColor,
      borderColor,
      borderWidth: custom.borderWidth ?? base.borderWidth,
      borderRadius: toCssLength(custom.borderRadius) ?? base.borderRadius,
      padding: toCssLength(custom.padding) ?? base.padding,
      shadow: custom.shadow ?? base.shadow,
      backdropFilter: custom.backdropFilter ?? base.backdropFilter,
      fontFamily: custom.fontFamily ?? base.fontFamily,
      fontSize: custom.fontSize ?? base.fontSize,
    };
  }

  private applyStyles(): void {
    const el = this.element;
    const opts = this.options;
    const custom = opts?.style;
    const isHeadless = typeof opts?.render === 'function';
    const isUnstyled = opts?.unstyled === true;

    this.palette = this.resolvePalette();
    el.className = opts?.className
      ? opts.className.includes('canvas-chart-tooltip')
        ? opts.className
        : `canvas-chart-tooltip ${opts.className}`
      : 'canvas-chart-tooltip';
    el.setAttribute('data-theme', opts?.theme === 'light' ? 'light' : 'dark');

    // 기존 인라인 스타일 초기화 후 재적용 (updateOptions 및 unstyled 전환 대응)
    el.style.cssText = '';
    el.style.boxSizing = 'border-box';
    el.style.position = 'absolute';
    el.style.pointerEvents = opts?.interactive ? 'auto' : 'none';
    el.style.zIndex = String(custom?.zIndex ?? 9999);
    el.style.opacity = this.isVisible && !isHeadless ? '1' : '0';
    el.style.display = isHeadless ? 'none' : '';

    if (!isUnstyled) {
      const p = this.palette;
      el.style.margin = '0';
      el.style.textAlign = 'left';
      el.style.padding = p.padding;
      el.style.backgroundColor = p.background;
      el.style.backdropFilter = p.backdropFilter;
      el.style.border = p.borderWidth > 0 ? `${p.borderWidth}px solid ${p.borderColor}` : 'none';
      el.style.color = p.color;
      el.style.borderRadius = p.borderRadius;
      el.style.fontSize = `${p.fontSize}px`;
      el.style.lineHeight = '1.4';
      el.style.fontFamily = p.fontFamily;
      el.style.boxShadow = p.shadow;
      el.style.transition = 'opacity 0.1s ease-out, transform 0.05s ease-out';

      const maxW = toCssLength(custom?.maxWidth);
      const minW = toCssLength(custom?.minWidth);
      if (maxW) {
        el.style.maxWidth = maxW;
        el.style.whiteSpace = 'normal';
        el.style.wordBreak = 'break-word';
      } else {
        el.style.whiteSpace = 'nowrap';
      }
      if (minW) {
        el.style.minWidth = minW;
      }
    }

    this.applyArrowBaseStyles();
  }

  private applyArrowBaseStyles(): void {
    const showArrow = this.options?.arrow === true && this.options?.unstyled !== true;
    const arrow = this.arrowEl;
    arrow.style.cssText = '';

    if (!showArrow) {
      arrow.style.display = 'none';
      return;
    }

    const p = this.palette;
    arrow.style.position = 'absolute';
    arrow.style.width = '8px';
    arrow.style.height = '8px';
    arrow.style.backgroundColor = p.background;
    arrow.style.transform = 'rotate(45deg)';
    arrow.style.pointerEvents = 'none';
    arrow.style.zIndex = '0';
  }

  private setContent(content: string | HTMLElement): void {
    if (typeof content === 'string') {
      this.contentEl.innerHTML = content;
    } else if (typeof HTMLElement !== 'undefined' && content instanceof HTMLElement) {
      this.contentEl.innerHTML = '';
      this.contentEl.appendChild(content);
    } else {
      this.contentEl.textContent = String(content ?? '');
    }
  }

  private formatTitle(title: string, index: number, item?: DataItem): string {
    if (this.options?.titleFormatter) {
      return escapeHtml(this.options.titleFormatter(title, index, item));
    }
    return escapeHtml(title);
  }

  private formatValue(value: number, item: DataItem, seriesName?: string): string {
    if (this.options?.valueFormatter) {
      return escapeHtml(this.options.valueFormatter(value, item, seriesName));
    }
    return formatSafeValue(value);
  }

  show(x: number, y: number, item: DataItem, index: number): void {
    if (this.options?.enabled === false) return;

    this.isVisible = true;

    if (typeof this.options?.render === 'function') {
      const context: TooltipRenderContext = {
        mode: 'single',
        x,
        y,
        title: item.label,
        index,
        item,
        element: this.element,
        container: this.container,
      };
      this.options.render(context);
      return;
    }

    if (this.options?.formatter) {
      this.setContent(this.options.formatter(item, index));
    } else {
      const p = this.palette;
      const titleHtml = this.formatTitle(item.label, index, item);
      const valueHtml = this.formatValue(item.value, item);
      this.setContent(`
        <div style="font-weight: 600; color: ${p.titleColor}; margin-bottom: 2px;">${titleHtml}</div>
        <div style="font-size: ${Math.max(12, p.fontSize + 2)}px; font-weight: 700; color: ${p.valueColor};">
          ${valueHtml}
        </div>
      `);
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

    this.isVisible = true;

    if (typeof this.options?.render === 'function') {
      const context: TooltipRenderContext = {
        mode: 'multi',
        x,
        y,
        title,
        index,
        entries,
        footerLabel,
        footerValue,
        element: this.element,
        container: this.container,
      };
      this.options.render(context);
      return;
    }

    if (this.options?.multiFormatter) {
      this.setContent(this.options.multiFormatter(title, entries, index));
    } else {
      const p = this.palette;
      const titleHtml = this.formatTitle(title, index);
      const rowsHtml = entries
        .map((entry) => {
          const isBold = entry.highlighted ? '700' : '500';
          const nameColor = entry.highlighted ? p.seriesNameHighlightColor : p.seriesNameColor;
          const safeColor = escapeHtml(entry.color);
          const pctStr =
            typeof entry.percentage === 'number' && Number.isFinite(entry.percentage)
              ? ` <span style="color:${p.mutedColor};font-size:${Math.max(10, p.fontSize - 1)}px;">(${entry.percentage.toFixed(1)}%)</span>`
              : '';
          const valueStr = this.formatValue(entry.value, entry.item, entry.seriesName);
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:3px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${safeColor};box-shadow:${entry.highlighted ? `0 0 6px ${safeColor}` : 'none'};"></span>
                <span style="color:${nameColor};font-weight:${isBold};">${escapeHtml(entry.seriesName)}</span>
              </div>
              <div style="font-weight:700;color:${p.valueColor};">
                ${valueStr}${pctStr}
              </div>
            </div>
          `;
        })
        .join('');

      const footerHtml =
        footerLabel && footerValue
          ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:6px;padding-top:5px;border-top:1px solid ${p.footerDividerColor};font-size:${Math.max(10, p.fontSize - 1)}px;">
               <span style="color:${p.mutedColor};font-weight:600;">${escapeHtml(footerLabel)}</span>
               <span style="color:${p.footerValueColor};font-weight:700;">${escapeHtml(footerValue)}</span>
             </div>`
          : '';

      this.setContent(`
        <div style="font-weight: 600; color: ${p.titleColor}; margin-bottom: 4px; font-size: ${Math.max(10, p.fontSize - 1)}px;">${titleHtml}</div>
        ${rowsHtml}
        ${footerHtml}
      `);
    }

    this.positionTooltip(x, y);
  }

  private positionTooltip(x: number, y: number): void {
    const gap = this.options?.offset ?? 12;
    const edgePadding = 8;
    const containerW = this.container.clientWidth || 0;
    const containerH = this.container.clientHeight || 0;
    const tipW = this.element.offsetWidth || 0;
    const tipH = this.element.offsetHeight || 0;

    const requested: TooltipPlacement = this.options?.placement ?? 'auto';
    let resolved: 'top' | 'bottom' | 'left' | 'right';

    if (requested === 'auto') {
      const fitsAbove = tipH > 0 ? y - gap - tipH >= edgePadding : y >= 40;
      resolved = fitsAbove ? 'top' : 'bottom';
    } else if (requested === 'top') {
      resolved = 'top';
    } else if (requested === 'bottom') {
      resolved = 'bottom';
    } else if (requested === 'left') {
      const fitsLeft = tipW > 0 ? x - gap - tipW >= edgePadding : x >= 80;
      resolved = fitsLeft ? 'left' : 'right';
    } else {
      const fitsRight = containerW > 0 && tipW > 0 ? x + gap + tipW <= containerW - edgePadding : true;
      resolved = fitsRight ? 'right' : 'left';
    }

    let leftPx = x;
    let topPx = y;
    let transformStr = 'translate(-50%, -100%)';

    if (resolved === 'top' || resolved === 'bottom') {
      if (containerW > 0 && tipW > 0) {
        const halfW = tipW / 2;
        const minX = Math.min(containerW / 2, halfW + edgePadding);
        const maxX = Math.max(containerW / 2, containerW - halfW - edgePadding);
        leftPx = Math.max(minX, Math.min(maxX, x));
      }

      if (resolved === 'top') {
        topPx = Math.max(edgePadding, y - gap);
        transformStr = 'translate(-50%, -100%)';
      } else {
        const maxTop =
          containerH > 0 && tipH > 0 ? Math.max(edgePadding, containerH - tipH - edgePadding) : y + gap;
        topPx = Math.max(edgePadding, Math.min(maxTop, y + gap));
        transformStr = 'translate(-50%, 0%)';
      }
    } else {
      if (containerH > 0 && tipH > 0) {
        const halfH = tipH / 2;
        const minY = Math.min(containerH / 2, halfH + edgePadding);
        const maxY = Math.max(containerH / 2, containerH - halfH - edgePadding);
        topPx = Math.max(minY, Math.min(maxY, y));
      }

      if (resolved === 'left') {
        const minLeft = tipW > 0 ? tipW + edgePadding : edgePadding;
        leftPx = Math.max(minLeft, x - gap);
        transformStr = 'translate(-100%, -50%)';
      } else {
        const maxLeft =
          containerW > 0 && tipW > 0 ? Math.max(edgePadding, containerW - tipW - edgePadding) : x + gap;
        leftPx = Math.max(edgePadding, Math.min(maxLeft, x + gap));
        transformStr = 'translate(0%, -50%)';
      }
    }

    this.element.setAttribute('data-placement', resolved);
    this.element.style.left = `${leftPx}px`;
    this.element.style.top = `${topPx}px`;
    this.element.style.transform = transformStr;
    this.element.style.opacity = '1';

    this.positionArrow(resolved, x, y, leftPx, topPx, tipW, tipH);
  }

  private positionArrow(
    placement: 'top' | 'bottom' | 'left' | 'right',
    anchorX: number,
    anchorY: number,
    leftPx: number,
    topPx: number,
    tipW: number,
    tipH: number
  ): void {
    if (this.options?.arrow !== true || this.options?.unstyled === true) return;

    const arrow = this.arrowEl;
    const p = this.palette;
    const borderSpec = p.borderWidth > 0 ? `${p.borderWidth}px solid ${p.borderColor}` : 'none';

    arrow.style.top = '';
    arrow.style.bottom = '';
    arrow.style.left = '';
    arrow.style.right = '';
    arrow.style.borderTop = 'none';
    arrow.style.borderRight = 'none';
    arrow.style.borderBottom = 'none';
    arrow.style.borderLeft = 'none';

    if (placement === 'top' || placement === 'bottom') {
      const tipLeftEdge = leftPx - tipW / 2;
      const relX = tipW > 0 ? Math.max(10, Math.min(tipW - 10, anchorX - tipLeftEdge)) : 0;
      arrow.style.left = tipW > 0 ? `${relX - 4}px` : 'calc(50% - 4px)';

      if (placement === 'top') {
        arrow.style.bottom = '-4px';
        arrow.style.borderRight = borderSpec;
        arrow.style.borderBottom = borderSpec;
      } else {
        arrow.style.top = '-4px';
        arrow.style.borderTop = borderSpec;
        arrow.style.borderLeft = borderSpec;
      }
    } else {
      const tipTopEdge = topPx - tipH / 2;
      const relY = tipH > 0 ? Math.max(10, Math.min(tipH - 10, anchorY - tipTopEdge)) : 0;
      arrow.style.top = tipH > 0 ? `${relY - 4}px` : 'calc(50% - 4px)';

      if (placement === 'left') {
        arrow.style.right = '-4px';
        arrow.style.borderTop = borderSpec;
        arrow.style.borderRight = borderSpec;
      } else {
        arrow.style.left = '-4px';
        arrow.style.borderBottom = borderSpec;
        arrow.style.borderLeft = borderSpec;
      }
    }
  }

  hide(): void {
    if (this.isVisible && typeof this.options?.render === 'function') {
      this.options.onHide?.();
    }
    this.isVisible = false;
    this.element.style.opacity = '0';
  }

  destroy(): void {
    this.hide();
    this.element.remove();
  }
}
