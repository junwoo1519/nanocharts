export interface DataItem {
  id?: string | number;
  label: string;
  value: number;
  color?: string;
  [key: string]: unknown;
}

export type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type BorderRadius = number | number[]; // [top-left, top-right, bottom-right, bottom-left]

export interface GradientConfig {
  type: 'linear';
  from: string;
  to: string;
  direction?: 'vertical' | 'horizontal';
}

export type ColorStyle = string | GradientConfig;
export type ColorAccessor = ColorStyle | ((item: DataItem, index: number) => ColorStyle);

export interface BarBorderStyle {
  color: string;
  width: number;
  dash?: number[];
}

export type LabelPosition =
  | 'top-outside'
  | 'inside-top'
  | 'inside-center'
  | 'inside-bottom'
  | 'bottom-outside'
  | 'none';

export interface LabelCustomRenderContext {
  x: number;
  y: number;
  width: number;
  height: number;
  item: DataItem;
  index: number;
}

export interface DataLabelOptions {
  visible?: boolean;
  position?: LabelPosition;
  offset?: number;
  font?: string;
  color?: string | ((item: DataItem, index: number) => string);
  formatter?: (value: number, item: DataItem, index: number) => string;
  renderCustom?: (ctx: CanvasRenderingContext2D, context: LabelCustomRenderContext) => void;
}

export interface BarStyleOptions {
  widthRatio?: number; // 0.0 ~ 1.0 (기본값: 0.6)
  maxWidth?: number;
  minWidth?: number;
  fill?: ColorAccessor;
  borderRadius?: BorderRadius;
  border?: BarBorderStyle | ((item: DataItem, index: number) => BarBorderStyle | undefined);
  hover?: {
    fill?: ColorAccessor;
    border?: BarBorderStyle;
    brightness?: number; // 호버 시 밝기 변화 (예: 1.15)
  };
}

export interface GridLineStyle {
  visible?: boolean;
  color?: string;
  lineWidth?: number;
  lineDash?: number[];
}

export interface GridOptions {
  x?: GridLineStyle;
  y?: GridLineStyle;
}

export interface AxisOptions {
  visible?: boolean;
  color?: string;
  lineWidth?: number;
  tickSize?: number;
  font?: string;
  labelColor?: string;
  labelOffset?: number;
  formatter?: (value: string | number) => string;
}

export interface TooltipOptions {
  enabled?: boolean;
  className?: string;
  formatter?: (item: DataItem, index: number) => string;
}

export interface BarChartOptions {
  data: DataItem[];
  padding?: Partial<Padding>;
  bar?: BarStyleOptions;
  labels?: DataLabelOptions;
  grid?: GridOptions;
  xAxis?: AxisOptions;
  yAxis?: AxisOptions;
  tooltip?: TooltipOptions;
  zoom?: {
    enabled?: boolean;
    minPoints?: number;
  };
  pan?: {
    enabled?: boolean;
  };
}
