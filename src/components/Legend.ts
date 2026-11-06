/**
 * @fileoverview 범례(Legend) 컴포넌트 (Legend)
 * 
 * 차트 상/하/좌/우에 배치되어 각 데이터 항목 또는 카테고리의 색상과 라벨을 표시하고,
 * 클릭 시 해당 데이터 그룹을 활성/비활성(Toggle)하거나 호버 시 하이라이트를 연동합니다.
 */

import type {
  LegendItem,
  LegendOptions,
  LegendPosition,
  LegendAlign,
  LegendMarkerShape,
  Padding,
} from '../types';

export interface LegendCallbacks {
  /** 범례 항목 클릭으로 활성 상태가 변경되었을 때 호출 */
  onToggle?: (item: LegendItem, active: boolean, hiddenKeys: Set<string>) => void;
  /** 범례 항목에 마우스를 올리거나 뗐을 때 호출 */
  onHover?: (item: LegendItem | null) => void;
}

export class Legend {
  private container: HTMLElement;
  private rootEl: HTMLElement;
  private options: LegendOptions;
  private visible: boolean;
  private items: LegendItem[] = [];
  private hiddenKeys: Set<string> = new Set();
  private hoveredKey: string | null = null;
  private itemElements: Map<string, { btn: HTMLElement; marker: HTMLElement; text: HTMLElement }> = new Map();
  private callbacks: LegendCallbacks;

  /**
   * Legend 인스턴스를 생성합니다.
   * 
   * @param container 차트가 마운트된 부모 컨테이너 엘리먼트
   * @param options 범례 설정 옵션 (`boolean` 또는 `LegendOptions`)
   * @param callbacks 차트 본체와 연동할 토글/호버 콜백
   * @param defaultVisible 옵션이 명시되지 않았을 때의 기본 표시 여부
   */
  constructor(
    container: HTMLElement,
    options?: boolean | LegendOptions,
    callbacks: LegendCallbacks = {},
    defaultVisible: boolean = false
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.options = this.normalizeOptions(options, defaultVisible);
    this.visible = this.options.visible ?? defaultVisible;

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'nanocharts-legend';
    this.applyRootStyles();
    this.container.appendChild(this.rootEl);
  }

  private normalizeOptions(
    options?: boolean | LegendOptions,
    defaultVisible: boolean = false
  ): LegendOptions {
    if (typeof options === 'boolean') {
      return {
        visible: options,
        position: 'top',
        align: 'end',
        markerShape: 'rounded',
        interactive: true,
        fontSize: 12,
        textColor: '#E2E8F0',
        inactiveColor: '#64748B',
        maxItems: 12,
      };
    }

    return {
      visible: options?.visible ?? (options !== undefined ? true : defaultVisible),
      position: options?.position ?? 'top',
      align: options?.align ?? 'end',
      markerShape: options?.markerShape ?? 'rounded',
      interactive: options?.interactive ?? true,
      fontSize: options?.fontSize ?? 12,
      textColor: options?.textColor ?? '#E2E8F0',
      inactiveColor: options?.inactiveColor ?? '#64748B',
      maxItems: options?.maxItems ?? 12,
      items: options?.items,
      formatter: options?.formatter,
      onClick: options?.onClick,
      onHover: options?.onHover,
    };
  }

  /**
   * 범례 컨테이너의 위치 및 레이아웃 CSS 스타일을 적용합니다.
   */
  private applyRootStyles(): void {
    const el = this.rootEl;
    const pos: LegendPosition = this.options.position ?? 'top';
    const align: LegendAlign = this.options.align ?? 'end';

    el.style.position = 'absolute';
    el.style.zIndex = '10';
    el.style.display = this.visible && this.items.length > 0 ? 'flex' : 'none';
    el.style.flexWrap = 'wrap';
    el.style.gap = '6px 12px';
    el.style.pointerEvents = 'auto';
    el.style.userSelect = 'none';
    el.style.fontFamily = "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    // 초기화
    el.style.top = '';
    el.style.bottom = '';
    el.style.left = '';
    el.style.right = '';
    el.style.flexDirection = 'row';
    el.style.maxWidth = '';
    el.style.maxHeight = '';

    const justifyMap: Record<LegendAlign, string> = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
    };

