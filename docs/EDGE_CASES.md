# 엣지 케이스 방어 로직 명세서 (`docs/EDGE_CASES.md`)

> **문서 목적:** `@ju9nu7/nanocharts` (`v0.1.16`)의 실제 소스 코드에 구현된 경계값·예외 입력 방어 로직을 항목별로 정리합니다.

---

## 1. 빈 배열 (`[]`) 및 데이터 부재

| 대상 모듈 | 방어 로직 |
| :--- | :--- |
| `BarChart` / `LineChart` | `options.data || []`, `options.series || []`로 안전 폴백. `xScale.setDomainCount(0)` 시 `getVisibleCount()`는 `0`, `step()`은 `0`, `invert()`는 `-1` 반환. `BarSeries`/`LineSeries`는 `data.length === 0 \|\| start > end`일 때 즉시 return. |
| `PieSeries` | `data.length === 0`이고 `maxValue`도 없으면 `calculateSlices()`가 `[]` 반환. `render()`·`toSvgElements()`·`handleHover()`는 `slices.length === 0`일 때 즉시 return. |
| `FunnelSeries` | `data.length === 0`이면 `calculateStages()`가 `[]` 반환, `render()`·`toSvgElements()` 즉시 return. |
| `Legend` | 활성 아이템이 `0`개이면 `display: none` 처리 및 `getReservedPadding()`이 `{}` 반환. |
| 줌/팬 (`BarChart`, `LineChart`) | `totalCount === 0` 또는 `step <= 0`이면 `handleZoom()`·`handlePan()` 즉시 return. |

---

## 2. `null` / `undefined` / `NaN` / `Infinity` 값

| 대상 모듈 | 방어 로직 |
| :--- | :--- |
| `LinearScale` | `scale()`·`invert()`에서 `!Number.isFinite(value)` 또는 도메인/범위가 유한하지 않으면 각각 `r0`, `d0` 반환. `ticks()`는 비유한 도메인에 `[0]` 반환, `maxTicks = 500` 상한으로 무한 루프 방지. |
| `BarChart` / `LineChart` | `initScales()`에서 `typeof val !== 'number' \|\| !Number.isFinite(val)` 항목은 min/max 계산에서 스킵. 다중 시리즈 정규화 시 누락 인덱스(`undefined`)는 `value: 0`으로 채움. |
| `BarSeries` / `LineSeries` | `BarSeries`는 비유한 `item.value`를 `0`으로 치환하고 라벨은 `'-'` 표시. `LineSeries`는 비유한 포인트를 경로 계산에서 건너뛰고 라벨은 `'-'` 표시. |
| `PieSeries` / `FunnelSeries` | `safeVal(v)` 헬퍼로 `typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0` 처리. |
| `Tooltip` | `formatSafeValue()`에서 `NaN`/`Infinity`/`null`/`undefined`를 `'-'`로 포맷하고, `escapeHtml()`로 모든 라벨/값의 HTML 특수문자(`&`, `<`, `>`, `"`, `'`)를 이스케이프해 XSS를 차단. |
| `svg.ts` | `fmt(n)`은 `!Number.isFinite(n)`이면 `'0'` 반환. |

---

## 3. 동일 값 (`max - min === 0`) 및 전체 `0` 데이터

| 대상 모듈 | 방어 로직 |
| :--- | :--- |
| `LinearScale` | `d1 === d0`일 때 `scale()`은 `r0` 반환(0 나눗셈 방지), `ticks()`는 `[rawD0]` 반환, `nice()`는 도메인 변경 없이 즉시 반환. |
| `BarChart` / `LineChart` | 모든 유효 값이 `0`이어서 `maxVal === 0 && minVal === 0`인 경우 `maxVal = 100`으로 보정하여 `[0, 110]` → `.nice(5)`로 정상 축을 유지. |
| `PieSeries` | `baseTotal <= 0`이면 `[]` 반환. 단일 항목 100%(`sweep >= 2π - 0.0001`)인 경우 `buildSvgPieSlicePathData()`에서 두 개의 반원 아크로 분할하여 SVG 아크 소실 방지. |
| `FunnelSeries` | `maxVal = Math.max(1, ...)` 및 `firstVal = Math.max(1, ...)`로 0 나눗셈 방지. `prevVal = Math.max(1, ...)`로 전환율 계산 시 `Infinity`/`NaN` 방지. |

---

## 4. 음수 데이터 처리

