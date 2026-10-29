/**
 * @fileoverview nanocharts의 전역 타입 및 인터페이스 정의
 * 
 * 차트의 데이터 구조, 스타일링 설정, 컴포넌트 옵션 등
 * 라이브러리 전반에서 사용되는 모든 타입을 정의합니다.
 */

/**
 * 단일 데이터 포인트 인터페이스
 * 
 * @example
 * ```ts
 * const item: DataItem = {
 *   label: '1월',
 *   value: 120,
 *   color: '#6366F1', // 특정 바만 단독 색상 지정
 *   category: '매출'  // 임의의 커스텀 필드 추가 가능
 * };
 * ```
 */
export interface DataItem {
  /** 데이터 항목의 고유 식별자 (선택) */
  id?: string | number;
  /** X축 및 툴팁에 표시될 라벨 문자열 (필수) */
  label: string;
  /** 바의 높이가 될 수치값 (필수, 양수/음수/소수점 지원) */
  value: number;
  /** 이 항목에만 단독으로 적용할 개별 바 색상 (선택, Hex/RGB) */
  color?: string;
  /** 개발자가 툴팁이나 라벨 등에서 활용할 수 있는 임의의 추가 데이터 */
  [key: string]: unknown;
}

/**
 * 차트 내부 플롯 영역의 상하좌우 여백 (픽셀 단위)
 */
export type Padding = {
  /** 상단 여백 (기본값: 30) - 데이터 라벨 표시 공간 확보 */
  top: number;
  /** 우측 여백 (기본값: 20) */
  right: number;
  /** 하단 여백 (기본값: 40) - X축 라벨 표시 공간 확보 */
  bottom: number;
  /** 좌측 여백 (기본값: 50) - Y축 수치 눈금 표시 공간 확보 */
  left: number;
};

/**
 * 모서리 둥글기(Border Radius) 타입
 * - 숫자: 전체 4개 모서리에 동일한 반지름 적용 (예: 6)
 * - 4개 배열: [좌상단, 우상단, 우하단, 좌하단] 개별 적용 (예: [6, 6, 0, 0] -> 상단만 둥글게)
 */
export type BorderRadius = number | number[];

/**
 * 선형 그라데이션 설정 인터페이스
 * 
 * @example
 * ```ts
 * const gradient: GradientConfig = {
 *   type: 'linear',
 *   from: '#6366F1',
 *   to: '#9333EA',
 *   direction: 'vertical' // 상단에서 하단으로
 * };
 * ```
 */
export interface GradientConfig {
  type: 'linear';
  /** 시작 색상 */
  from: string;
  /** 종료 색상 */
  to: string;
  /** 그라데이션 방향 ('vertical': 세로 / 'horizontal': 가로, 기본값: 'vertical') */
  direction?: 'vertical' | 'horizontal';
}

/** 색상 표현 타입: 단색 문자열(Hex, RGB) 또는 그라데이션 객체 */
export type ColorStyle = string | GradientConfig;

/**
 * 색상 결정자(Accessor): 고정된 색상 스타일 또는 데이터 항목별로 동적 반환하는 함수
 * 
 * @example
 * ```ts
 * // 값에 따른 조건부 동적 색상
 * fill: (item, index) => item.value >= 80 ? '#10B981' : '#6366F1'
 * ```
 */
export type ColorAccessor = ColorStyle | ((item: DataItem, index: number) => ColorStyle);

/**
 * 바(Bar) 외곽 테두리 스타일
 */
export interface BarBorderStyle {
  /** 테두리 선 색상 */
  color: string;
  /** 테두리 선 두께 (픽셀) */
  width: number;
  /** 점선 스타일 배열 (예: [4, 2] -> 4px 선, 2px 빈칸) */
  dash?: number[];
}

/**
 * 데이터 수치 라벨이 위치할 기준점
 * - 'top-outside': 바 상단 바깥쪽 (기본 권장)
 * - 'inside-top': 바 내부 상단
 * - 'inside-center': 바 내부 정중앙
 * - 'inside-bottom': 바 내부 하단
 * - 'bottom-outside': X축 기준선 바로 아래
 * - 'none': 라벨 숨김
 */
export type LabelPosition =
  | 'top-outside'
  | 'inside-top'
  | 'inside-center'
  | 'inside-bottom'
  | 'bottom-outside'
  | 'none';

/**
 * 사용자가 Canvas에 직접 라벨을 그릴 때 전달받는 컨텍스트 정보
 */
export interface LabelCustomRenderContext {
  /** 바의 X 시작 좌표 */
  x: number;
  /** 바의 Y 시작 좌표 */
  y: number;
  /** 바의 너비 */
  width: number;
  /** 바의 높이 */
  height: number;
  /** 해당 데이터 아이템 원본 */
  item: DataItem;
  /** 데이터 인덱스 */
  index: number;
}

