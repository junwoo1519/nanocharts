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
  /** 데이터 그룹/카테고리 분류명 (선택, 범례 그룹핑 및 필터링에 활용) */
  category?: string;
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
 * 바(Bar) 배치 모드
 * - `'grouped'`: 다중 시리즈를 나란히 병렬 배치 (기본값)
 * - `'stacked'`: 다중 시리즈를 수직으로 누적 배치
 * - `'percent'`: 다중 시리즈를 100% 비율 기준으로 누적 배치
 */
export type BarGroupMode = 'grouped' | 'stacked' | 'percent';

/**
 * 다중 바 차트(Multi-Bar / Stacked Bar)용 개별 시리즈 데이터셋 인터페이스
 * 
 * @example
 * ```ts
 * const series: BarSeriesDataset[] = [
 *   { name: 'Frontend', data: [120, 150, 180, 210], color: '#6366F1' },
 *   { name: 'Backend', data: [90, 110, 140, 160], color: '#10B981' }
 * ];
 * ```
 */
export interface BarSeriesDataset {
  /** 시리즈 고유 식별 키 (미지정 시 `name` 사용) */
  id?: string;
  /** 범례 및 툴팁에 표시될 시리즈 이름 */
  name: string;
  /** 시리즈 수치 배열 (`number[]` 또는 `DataItem[]`) */
  data: (number | DataItem)[];
  /** 이 시리즈에 적용할 채우기 색상 (단색, 그라데이션, 또는 조건부 콜백) */
  color?: ColorAccessor;
  /** 이 시리즈에 적용할 외곽 테두리 스타일 */
  border?: BarBorderStyle | ((item: DataItem, index: number) => BarBorderStyle | undefined);
}

/**
 * 바(Bar) 형태 및 비주얼 스타일 옵션
 */