    if (pos === 'top' || pos === 'bottom') {
      el.style.left = '16px';
      el.style.right = '16px';
      el.style.justifyContent = justifyMap[align];
      el.style.alignItems = 'center';
      if (pos === 'top') {
        el.style.top = '6px';
      } else {
        el.style.bottom = '6px';
      }
    } else {
      el.style.top = '16px';
      el.style.bottom = '16px';
      el.style.flexDirection = 'column';
      el.style.justifyContent = justifyMap[align];
      el.style.alignItems = 'flex-start';
      el.style.maxWidth = '140px';
      if (pos === 'left') {
        el.style.left = '8px';
      } else {
        el.style.right = '8px';
      }
    }
  }

  /**
   * 범례가 활성화되어 있을 때 차트 플롯 영역이 겹치지 않도록 확보해야 할 추가 여백(Padding)을 반환합니다.
   */
  public getReservedPadding(): Partial<Padding> {
    if (!this.visible || this.items.length === 0) {
      return {};
    }

    const pos: LegendPosition = this.options.position ?? 'top';
    switch (pos) {
      case 'top':
        return { top: 28 };
      case 'bottom':
        return { bottom: 30 };
      case 'left':
        return { left: 120 };
      case 'right':
        return { right: 120 };
    }
  }

  /**
   * 범례 표시 여부를 반환합니다.
   */
  public isVisible(): boolean {
    return this.visible;
  }

  /**
   * 특정 범례 키가 현재 활성화(표시) 상태인지 확인합니다.
   */
  public isKeyActive(key: string): boolean {
    return !this.hiddenKeys.has(key);
  }

  /**
   * 현재 비활성화(숨김) 처리된 모든 범례 키 집합을 반환합니다.
   */
  public getHiddenKeys(): Set<string> {
    return this.hiddenKeys;
  }

  /**
   * 모든 숨김 상태를 초기화하여 전체 데이터를 다시 활성화합니다.
   */
  public resetHidden(): void {
    this.hiddenKeys.clear();
    this.syncItemStyles();
  }

  /**
   * 범례 옵션을 동적으로 업데이트합니다.
   */
  public updateOptions(options?: boolean | LegendOptions, defaultVisible: boolean = false): void {
    this.options = this.normalizeOptions(options, defaultVisible);
    this.visible = this.options.visible ?? defaultVisible;
    this.applyRootStyles();
    this.renderItems();
  }

  /**
   * 범례 아이템 목록을 설정하고 DOM을 렌더링합니다.
   */
  public setItems(items: LegendItem[]): void {
    const maxItems = this.options.maxItems ?? 12;
    this.items = (this.options.items ?? items).slice(0, maxItems).map((item) => ({
      ...item,
      active: !this.hiddenKeys.has(item.key),
    }));

    this.applyRootStyles();
    this.renderItems();
  }

  /**
   * 캔버스 상의 호버와 동기화하여 특정 범례 아이템을 강조 표시합니다.
   */
  public setHoveredKey(key: string | null): void {
    if (this.hoveredKey === key) return;
    this.hoveredKey = key;
    this.syncItemStyles();
  }

  /**
   * 범례 항목 DOM 엘리먼트들을 생성하고 이벤트를 연결합니다.
   */
  private renderItems(): void {
    this.rootEl.innerHTML = '';
    this.itemElements.clear();

    if (!this.visible || this.items.length === 0) {
      this.rootEl.style.display = 'none';
      return;
    }

    this.rootEl.style.display = 'flex';
    const interactive = this.options.interactive !== false;
    const fontSize = this.options.fontSize ?? 12;
    const shape: LegendMarkerShape = this.options.markerShape ?? 'rounded';

    for (const item of this.items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '6px';
      btn.style.background = 'transparent';
      btn.style.border = 'none';
      btn.style.padding = '3px 7px';
      btn.style.borderRadius = '6px';
      btn.style.cursor = interactive ? 'pointer' : 'default';
      btn.style.fontSize = `${fontSize}px`;
      btn.style.fontWeight = '500';
      btn.style.lineHeight = '1.2';
      btn.style.fontFamily = 'inherit';
      btn.style.transition = 'all 0.15s ease';

      const marker = document.createElement('span');
      marker.style.display = 'inline-block';
      marker.style.flexShrink = '0';
      marker.style.transition = 'transform 0.15s ease, background-color 0.15s ease';

      if (shape === 'line') {
        marker.style.width = '12px';
        marker.style.height = '3px';
        marker.style.borderRadius = '2px';
      } else {
        marker.style.width = '10px';
        marker.style.height = '10px';
        marker.style.borderRadius =
          shape === 'circle' ? '50%' : shape === 'rounded' ? '3px' : '0px';
      }

      const text = document.createElement('span');
      text.style.transition = 'color 0.15s ease, opacity 0.15s ease';
      text.textContent = this.options.formatter ? this.options.formatter(item) : item.label;

      btn.appendChild(marker);
      btn.appendChild(text);

      if (interactive) {
        btn.addEventListener('click', () => {
          const isCurrentlyHidden = this.hiddenKeys.has(item.key);
          if (isCurrentlyHidden) {
            this.hiddenKeys.delete(item.key);
            item.active = true;
          } else {
            this.hiddenKeys.add(item.key);
            item.active = false;
          }

          this.syncItemStyles();
          this.options.onClick?.(item, item.active);
          this.callbacks.onToggle?.(item, item.active, this.hiddenKeys);
        });
      }

      btn.addEventListener('mouseenter', () => {
        this.hoveredKey = item.key;
        this.syncItemStyles();
        this.options.onHover?.(item);
        this.callbacks.onHover?.(item);
      });

      btn.addEventListener('mouseleave', () => {
        this.hoveredKey = null;
        this.syncItemStyles();
        this.options.onHover?.(null);
        this.callbacks.onHover?.(null);
      });

      this.itemElements.set(item.key, { btn, marker, text });
      this.rootEl.appendChild(btn);
    }

    this.syncItemStyles();
  }

  /**
   * 각 범례 항목의 활성/비활성 및 호버 상태에 맞춰 스타일을 갱신합니다.
   */
  private syncItemStyles(): void {
    const activeTextColor = this.options.textColor ?? '#E2E8F0';
    const inactiveColor = this.options.inactiveColor ?? '#64748B';

    for (const item of this.items) {
      const els = this.itemElements.get(item.key);
      if (!els) continue;

      const isActive = !this.hiddenKeys.has(item.key);
      const isHovered = this.hoveredKey === item.key;

      els.marker.style.backgroundColor = isActive ? item.color : inactiveColor;
      els.marker.style.transform = isHovered ? 'scale(1.2)' : 'scale(1)';
      els.marker.style.boxShadow =
        isHovered && isActive ? `0 0 8px ${item.color}` : 'none';

      els.text.style.color = isActive ? activeTextColor : inactiveColor;
      els.text.style.textDecoration = isActive ? 'none' : 'line-through';
      els.btn.style.opacity = isActive ? '1' : '0.5';
      els.btn.style.backgroundColor = isHovered ? 'rgba(255, 255, 255, 0.07)' : 'transparent';
    }
  }

  /**
   * 범례 DOM 엘리먼트를 제거합니다.
   */
  public destroy(): void {
    this.rootEl.remove();
    this.itemElements.clear();
  }
}
