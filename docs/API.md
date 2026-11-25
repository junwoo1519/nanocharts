# API 명세서 (`docs/API.md`)

> **문서 목적:** `@ju9nu7/nanocharts` (`v0.1.16`)의 실제 소스 코드(`src/types/index.ts`, `src/core/`, `src/series/`, `src/components/`)를 기준으로 공통 Props, 차트별 고유 옵션, 입력 데이터 포맷, 커스텀 렌더러 시그니처, 인스턴스 메서드 및 이벤트 맵을 정리합니다.

---

## 1. 입력 데이터 포맷 스펙

### 1.1 `DataItem` (단일 시리즈 공통)

| 필드 | 타입 | 필수 | 설명 |
| :--- | :--- | :---: | :--- |
| `label` | `string` | O | X축, 툴팁, 범례에 표시될 라벨 문자열 |
| `value` | `number` | O | 수치값 (양수/음수/소수점 지원; `PieChart`·`FunnelChart`는 음수를 `0`으로 클램핑) |
| `id` | `string \| number` | - | 항목 고유 식별자 (범례 키 우선 참조) |
| `color` | `string` | - | 항목 단독 색상 (Hex/RGB/`var(--token)`/디자인 토큰명) |
| `category` | `string` | - | 범례 그룹핑 및 필터링 키 (`BarChart`, `LineChart` 단일 시리즈에서 활용) |
| `[key: string]` | `unknown` | - | `formatter`·`renderCustom`에서 활용할 임의 메타데이터 |

### 1.2 `BarSeriesDataset` (다중 바 차트)

| 필드 | 타입 | 필수 | 설명 |
| :--- | :--- | :---: | :--- |
| `name` | `string` | O | 범례 및 툴팁에 표시될 시리즈 이름 |
| `data` | `(number \| DataItem)[]` | O | 슬롯별 수치 또는 `DataItem` 배열 (`xLabels`와 인덱스 매핑) |
| `id` | `string` | - | 시리즈 고유 식별 키 (미지정 시 `name` 또는 `series-${index}`) |
| `color` | `ColorAccessor` | - | 시리즈 채우기 색상 (단색, `GradientConfig`, 또는 동적 콜백) |
| `border` | `BarBorderStyle \| ((item, index) => BarBorderStyle \| undefined)` | - | 시리즈 외곽선 스타일 |

### 1.3 `LineSeriesDataset` (다중 라인/영역 차트)

| 필드 | 타입 | 필수 | 설명 |
| :--- | :--- | :---: | :--- |
| `name` | `string` | O | 범례 및 툴팁에 표시될 시리즈 이름 |
| `data` | `(number \| DataItem)[]` | O | 슬롯별 수치 또는 `DataItem` 배열 |
| `id` | `string` | - | 시리즈 고유 식별 키 |
| `color` | `ColorStyle` | - | 선 색상 (단색 또는 `GradientConfig`) |
| `width` | `number` | - | 선 두께 (px, 기본값: 차트 `line.width` 또는 `2.5`) |
| `curve` | `'linear' \| 'smooth' \| 'step'` | - | 선 보간 형태 |
| `dash` | `number[]` | - | 점선 패턴 배열 (예: `[6, 4]`) |
| `area` | `boolean \| AreaStyleOptions` | - | 개별 시리즈 영역 채우기 설정 |
| `points` | `LinePointStyleOptions` | - | 개별 시리즈 포인트 마커 스타일 |

---

## 2. 공통 Props (4종 차트 공통)

모든 차트 생성자는 `new XxxChart(container: string | HTMLElement, options: XxxChartOptions)` 시그니처를 가집니다.

| 옵션명 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `padding` | `Partial<Padding>` | 차트별 상이 | `{ top, right, bottom, left }` 플롯 내부 여백 (px) |
| `font` | `ChartFontOptions` | 시스템/Pretendard | `{ family?, size?, weight? }` 전역 타이포그래피 (축, 라벨, 범례, 중앙 텍스트, SVG 반영) |
| `responsive` | `boolean \| ResponsiveOptions` | `true` | `ResizeObserver` 및 `aspectRatio`, `minHeight`(`200`), `maxHeight`, `compactBreakpoint`(`480`), `onResize` |
| `tooltip` | `TooltipOptions` | `{ enabled: true, shared: true }` | 부동형 DOM 툴팁 (`enabled`, `shared`, `className`, `formatter`, `multiFormatter`) |
| `legend` | `boolean \| LegendOptions` | 차트별 상이 | 12방향 배치(`position`), `align`, `markerShape`, `interactive`, `fontSize`, `fontFamily`, `fontWeight`, `textColor`, `inactiveColor`, `maxItems`(`12`), `items`, `formatter`, `onClick`, `onHover` |
| `animation` | `boolean \| AnimationOptions` | `{ enabled: true, duration: 650, easing: 'easeOutQuart' }` | 이징 프리셋(`linear`, `easeOutCubic`, `easeOutQuart`, `easeOutExpo`, `easeOutBack`) 또는 커스텀 함수 `(t: number) => number`, `onComplete` |