export interface BarStyleOptions {
  /** 다중 시리즈 배치 모드 ('grouped' | 'stacked' | 'percent', 기본값: 'grouped') */
  mode?: BarGroupMode;
  /** 누적(Stacked) 모드 단축 설정 (`true` 설정 시 `mode: 'stacked'`와 동일) */
  stacked?: boolean;
  /** 한 슬롯 내에서 바(또는 바 그룹 전체)가 차지하는 너비 비율 (0.1 ~ 1.0, 기본값: 0.65) */
  widthRatio?: number;
  /** 그룹형(grouped) 바 차트에서 같은 슬롯 내 개별 바 사이의 간격 비율 (0.0 ~ 0.5, 기본값: 0.12) */
  groupGap?: number;
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
 * 차트 전역 폰트(타이포그래피) 설정 옵션
 */
export interface ChartFontOptions {
  /** 기본 폰트 패밀리 (예: `'Pretendard, Inter, sans-serif'`) */
  family?: string;
  /** 기본 폰트 크기 (px, 기본값: 11) */
  size?: number;
  /** 기본 폰트 두께 (예: `500`, `600`, `'bold'`) */
  weight?: number | string;
}

/**
 * 격자선 선 패턴 프리셋 타입
 * - `'solid'`: 실선
 * - `'dashed'`: 파선 ([5, 4])
 * - `'dotted'`: 점선 ([2, 3])
 */
export type GridStrokePattern = 'solid' | 'dashed' | 'dotted';

/**
 * 격자선(Grid) 단일 축 스타일
 */
export interface GridLineStyle {
  /** 표시 여부 (Y축 기본값: true, X축 기본값: false) */
  visible?: boolean;
  /** 선 색상 (기본값: '#F1F5F9') */
  color?: string;
  /** 선 불투명도 (0.0 ~ 1.0, 기본값: 1.0) */
  opacity?: number;
  /** 선 두께 (기본값: 1) */
  lineWidth?: number;
  /** 선 스타일 프리셋 ('solid' | 'dashed' | 'dotted') */
  style?: GridStrokePattern;
  /** 점선 간격 배열 (예: [3, 3], [] 지정 시 실선) */
  lineDash?: number[];
}

/**
 * 차트 플롯 영역 외곽 테두리 박스 스타일
 */
export interface GridBorderStyle {
  /** 플롯 외곽 박스 표시 여부 (기본값: false) */
  visible?: boolean;
  /** 테두리 색상 */
  color?: string;
  /** 테두리 선 두께 (px, 기본값: 1) */
  lineWidth?: number;
  /** 테두리 점선 패턴 배열 */
  lineDash?: number[];
  /** 테두리 모서리 둥글기 (px, 기본값: 0) */
  radius?: number;
}

/**
 * 격자 사이 줄무늬 배경(Alternate Band / Zebra Fill) 스타일
 */
export interface GridAlternateBandStyle {
  /** 줄무늬 배경 표시 여부 (기본값: false) */
  visible?: boolean;
  /** 짝수 밴드 채우기 색상 (예: `'rgba(148, 163, 184, 0.06)'`) */
  color?: string;
  /** 줄무늬 방향 ('horizontal': 가로 줄무늬, 'vertical': 세로 줄무늬, 기본값: 'horizontal') */
  direction?: 'horizontal' | 'vertical';
}

/** 배경 그리드 옵션 */
export interface GridOptions {
  /** 수직(X) 격자선 옵션 */
  x?: GridLineStyle;
  /** 수평(Y) 격자선 옵션 */
  y?: GridLineStyle;
  /** 차트 플롯 외곽 테두리 박스 옵션 */
  border?: GridBorderStyle;
  /** 격자 줄무늬 배경(Alternate Band) 옵션 */
  alternateBand?: GridAlternateBandStyle;
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

/**
 * 다중 시리즈(Multi-Series) 툴팁에 전달되는 개별 시리즈 항목 정보
 */
export interface TooltipEntry {
  /** 시리즈 고유 식별 키 */
  seriesKey: string;
  /** 시리즈 이름 */
  seriesName: string;
  /** 시리즈 마커 색상 */
  color: string;
  /** 해당 X축 위치의 수치값 */
  value: number;
  /** 누적(Percent) 모드 등에서의 비중 (0 ~ 100, 선택) */
  percentage?: number;
  /** 원본 데이터 아이템 */
  item: DataItem;
  /** 현재 마우스가 직접 올라간 강조 시리즈 여부 */
  highlighted?: boolean;
}

/** 툴팁(Tooltip) 옵션 */
export interface TooltipOptions {
  /** 툴팁 활성화 여부 (기본값: true) */
  enabled?: boolean;
  /** 다중 시리즈 차트에서 같은 X축 슬롯의 모든 시리즈 값을 하나의 통합 툴팁에 표시할지 여부 (기본값: true) */
  shared?: boolean;
  /** 커스텀 CSS 클래스명 */
  className?: string;
  /** 단일 시리즈 툴팁 HTML 내용 커스텀 포맷터 */
  formatter?: (item: DataItem, index: number) => string;
  /** 다중 시리즈 통합 툴팁 HTML 내용 커스텀 포맷터 */
  multiFormatter?: (title: string, entries: TooltipEntry[], index: number) => string;
}

/**
 * 범례(Legend) 배치 위치 (상좌/상중/상우, 하좌/하중/하우, 좌상/좌중/좌하, 우상/우중/우하 12방향 지원)
 * - `'top'` / `'top-left'` / `'top-center'` / `'top-right'`: 상단 좌/중/우
 * - `'bottom'` / `'bottom-left'` / `'bottom-center'` / `'bottom-right'`: 하단 좌/중/우
 * - `'left'` / `'left-top'` / `'left-middle'` / `'left-center'` / `'left-bottom'`: 좌측 상/중/하
 * - `'right'` / `'right-top'` / `'right-middle'` / `'right-center'` / `'right-bottom'`: 우측 상/중/하
 */
export type LegendPosition =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'left-top'
  | 'left-middle'
  | 'left-center'
  | 'left-bottom'
  | 'right-top'
  | 'right-middle'
  | 'right-center'
  | 'right-bottom';

/**
 * 범례(Legend) 정렬 방식
 */
export type LegendAlign = 'start' | 'center' | 'end';

/**
 * 범례(Legend) 마커 아이콘 형태
 * - `'circle'`: 원형
 * - `'rounded'`: 둥근 사각형 (기본값)
 * - `'square'`: 직각 사각형
 * - `'line'`: 선형
 */
export type LegendMarkerShape = 'circle' | 'rounded' | 'square' | 'line';

/**
 * 단일 범례 항목 인터페이스
 */
export interface LegendItem {
  /** 범례 항목의 고유 식별 키 (예: 카테고리명 또는 항목 라벨/ID) */
  key: string;
  /** 화면에 표시될 범례 텍스트 */
  label: string;
  /** 마커 아이콘 색상 (Hex/RGB 문자열) */
  color: string;
  /** 관련 수치 합계 또는 대푯값 (선택) */
  value?: number;
  /** 현재 활성화(표시) 상태 여부 (기본값: true) */
  active?: boolean;
}

/**
 * 범례(Legend) 컴포넌트 옵션
 * 
 * @example
 * ```ts
 * const legend: LegendOptions = {
 *   visible: true,
 *   position: 'top',
 *   align: 'end',
 *   markerShape: 'rounded',
 *   interactive: true
 * };
 * ```
 */
export interface LegendOptions {
  /** 범례 표시 여부 (기본값: true) */
  visible?: boolean;
  /** 범례 배치 위치 ('top' | 'bottom' | 'left' | 'right', 기본값: 'top') */
  position?: LegendPosition;
  /** 범례 정렬 방식 ('start' | 'center' | 'end', 기본값: 'end') */
  align?: LegendAlign;
  /** 마커 아이콘 도형 형태 ('circle' | 'rounded' | 'square' | 'line', 기본값: 'rounded') */
  markerShape?: LegendMarkerShape;
  /** 범례 항목 클릭 시 데이터 토글(표시/숨김) 활성화 여부 (기본값: true) */
  interactive?: boolean;
  /** 글자 크기 (px, 기본값: 12) */
  fontSize?: number;
  /** 폰트 패밀리 (예: `'Pretendard, Inter, sans-serif'`) */
  fontFamily?: string;
  /** 폰트 두께 (예: `500`, `600`, `'bold'`) */
  fontWeight?: number | string;
  /** 활성 항목 글자 색상 (기본값: '#E2E8F0') */
  textColor?: string;
  /** 비활성(숨김) 항목 글자 색상 (기본값: '#64748B') */
  inactiveColor?: string;
  /** 자동 추출 시 표시할 최대 범례 개수 (기본값: 12) */
  maxItems?: number;
  /** 수동으로 지정할 커스텀 범례 아이템 목록 (미지정 시 데이터/카테고리에서 자동 추출) */
  items?: LegendItem[];
  /** 범례 텍스트 커스텀 포맷터 */
  formatter?: (item: LegendItem) => string;
  /** 범례 항목 클릭 시 호출되는 콜백 */
  onClick?: (item: LegendItem, active: boolean) => void;
  /** 범례 항목 마우스 호버/이탈 시 호출되는 콜백 */
  onHover?: (item: LegendItem | null) => void;
}

/**
 * 내장 애니메이션 이징(가감속) 함수 타입
 * - `'linear'`: 일정한 속도로 진행
 * - `'easeOutCubic'`: 부드럽게 감속하며 마무리
 * - `'easeOutQuart'`: 빠르고 세련되게 감속 (기본값)
 * - `'easeOutExpo'`: 초반에 역동적으로 치고 나가며 감속
 * - `'easeOutBack'`: 목표치를 살짝 넘어섰다가 탄성 있게 안착
 */
export type EasingType =
  | 'linear'
  | 'easeOutCubic'
  | 'easeOutQuart'
  | 'easeOutExpo'
  | 'easeOutBack';

/**
 * 차트 렌더링 애니메이션 옵션
 * 
 * @example
 * ```ts
 * const animation: AnimationOptions = {
 *   enabled: true,
 *   duration: 700,
 *   easing: 'easeOutQuart'
 * };
 * ```
 */
export interface AnimationOptions {
  /** 애니메이션 활성화 여부 (기본값: true) */
  enabled?: boolean;
  /** 애니메이션 재생 시간 (밀리초 단위, 기본값: 650) */
  duration?: number;
  /** 이징 프리셋 이름 또는 커스텀 이징 함수 `(t: number) => number` (기본값: 'easeOutQuart') */
  easing?: EasingType | ((t: number) => number);
  /** 애니메이션 완료 시 호출되는 콜백 */
  onComplete?: () => void;
}

/**
 * 반응형(Responsive) 레이아웃 및 브레이크포인트 자동 보정 옵션
 *
 * @example
 * ```ts
 * const responsive: ResponsiveOptions = {
 *   enabled: true,
 *   aspectRatio: 1.6, // 가로:세로 16:10 비율 자동 유지
 *   minHeight: 220,
 *   compactBreakpoint: 480
 * };
 * ```
 */
export interface ResponsiveOptions {
  /** 반응형 여백/크기 자동 보정 활성화 여부 (기본값: true) */
  enabled?: boolean;
  /**
   * 컨테이너에 명시적 CSS `height`가 없거나 비율 고정 모드를 원할 때 적용할 가로/세로 비율
   * (예: `1.6` = 16:10 비율, `2.0` = 2:1 와이드 비율)
   */
  aspectRatio?: number;
  /** 자동 높이 산출 시 보장할 최소 높이 (px, 기본값: 200) */
  minHeight?: number;
  /** 자동 높이 산출 시 제한할 최대 높이 (px) */
  maxHeight?: number;
  /** 모바일/컴팩트 모드로 전환할 기준 가로 너비 (px, 기본값: 480) */
  compactBreakpoint?: number;
  /** 컨테이너 리사이즈 시 호출되는 콜백 */
  onResize?: (width: number, height: number, isCompact: boolean) => void;
}

/**
 * BarChart 전체 초기화 옵션
 */
export interface BarChartOptions {
  /** 단일 시리즈 데이터 배열 (`series`를 사용할 경우 생략 가능) */
  data?: DataItem[];
  /** 다중 시리즈(Grouped / Stacked Bar) 데이터셋 배열 */
  series?: BarSeriesDataset[];
  /** 다중 시리즈에서 숫자 배열(`number[]`)을 사용할 때 지정할 X축 라벨 목록 */
  xLabels?: string[];
  /** 차트 내부 여백 설정 */
  padding?: Partial<Padding>;
  /** 차트 전역 폰트(패밀리, 크기, 두께) 설정 */
  font?: ChartFontOptions;
  /** 반응형 레이아웃 및 자동 여백/비율 설정 (`true`/`false` 또는 상세 설정 객체, 기본값: true) */
  responsive?: boolean | ResponsiveOptions;
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
  /** 범례(Legend) 표시 및 데이터 토글 옵션 (`true`/`false` 또는 상세 설정 객체) */
  legend?: boolean | LegendOptions;
  /** 렌더링 애니메이션 옵션 (`false` 전달 시 즉시 렌더링, 기본값: 활성화) */
  animation?: boolean | AnimationOptions;
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
  /** 차트 전역 폰트(패밀리, 크기, 두께) 설정 */
  font?: ChartFontOptions;
  /** 반응형 레이아웃 및 자동 여백/비율 설정 (`true`/`false` 또는 상세 설정 객체, 기본값: true) */
  responsive?: boolean | ResponsiveOptions;
  /** 파이/도넛 형태 및 색상 스타일 */
  pie?: PieStyleOptions;
  /** 데이터 라벨 옵션 */
  labels?: PieLabelOptions;
  /** 도넛 차트 중앙 텍스트 옵션 */
  center?: PieCenterContentOptions;
  /** 툴팁 옵션 */
  tooltip?: TooltipOptions;
  /** 범례(Legend) 표시 및 데이터 토글 옵션 (`true`/`false` 또는 상세 설정 객체) */
  legend?: boolean | LegendOptions;
  /** 렌더링 애니메이션 옵션 (`false` 전달 시 즉시 렌더링, 기본값: 활성화) */
  animation?: boolean | AnimationOptions;
}

// ==========================================
// 📈 Line / Area Chart Types
// ==========================================

/**
 * 라인 보간(곡선) 방식
 * - `'linear'`: 데이터 포인트를 직선으로 연결
 * - `'smooth'`: 부드러운 3차 베지에 곡선(Spline)으로 연결
 * - `'step'`: 계단형(수평 이동 후 수직 이동)으로 연결
 */
export type LineCurveType = 'linear' | 'smooth' | 'step';

/**
 * 계산된 단일 라인 데이터 포인트의 화면 좌표 및 메타데이터
 */
export interface LinePointGeometry {
  /** 포인트의 캔버스 X 좌표 (px) */
  x: number;
  /** 포인트의 캔버스 Y 좌표 (px) */
  y: number;
  /** 원본 데이터 아이템 */
  item: DataItem;
  /** 원본 데이터 배열 상의 인덱스 */
  index: number;
}

/**
 * 선(Line) 스타일 옵션
 * 
 * @example
 * ```ts
 * const line: LineStyleOptions = {
 *   color: '#6366F1',
 *   width: 2.5,
 *   curve: 'smooth',
 *   tension: 0.35
 * };
 * ```
 */
export interface LineStyleOptions {
  /** 선 색상 (단색 Hex/RGB 또는 그라데이션 설정, 기본값: '#6366F1') */
  color?: ColorStyle;
  /** 선 두께 (픽셀 단위, 기본값: 2.5) */
  width?: number;
  /** 선 보간 형태 ('linear' | 'smooth' | 'step', 기본값: 'smooth') */
  curve?: LineCurveType;
  /** 'smooth' 곡선일 때의 곡률 텐션 (0.0 ~ 1.0, 기본값: 0.35) */
  tension?: number;
  /** 점선 패턴 배열 (예: [6, 4]) */
  dash?: number[];
}

/**
 * 라인 하단 영역(Area) 채우기 스타일 옵션
 * 
 * @example
 * ```ts
 * const area: AreaStyleOptions = {
 *   visible: true,
 *   fill: {
 *     type: 'linear',
 *     from: 'rgba(99, 102, 241, 0.45)',
 *     to: 'rgba(99, 102, 241, 0.0)',
 *     direction: 'vertical'
 *   }
 * };
 * ```
 */
export interface AreaStyleOptions {
  /** 영역 채우기 활성화 여부 (기본값: true) */
  visible?: boolean;
  /** 채우기 색상 또는 그라데이션 (미지정 시 선 색상 기반 반투명 그라데이션 자동 적용) */
  fill?: ColorStyle;
  /** 전체 채우기 영역의 투명도 (0.0 ~ 1.0, 기본값: 1.0) */
  opacity?: number;
  /** 그라데이션 상단(시작점) 불투명도 (0.0 ~ 1.0, 기본값: 0.42) */
  topOpacity?: number;
  /** 그라데이션 하단(끝점) 불투명도 (0.0 ~ 1.0, 기본값: 0.02) */
  bottomOpacity?: number;
  /** 그라데이션 상단 채도(Saturation, 0 ~ 100%, 미지정 시 원본 선 색상 채도 사용) */
  topSaturation?: number;
  /** 그라데이션 하단 채도(Saturation, 0 ~ 100%, 미지정 시 상단 채도와 동일) */
  bottomSaturation?: number;
  /** 원본 선 색상 대비 채도 증감치 (-100 ~ +100) */
  saturationDelta?: number;
  /** 그라데이션 상단 명도(Lightness, 0 ~ 100%, 미지정 시 원본 선 색상 명도 사용) */
  topLightness?: number;
  /** 그라데이션 하단 명도(Lightness, 0 ~ 100%, 미지정 시 상단 명도와 동일) */
  bottomLightness?: number;
  /** 원본 선 색상 대비 명도 증감치 (-100 ~ +100) */
  lightnessDelta?: number;
}

/**
 * 데이터 포인트 마커(점) 스타일 옵션
 */
export interface LinePointStyleOptions {
  /** 평상시 포인트 마커 표시 여부 (데이터가 많을 경우 false로 두면 깔끔하며 호버 시에만 표시 가능, 기본값: true) */
  visible?: boolean;
  /** 기본 포인트 원 반지름 (px, 기본값: 4) */
  radius?: number;
  /** 호버 시 확대될 포인트 원 반지름 (px, 기본값: 6) */
  hoverRadius?: number;
  /** 포인트 내부 채우기 색상 (기본값: '#0B0F19' 다크 배경색 또는 흰색) */
  fill?: string | ((item: DataItem, index: number) => string);
  /** 포인트 외곽 테두리 색상 (미지정 시 선 색상 자동 계승) */
  borderColor?: string | ((item: DataItem, index: number) => string);
  /** 포인트 외곽 테두리 두께 (px, 기본값: 2) */
  borderWidth?: number;
}

/**
 * 마우스 호버 시 표시되는 십자선(Crosshair) 가이드 옵션
 */
export interface CrosshairOptions {
  /** 크로스헤어 활성화 여부 (기본값: true) */
  enabled?: boolean;
  /** 수직 가이드선 표시 여부 (기본값: true) */
  vertical?: boolean;
  /** 수평 가이드선 표시 여부 (기본값: false) */
  horizontal?: boolean;
  /** 가이드선 색상 (기본값: 'rgba(148, 163, 184, 0.45)') */
  color?: string;
  /** 가이드선 두께 (px, 기본값: 1) */
  width?: number;
  /** 점선 스타일 배열 (기본값: [4, 4]) */
  dash?: number[];
}

/**
 * 다중 라인/영역 차트(Multi-Line / Stacked Area)용 개별 시리즈 데이터셋 인터페이스
 * 
 * @example
 * ```ts
 * const series: LineSeriesDataset[] = [
 *   { name: '모바일 트래픽', data: [140, 230, 195, 290], color: '#6366F1' },
 *   { name: '데스크톱 트래픽', data: [95, 130, 160, 185], color: '#22D3EE', dash: [6, 4] }
 * ];
 * ```
 */
export interface LineSeriesDataset {
  /** 시리즈 고유 식별 키 (미지정 시 `name` 사용) */
  id?: string;
  /** 범례 및 툴팁에 표시될 시리즈 이름 */
  name: string;
  /** 시리즈 수치 배열 (`number[]` 또는 `DataItem[]`) */
  data: (number | DataItem)[];
  /** 선 색상 (단색 또는 그라데이션) */
  color?: ColorStyle;
  /** 선 두께 (px) */
  width?: number;
  /** 선 보간 형태 ('linear' | 'smooth' | 'step') */
  curve?: LineCurveType;
  /** 점선 패턴 배열 (예: [6, 4]) */
  dash?: number[];
  /** 하단 영역(Area) 채우기 설정 (`boolean` 또는 상세 설정 객체) */
  area?: boolean | AreaStyleOptions;
  /** 포인트 마커 스타일 설정 */
  points?: LinePointStyleOptions;
}

/**
 * LineChart (및 AreaChart) 전체 초기화 옵션
 */
export interface LineChartOptions {
  /** 단일 시리즈 데이터 배열 (`series`를 사용할 경우 생략 가능) */
  data?: DataItem[];
  /** 다중 라인/영역 시리즈 데이터셋 배열 */
  series?: LineSeriesDataset[];
  /** 다중 시리즈에서 숫자 배열(`number[]`)을 사용할 때 지정할 X축 라벨 목록 */
  xLabels?: string[];
  /** 다중 시리즈 누적(Stacked Line / Stacked Area) 모드 활성화 여부 (기본값: false) */
  stacked?: boolean;
  /** 차트 내부 여백 설정 */
  padding?: Partial<Padding>;
  /** 차트 전역 폰트(패밀리, 크기, 두께) 설정 */
  font?: ChartFontOptions;
  /** 반응형 레이아웃 및 자동 여백/비율 설정 (`true`/`false` 또는 상세 설정 객체, 기본값: true) */
  responsive?: boolean | ResponsiveOptions;
  /** 선(Line) 스타일 옵션 */
  line?: LineStyleOptions;
  /** 영역(Area) 채우기 스타일 옵션 */
  area?: AreaStyleOptions;
  /** 데이터 포인트(마커) 옵션 */
  points?: LinePointStyleOptions;
  /** 데이터 수치 라벨 옵션 */
  labels?: DataLabelOptions;
  /** 호버 크로스헤어(십자 가이드선) 옵션 */
  crosshair?: CrosshairOptions;
  /** 배경 격자선 옵션 */
  grid?: GridOptions;
  /** X축 옵션 */
  xAxis?: AxisOptions;
  /** Y축 옵션 */
  yAxis?: AxisOptions;
  /** 툴팁 옵션 */
  tooltip?: TooltipOptions;
  /** 범례(Legend) 표시 및 데이터 토글 옵션 (`true`/`false` 또는 상세 설정 객체) */
  legend?: boolean | LegendOptions;
  /** 렌더링 애니메이션 옵션 (`false` 전달 시 즉시 렌더링, 기본값: 활성화) */
  animation?: boolean | AnimationOptions;
  /**
   * 대용량 데이터 렌더링 최적화를 위한 LTTB 다운샘플링 임계치
   * - 화면 내 포인트 개수가 `samplingThreshold`를 초과하면 시각적 형태를 보존하면서 샘플링하여 60fps를 보장합니다.
   * - 기본값: 600 (0 또는 false 설정 시 비활성화)
   */
  samplingThreshold?: number | false;
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
// 🎨 SVG / Figma Vector Export Types
// ==========================================

/**
 * 피그마(`figma.createNodeFromSvg`) 및 일러스트레이터 호환 순수 벡터(SVG) 추출 옵션
 */
export interface SvgExportOptions {
  /** 추출할 SVG 가로 크기 (px, 미지정 시 현재 차트 컨테이너 너비 사용) */
  width?: number;
  /** 추출할 SVG 세로 크기 (px, 미지정 시 현재 차트 컨테이너 높이 사용) */
  height?: number;
  /** 배경 채우기 색상 (예: `'#151C2C'`, 미지정 또는 `'transparent'` 시 투명 배경) */
  backgroundColor?: string;
  /** 배경 사각형 모서리 둥글기 (px, 기본값: 0) */
  backgroundRadius?: number;
  /** 범례(Legend)를 SVG 벡터 레이어에 포함할지 여부 (기본값: true) */
  includeLegend?: boolean;
  /** 배경 격자선(Grid)을 SVG 벡터 레이어에 포함할지 여부 (기본값: true) */
  includeGrid?: boolean;
}

// ==========================================
// 🔻 Funnel Chart Types
// ==========================================

/**
 * 퍼널(Funnel) 차트 진행 방향
 * - `'vertical'`: 상단에서 하단으로 좁아지는 세로형 퍼널 (기본값)
 * - `'horizontal'`: 좌측에서 우측으로 좁아지는 가로형 퍼널
 */
export type FunnelDirection = 'vertical' | 'horizontal';

/**
 * 퍼널(Funnel) 단계 도형 형태
 * - `'trapezoid'`: 다음 단계의 폭과 부드럽게 사다리꼴로 연결되는 형태 (기본값)
 * - `'bar'`: 각 단계가 독립된 둥근 사각형 바로 중앙 정렬되는 형태
 */
export type FunnelShape = 'trapezoid' | 'bar';

/**
 * 계산된 단일 퍼널 단계(Stage)의 기하학 정보
 */
export interface FunnelStageGeometry {
  /** 단계 인덱스 (0부터 시작) */
  index: number;
  /** 원본 데이터 아이템 */
  item: DataItem;
  /** 채우기 색상 */
  color: string;
  /** 다각형 꼭짓점 좌표 배열 (시계 방향 4개 점: `[{x, y}, ...]`) */
  points: { x: number; y: number }[];
  /** 바운딩 박스 시작 X */
  x: number;
  /** 바운딩 박스 시작 Y */
  y: number;
  /** 바운딩 박스 가로 폭 */
  width: number;
  /** 바운딩 박스 세로 높이 */
  height: number;
  /** 중심점 X */
  cx: number;
  /** 중심점 Y */
  cy: number;
  /** 최초(1단계) 값 대비 비율 (0.0 ~ 1.0) */
  overallRatio: number;
  /** 직전 단계 값 대비 전환율 (0.0 ~ 1.0, 첫 단계는 1.0) */
  stepConversionRate: number;
}

/**
 * 퍼널 차트 도형 및 전환율 표시 스타일 옵션
 */
export interface FunnelStyleOptions {
  /** 퍼널 진행 방향 ('vertical': 상->하, 'horizontal': 좌->우, 기본값: 'vertical') */
  direction?: FunnelDirection;
  /** 퍼널 단계 모양 ('trapezoid': 사다리꼴 연결, 'bar': 단계별 바, 기본값: 'trapezoid') */
  shape?: FunnelShape;
  /** 단계 사이의 간격 (px, 기본값: 4) */
  gap?: number;
  /** 'bar' 형태일 때 모서리 둥글기 (px, 기본값: 6) */
  borderRadius?: number;
  /** 가장 작은 단계가 유지할 최소 크기 비율 (0.08 ~ 0.5, 기본값: 0.16) */
  minSizeRatio?: number;
  /** 마지막 단계의 끝부분 폭을 그 단계 자체 비율로 유지할지('pinch': 뾰족하게, 'flat': 평평하게, 기본값: 'flat') */
  neckStyle?: 'flat' | 'pinch';
  /** 단계별 컬러 팔레트 */
  colors?: string[] | ((item: DataItem, index: number) => string);
  /** 단계 간 전환율(%) 배지 표시 여부 (기본값: true) */
  showConversion?: boolean;
  /** 전환율 계산 기준 ('previous': 직전 단계 대비 %, 'first': 첫 단계 대비 %, 기본값: 'previous') */
  conversionBase?: 'previous' | 'first';
  /** 외곽 테두리 스타일 */
  border?: {
    color?: string;
    width?: number;
  };
}

/**
 * 퍼널 데이터 라벨 옵션
 */
export interface FunnelLabelOptions {
  /** 라벨 표시 여부 (기본값: true) */
  visible?: boolean;
  /** 라벨 위치 ('inside': 도형 중앙, 'outside': 바깥쪽 측면, 'none': 숨김, 기본값: 'inside') */
  position?: 'inside' | 'outside' | 'none';
  /** 폰트 스타일 */
  font?: string;
  /** 글자 색상 */
  color?: string;
  /** 커스텀 라벨 포맷터 */
  formatter?: (item: DataItem, stage: FunnelStageGeometry) => string;
}

/**
 * FunnelChart 전체 초기화 옵션
 */
export interface FunnelChartOptions {
  /** 퍼널 단계별 데이터 배열 */
  data: DataItem[];
  /** 차트 내부 여백 설정 */
  padding?: Partial<Padding>;
  /** 차트 전역 폰트(패밀리, 크기, 두께) 설정 */
  font?: ChartFontOptions;
  /** 반응형 레이아웃 및 자동 여백/비율 설정 (기본값: true) */
  responsive?: boolean | ResponsiveOptions;
  /** 퍼널 도형 및 진행 방향 스타일 옵션 */
  funnel?: FunnelStyleOptions;
  /** 단계 라벨 옵션 */
  labels?: FunnelLabelOptions;
  /** 툴팁 옵션 */
  tooltip?: TooltipOptions;
  /** 범례(Legend) 표시 및 데이터 토글 옵션 */
  legend?: boolean | LegendOptions;
  /** 렌더링 애니메이션 옵션 */
  animation?: boolean | AnimationOptions;
}