/**
 * 데이터 라벨 렌더링 옵션
 */
export interface DataLabelOptions {
  /** 라벨 표시 여부 (기본값: false) */
  visible?: boolean;
  /** 라벨 표시 위치 (기본값: 'top-outside') */
  position?: LabelPosition;
  /** 기준 위치로부터의 추가 오프셋 간격 (픽셀, 기본값: 6) */
  offset?: number;
  /** CSS 폰트 문자열 (예: '600 11px Pretendard, sans-serif') */
  font?: string;
  /** 라벨 글자 색상 (고정 문자열 또는 동적 콜백) */
  color?: string | ((item: DataItem, index: number) => string);
  /** 텍스트 포맷팅 함수 (예: (val) => `${val.toLocaleString()}건`) */
  formatter?: (value: number, item: DataItem, index: number) => string;
  /** 디자이너 커스텀용 캔버스 직접 렌더러 함수 */
  renderCustom?: (ctx: CanvasRenderingContext2D, context: LabelCustomRenderContext) => void;
}

/**
 * 바(Bar) 형태 및 비주얼 스타일 옵션
 */
export interface BarStyleOptions {
  /** 한 슬롯 내에서 바가 차지하는 너비 비율 (0.1 ~ 1.0, 기본값: 0.65) */
  widthRatio?: number;
  /** 바의 최대 허용 너비 (픽셀) */
  maxWidth?: number;
  /** 바의 최소 허용 너비 (픽셀) */
  minWidth?: number;
  /** 바 채우기 색상 (단색, 그라데이션, 또는 조건부 콜백) */
  fill?: ColorAccessor;
  /** 바 모서리 둥글기 (숫자 또는 [TL, TR, BR, BL] 배열) */
  borderRadius?: BorderRadius;
  /** 바 외곽 테두리 스타일 */
  border?: BarBorderStyle | ((item: DataItem, index: number) => BarBorderStyle | undefined);
  /** 마우스 호버 시 하이라이트 스타일 */
  hover?: {
    fill?: ColorAccessor;
    border?: BarBorderStyle;
    brightness?: number;
  };
}

/**
 * 격자선(Grid) 단일 축 스타일
 */
export interface GridLineStyle {
  /** 표시 여부 (기본값: true) */
  visible?: boolean;
  /** 선 색상 (기본값: '#F1F5F9') */
  color?: string;
  /** 선 두께 (기본값: 1) */
  lineWidth?: number;
  /** 점선 간격 (기본값: [3, 3]) */
  lineDash?: number[];
}

/** 배경 그리드 옵션 */
export interface GridOptions {
  /** 수직(X) 격자선 옵션 */
  x?: GridLineStyle;
  /** 수평(Y) 격자선 옵션 */
  y?: GridLineStyle;
}

/** 축(Axis) 옵션 (X축, Y축 공통) */
export interface AxisOptions {
  /** 축 및 레이블 표시 여부 (기본값: true) */
  visible?: boolean;
  /** 기준선 색상 */
  color?: string;
  /** 기준선 두께 (0이면 선 숨김) */
  lineWidth?: number;
  /** 눈금 틱 크기 */
  tickSize?: number;
  /** 라벨 폰트 */
  font?: string;
  /** 라벨 글자 색상 */
  labelColor?: string;
  /** 축선과 라벨 텍스트 사이의 간격 */
  labelOffset?: number;
  /** 라벨 값 포맷터 함수 */
  formatter?: (value: string | number) => string;
}

/** 툴팁(Tooltip) 옵션 */
export interface TooltipOptions {
  /** 툴팁 활성화 여부 (기본값: true) */
  enabled?: boolean;
  /** 커스텀 CSS 클래스명 */
  className?: string;
  /** 툴팁 HTML 내용 커스텀 포맷터 */
  formatter?: (item: DataItem, index: number) => string;
}

/**
 * BarChart 전체 초기화 옵션
 */
export interface BarChartOptions {
  /** 차트에 바인딩할 데이터 배열 */
  data: DataItem[];
  /** 차트 내부 여백 설정 */
  padding?: Partial<Padding>;
  /** 바 스타일 옵션 */
  bar?: BarStyleOptions;
  /** 데이터 수치 라벨 옵션 */
  labels?: DataLabelOptions;
  /** 배경 격자선 옵션 */
  grid?: GridOptions;
  /** X축 옵션 */
  xAxis?: AxisOptions;
  /** Y축 옵션 */
  yAxis?: AxisOptions;
  /** 툴팁 옵션 */
  tooltip?: TooltipOptions;
  /** 마우스 휠 줌 옵션 */
  zoom?: {
    /** 줌 활성화 여부 (기본값: true) */
    enabled?: boolean;
    /** 최대로 확대했을 때 화면에 보일 최소 데이터 개수 (기본값: 5) */
    minPoints?: number;
  };
  /** 마우스 드래그 좌우 스크롤(팬) 옵션 */
  pan?: {
    /** 팬 활성화 여부 (기본값: true) */
    enabled?: boolean;
  };
}