### 축 및 그리드 공통 옵션 (`BarChart`, `LineChart`)

| 옵션명 | 주요 필드 및 기본값 |
| :--- | :--- |
| `xAxis` / `yAxis` (`AxisOptions`) | `visible` (`true`), `color` (X: `#E2E8F0`, Y: `#CBD5E1`), `lineWidth` (X: `1`, Y: 미지정 시 숨김), `font`, `labelColor` (X: `#64748B`, Y: `#94A3B8`), `labelOffset` (X: `10`, Y: `8`), `formatter`. (`tickSize`는 타입 선언만 존재하며 현재 렌더링 미사용) |
| `grid` (`GridOptions`) | `y` (`visible: true`, `color: '#F1F5F9'`, `lineWidth: 1`, `opacity`, `style: 'solid' \| 'dashed' \| 'dotted'`, `lineDash: [3, 3]`), `x` (`visible: false`), `border` (`visible`, `color: '#CBD5E1'`, `lineWidth: 1`, `lineDash`, `radius: 0`), `alternateBand` (`visible`, `color: 'rgba(148, 163, 184, 0.06)'`, `direction: 'horizontal' \| 'vertical'`) |
| `zoom` | `{ enabled?: boolean (true), minPoints?: number (5) }` — 마우스 휠 커서 중심 확대/축소 |
| `pan` | `{ enabled?: boolean (true) }` — 마우스 좌클릭 드래그 및 줌인 상태 터치 스와이프 팬 |

---

## 3. 차트별 고유 옵션

### 3.1 `BarChartOptions` (`BarChart`)

| 옵션명 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `data` / `series` / `xLabels` | `DataItem[]` / `BarSeriesDataset[]` / `string[]` | - | 단일 데이터 또는 다중 시리즈 + X축 라벨 |
| `bar.mode` | `'grouped' \| 'stacked' \| 'percent'` | `'grouped'` | 다중 시리즈 배치 모드 |
| `bar.stacked` | `boolean` | `false` | `true`일 때 `mode: 'stacked'` 단축 설정 |
| `bar.widthRatio` | `number` | `0.65` | 슬롯 대비 바(그룹) 너비 비율 (`0.05` ~ `1.0` 클램핑) |
| `bar.groupGap` | `number` | `0.12` | 그룹형 모드 내 바 간격 비율 (`0.0` ~ `0.5` 클램핑) |
| `bar.fill` | `ColorAccessor` | `'#4F46E5'` | 단색, `GradientConfig`, 또는 `(item, index) => ColorStyle` |
| `bar.borderRadius` | `number \| number[]` | `[4, 4, 0, 0]` | 4개 모서리 `[TL, TR, BR, BL]` 둥글기 (px) |
| `bar.border` | `BarBorderStyle \| Callback` | - | `{ color, width, dash? }` 외곽선 |
| `bar.hover` | `{ fill?, border?, brightness? }` | 화이트 오버레이 + 테두리 | 호버 하이라이트 스타일 (`brightness`는 타입 선언만 존재) |
| `bar.minWidth` / `bar.maxWidth` | `number` | - | 타입 선언 존재 (현재 `BarSeries`에서 별도 클램핑 미적용) |
| `labels` | `DataLabelOptions` | `visible: false`, `position: 'top-outside'`, `offset: 6` | 위치 6종(`top-outside`, `inside-top`, `inside-center`, `inside-bottom`, `bottom-outside`, `none`), `font`, `color`, `formatter`, `renderCustom` |

### 3.2 `LineChartOptions` (`LineChart`)