| 대상 모듈 | 방어 로직 |
| :--- | :--- |
| `BarChart` / `LineChart` | `minVal < 0`이면 `yMin = minVal * 1.1`로 하단 여유를 확보하고 `0` 기준선을 포함. `BarChart`의 `percent` 모드에서 음수가 존재하면 Y축 도메인을 `[-100, 100]`으로 자동 확장. |
| `BarSeries` | 양수는 `baseZero` 위로, 음수는 `baseZero` 아래로 바를 생성. `stacked`/`percent` 모드에서는 양수 누적(`posAcc`)과 음수 누적(`negAcc`)을 별도 추적. |
| `drawRoundedRect` (`canvas.ts`) | `height < 0`이면 `actualY = y + height`, `actualHeight = -height`로 보정하고, 각 모서리 반지름을 `Math.min(width / 2, actualHeight / 2)`로 클램핑하여 도형 뒤집힘 방지. |
| `PieSeries` / `FunnelSeries` | 비율/면적 시각화 특성상 음수는 `Math.max(0, v)`로 `0` 클램핑. |

---

## 5. 긴 라벨 및 좁은 공간 처리

| 대상 모듈 | 방어 로직 |
| :--- | :--- |
| `Axis.renderYAxis` | `maxLabelWidth = Math.max(12, padding.left - labelOffset - 2)`를 초과하면 이진 탐색 기반 `truncateText()`로 말줄임(`…`) 처리. |
| `Axis.renderXAxis` | 뷰포트 내 최대 24개 라벨을 샘플링해 `maxTextWidth`를 측정하고, `cappedSampleWidth = Math.min(maxTextWidth, Math.max(48, plotWidth * 0.45))`를 기준으로 `labelInterval`을 자동 산출해 겹침을 방지하며, 슬롯 폭을 넘는 텍스트는 `truncateText()`로 말줄임. |
| `BarSeries` | 바 너비가 `14px` 미만이면 데이터 라벨 렌더링을 스킵. `stacked` 모드에서 `top-outside`가 아닌 라벨은 바 높이가 `15px` 이상일 때만 표시. |
| `BarChart` 호버 | 바 너비가 `12px` 미만으로 얇을 때 좌우 패딩(`hitPad = (12 - width) / 2`)을 부여해 최소 `12px` 히트 영역 보장. |
| `LineSeries` | 뷰포트 내 표시 포인트가 `80`개를 초과하면 정적 포인트 마커 숨김, `45`개를 초과하면 데이터 라벨 숨김. |
| `PieSeries` | 비중이 `4%` (`0.04`) 미만인 조각 및 `isTrack` 조각은 라벨 겹침 방지를 위해 라벨 스킵. 평행 간격(`sliceGap`) 적용 시 좁은 조각에서 양 평행 경계선이 내부 아크 도달 전에 교차하면 교점(`r = halfGap / sin(sweep / 2)`)으로 수렴시키고, 극소 조각은 외곽 아크가 소실되지 않도록 `halfGap`을 상한 클램핑. |
| `Tooltip` | `positionTooltip()`에서 컨테이너 좌우 경계(`edgePadding: 8px`)로 X 좌표를 클램핑하고, 상단 공간이 부족하면 커서 하단으로 자동 반전(Flip). |

---

## 6. 컨테이너 크기 `0`, 비가시 상태 및 SSR 환경

| 시나리오 | 방어 로직 |
| :--- | :--- |
| **컨테이너 `width <= 0` (`display: none` 등)** | `resolveContainerDimensions()`가 DOM 스타일(`minHeight`)을 변형하지 않고 `{ width: 0, height: 0, isCompact: false }` 반환. `resize()`·`render()`·`LayerManager.resize()` 모두 `width <= 0 \|\| height <= 0 \|\| !Number.isFinite(...)`이면 즉시 return. |
| **컨테이너 높이 `0` (CSS `height` 미지정)** | `width > 0`이고 `rawHeight <= 10`이면 `aspectRatio`와 `minHeight`(`200px`)로 자동 높이를 산출하고 `container.style.minHeight`를 설정. 최소 크기는 `Math.max(120, ...)` 보장. |
| **플롯 영역 역전 방지** | `syncScaleRanges()`에서 `Math.max(eff.left + 20, width - eff.right)`, `Math.max(eff.top + 20, height - eff.bottom)`으로 최소 `20px` 플롯 크기 보장. |
| **SSR (Node.js / 비브라우저 환경)** | 4종 차트 및 `LayerManager` 생성자에서 `typeof window === 'undefined' \|\| typeof document === 'undefined'` 체크 후 명시적 `Error` 발생. `resolveColor()`는 `try/catch`로 `getComputedStyle` 예외를 무시하고 내장 토큰 폴백. |
| **잘못된 DOM 선택자** | `document.querySelector(container)`가 `null`이면 `Invalid container element or selector` 에러를 즉시 발생. |