// ==========================================
// 🥧 Pie / Donut Chart Types
// ==========================================

/**
 * 계산된 단일 파이/도넛 조각의 기하 정보
 */
export interface PieSliceGeometry {
  /** 시작 각도 (라디안) */
  startAngle: number;
  /** 종료 각도 (라디안) */
  endAngle: number;
  /** 중심 각도 (라디안, 라벨 및 explode 오프셋 계산용) */
  midAngle: number;
  /** 내부 반지름 (px) */
  innerRadius: number;
  /** 외부 반지름 (px) */
  outerRadius: number;
  /** 전체 값 중 해당 조각이 차지하는 비율 (0 ~ 1) */
  percentage: number;
  /** 중심점 X */
  cx: number;
  /** 중심점 Y */
  cy: number;
  /** 해당 조각의 채우기 색상 */
  color: string;
  /** 원본 데이터 아이템 */
  item: DataItem;
  /** 원본 데이터 인덱스 */
  index: number;
}

/**
 * 파이/도넛 스타일 옵션
 */
export interface PieStyleOptions {
  /**
   * 도넛 차트 내부 구멍의 반지름 비율 (0.0 ~ 0.9, 기본값: 0 - 파이 차트)
   * 예: 0.6으로 설정하면 가운데가 뚫린 세련된 도넛 차트가 됩니다.
   */
  innerRadiusRatio?: number;
  /** 조각들 사이의 빈 여백 각도 (라디안, 기본값: 0.02) */
  padAngle?: number;
  /** 파이 조각 외곽 모서리 둥글기 (px, 기본값: 0) */
  cornerRadius?: number;
  /** 조각별 기본 컬러 팔레트 (기본 모던 색상 8종 내장) */
  colors?: string[] | ((item: DataItem, index: number) => string);
  /** 마우스 호버 시 중심에서 밖으로 살짝 튀어나오는 픽셀 거리 (기본값: 8) */
  hoverExplode?: number;
  /** 외곽 테두리 스타일 */
  border?: {
    color?: string;
    width?: number;
  };
}

/**
 * 파이 데이터 라벨 옵션
 */
export interface PieLabelOptions {
  /** 라벨 표시 여부 (기본값: true) */
  visible?: boolean;
  /** 라벨 위치 ('outside': 바깥쪽 가이드선, 'inside': 조각 내부, 'none': 숨김) */
  position?: 'outside' | 'inside' | 'none';
  /** 폰트 스타일 */
  font?: string;
  /** 글자 색상 */
  color?: string;
  /** 텍스트 포맷터 (기본: `${item.label} (${(percent * 100).toFixed(1)}%)`) */
  formatter?: (item: DataItem, percentage: number) => string;
}

/**
 * 도넛 차트 중앙에 표시할 텍스트 옵션
 */
export interface PieCenterContentOptions {
  /** 중앙 메인 타이틀/숫자 (예: 'Total' 또는 '1,240건') */
  title?: string | ((data: DataItem[], total: number) => string);
  /** 타이틀 폰트 */
  titleFont?: string;
  /** 타이틀 색상 */
  titleColor?: string;
  /** 하단 서브타이틀 텍스트 */
  subtitle?: string | ((data: DataItem[], total: number) => string);
  /** 서브타이틀 폰트 */
  subtitleFont?: string;
  /** 서브타이틀 색상 */
  subtitleColor?: string;
  /** 완전 커스텀 렌더러 함수 */
  renderCustom?: (ctx: CanvasRenderingContext2D, center: { cx: number; cy: number; innerRadius: number }) => void;
}

/**
 * PieChart 초기화 옵션
 */
export interface PieChartOptions {
  /** 차트에 바인딩할 데이터 배열 */
  data: DataItem[];
  /** 차트 내부 여백 설정 */
  padding?: Partial<Padding>;
  /** 파이/도넛 형태 및 색상 스타일 */
  pie?: PieStyleOptions;
  /** 데이터 라벨 옵션 */
  labels?: PieLabelOptions;
  /** 도넛 차트 중앙 텍스트 옵션 */
  center?: PieCenterContentOptions;
  /** 툴팁 옵션 */
  tooltip?: TooltipOptions;
}