| 옵션명 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `data` / `series` / `xLabels` | `DataItem[]` / `LineSeriesDataset[]` / `string[]` | - | 단일 또는 다중 라인 데이터 |
| `stacked` | `boolean` | `false` | 다중 시리즈 누적 영역(Stacked Area) 활성화 |
| `line` | `LineStyleOptions` | `color: '#6366F1'`, `width: 2.5`, `curve: 'smooth'`, `tension: 0.35` | 선 색상(단색/그라데이션), 두께, 보간(`linear`/`smooth`/`step`), 곡률 텐션, `dash` |
| `area` | `AreaStyleOptions` | `visible: true`, `opacity: 1`, `topOpacity: 0.42`, `bottomOpacity: 0.02` | `fill`, `opacity`, `topOpacity`, `bottomOpacity`, `topSaturation`, `bottomSaturation`, `saturationDelta`, `topLightness`, `bottomLightness`, `lightnessDelta` |
| `points` | `LinePointStyleOptions` | `visible: true`, `radius: 4`, `hoverRadius: 6`, `fill: '#0B0F19'`, `borderWidth: 2` | 정적/호버 포인트 마커 (`visibleCount <= 80`일 때 정적 표시) |
| `crosshair` | `CrosshairOptions` | `enabled: true`, `vertical: true`, `horizontal: false`, `color: 'rgba(148, 163, 184, 0.45)'`, `width: 1`, `dash: [4, 4]` | 호버 십자 가이드선 |
| `labels` | `DataLabelOptions` | `visible: false`, `offset: 8` | 포인트 상/하단 라벨 (`visibleCount <= 45`일 때 표시) |
| `samplingThreshold` | `number \| false` | `600` | LTTB 다운샘플링 임계치 (`0` 또는 `false` 시 비활성화, `stacked`에서는 자동 비활성화) |

### 3.3 `PieChartOptions` (`PieChart`)

| 옵션명 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `data` | `DataItem[]` | (필수) | 조각 데이터 배열 |
| `pie.innerRadiusRatio` | `number` | `0` | 도넛 내부 구멍 비율 (`0.0` ~ `0.85` 클램핑) |
| `pie.maxValue` | `number` | - | 100%(360°) 기준 목표 최대값 (잔여 영역 트랙 자동 생성) |
| `pie.trackColor` | `string` | `'var(--surface-low)'` (`maxValue` 지정 시) | 잔여 영역 배경 트랙 색상 (`'transparent'`/`'none'` 시 숨김) |
| `pie.padAngle` | `number` | 도넛 `0.02`, 파이 `0` | 조각 사이 여백 각도 (라디안) |
| `pie.colors` | `string[] \| ((item, index) => string)` | `DEFAULT_PALETTE` | 조각 팔레트 또는 동적 색상 함수 |
| `pie.hoverExplode` | `number` | `8` (일부 계산 `10` 폴백) | 호버 시 바깥으로 튀어나오는 거리 (px) |
| `pie.border` | `{ color?: string; width?: number }` | - | 조각 외곽선 |
| `pie.cornerRadius` | `number` | `0` | 타입 선언 존재 (현재 Canvas `ctx.arc` 렌더링에는 미적용) |
| `labels` | `PieLabelOptions` | `visible: true`, `position: 'outside'` | `'outside' \| 'inside' \| 'none'`, `font`, `color`, `formatter` |
| `center` | `PieCenterContentOptions` | `title`: 합계/비율, `subtitle`: `'Total'` | 도넛(`innerRadius > 15`) 중앙 타이틀/서브타이틀, 폰트/색상, `renderCustom` |

### 3.4 `FunnelChartOptions` (`FunnelChart`)

| 옵션명 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `data` | `DataItem[]` | (필수) | 퍼널 단계별 데이터 배열 |
| `funnel.direction` | `'vertical' \| 'horizontal'` | `'vertical'` | 상→하 세로형 또는 좌→우 가로형 진행 방향 |
| `funnel.shape` | `'trapezoid' \| 'bar'` | `'trapezoid'` | 사다리꼴 연결형 또는 둥근 바 형태 |
| `funnel.gap` | `number` | `4` | 단계 사이 간격 (px) |
| `funnel.borderRadius` | `number` | `6` | `shape: 'bar'`일 때 모서리 둥글기 (px) |
| `funnel.minSizeRatio` | `number` | `0.16` | 최소 단계 크기 비율 (`0.08` ~ `0.5` 클램핑) |
| `funnel.neckStyle` | `'flat' \| 'pinch'` | `'flat'` | 마지막 단계 끝부분 폭 스타일 (`pinch`는 `0.55`배 축소) |
| `funnel.colors` | `string[] \| ((item, index) => string)` | `DEFAULT_PALETTE` | 단계별 색상 팔레트 또는 콜백 |
| `funnel.showConversion` | `boolean` | `true` | 단계별 전환율(`%`) 자동 표시 여부 |
| `funnel.conversionBase` | `'previous' \| 'first'` | `'previous'` | 전환율 기준 (직전 단계 대비 / 1단계 대비) |
| `funnel.border` | `{ color?: string; width?: number }` | - | 단계 외곽선 스타일 |
| `labels` | `FunnelLabelOptions` | `visible: true`, `position: 'inside'` | `'inside' \| 'outside' \| 'none'`, `font`, `color`, `formatter` |

---

## 4. 커스텀 렌더러 및 포맷터 시그니처

| 위치 | 옵션명 | 정확한 TypeScript 시그니처 |
| :--- | :--- | :--- |
| `DataLabelOptions` | `renderCustom` | `(ctx: CanvasRenderingContext2D, context: { x: number; y: number; width: number; height: number; item: DataItem; index: number }) => void` |
| `DataLabelOptions` | `formatter` | `(value: number, item: DataItem, index: number) => string` |
| `PieCenterContentOptions` | `renderCustom` | `(ctx: CanvasRenderingContext2D, center: { cx: number; cy: number; innerRadius: number }) => void` |
| `PieLabelOptions` | `formatter` | `(item: DataItem, percentage: number) => string` |
| `FunnelLabelOptions` | `formatter` | `(item: DataItem, stage: FunnelStageGeometry) => string` |
| `AxisOptions` | `formatter` | `(value: string \| number) => string` |
| `TooltipOptions` | `formatter` | `(item: DataItem, index: number) => string` |
| `TooltipOptions` | `multiFormatter` | `(title: string, entries: TooltipEntry[], index: number) => string` |
| `LegendOptions` | `formatter` | `(item: LegendItem) => string` |
| `ColorAccessor` | `fill` / `color` | `(item: DataItem, index: number) => string \| GradientConfig` |

---

## 5. 인스턴스 메서드 및 이벤트 맵

### 5.1 공개 메서드

| 메서드 | 지원 차트 | 설명 |
| :--- | :--- | :--- |
| `update(partialOptions)` | 전체 4종 | 데이터/스타일/범례/여백 동적 갱신 및 리렌더링 |
| `resize(width, height)` | 전체 4종 | 캔버스 크기 수동 재설정 및 `'resize'` 이벤트 발행 |
| `render(animate?: boolean)` | 전체 4종 | 전체 레이어 수동 리렌더링 |
| `replayAnimation()` | 전체 4종 | 등장 애니메이션 처음부터 재실행 |
| `resetZoom()` | `BarChart`, `LineChart` | 줌/팬 뷰포트를 전체 데이터 범위로 초기화 |
| `getEffectivePadding(w?, h?)` | 전체 4종 | 반응형 및 범례 예약 여백이 합산된 최종 `Padding` 반환 |
| `toSVG(exportOptions?: SvgExportOptions)` | 전체 4종 | Figma 호환 순수 벡터 SVG XML 문자열 반환 |
| `on(event, handler)` / `off(event, handler)` | 전체 4종 | 이벤트 구독 (`on`은 구독 해제 함수 반환) 및 해제 |
| `destroy()` | 전체 4종 | `ResizeObserver`, `window` 리스너, rAF, DOM 요소, 이벤트 완전 해제 |

### 5.2 이벤트 맵

| 이벤트명 | `BarChart` | `LineChart` | `PieChart` | `FunnelChart` |
| :--- | :--- | :--- | :--- | :--- |
| `'hover'` | `{ item, index, seriesKey?, geometry } \| null` | `{ item, index, seriesKey?, point } \| null` | `{ item, index, slice } \| null` | `{ item, index, stage } \| null` |
| `'resize'` | `{ width, height, isCompact }` | `{ width, height, isCompact }` | `{ width, height, isCompact }` | `{ width, height, isCompact }` |
| `'legendToggle'` | `{ item, active }` | `{ item, active }` | `{ item, active }` | `{ item, active }` |
