# `@ju9nu7/nanocharts` 코드베이스 구현 현황 분석 (`v0.1.21`)

> **문서 목적:** 현재 코드베이스(`src/`, `figma-plugin/`, `scripts/`)에 실제로 구현되어 동작하는 모듈과 핵심 기능을 요약합니다. 상세 API·아키텍처·디자인 시스템·엣지 케이스 명세는 `docs/` 하위 문서를 참조하세요.

---

## 1. 코어 및 인프라 (`src/core/`, `src/scale/`, `src/utils/`)

- **`LayerManager` (`src/core/LayerManager.ts`)**
  - `background`(`z-index: 1`), `series`(`z-index: 2`), `interaction`(`z-index: 3`) 3중 Canvas 레이어를 생성 및 관리합니다.
  - `window.devicePixelRatio`를 반영해 물리 픽셀 버퍼와 `ctx.scale(dpr, dpr)` 논리 좌표계를 동기화합니다.
- **`Animator` (`src/core/Animator.ts`)**
  - `requestAnimationFrame` 기반 애니메이션 루프와 5종 이징 함수(`linear`, `easeOutCubic`, `easeOutQuart`, `easeOutExpo`, `easeOutBack`) 및 커스텀 이징 함수를 지원합니다.
- **`EventEmitter` (`src/core/EventEmitter.ts`)**
  - 제네릭 이벤트 맵(`BarChartEventMap`, `LineChartEventMap`, `PieChartEventMap`, `DonutChartEventMap`, `FunnelChartEventMap`) 기반의 타입 안전 이벤트 버스(`on`, `off`, `emit`, `clear`)를 제공합니다.
- **`LinearScale` (`src/scale/LinearScale.ts`)**
  - 연속형 수치 도메인과 픽셀 범위 간 선형 변환(`scale`, `invert`), 1-2-5 배수 기반 `ticks(count)` 및 `nice(count)` 도메인 보정을 구현합니다.
- **`BandScale` (`src/scale/BandScale.ts`)**
  - 이산형 X축 슬롯 스케일로 뷰포트 윈도우(`setViewport`, `getViewport`) 가상화와 $O(1)$ 수학적 나눗셈 역산(`invert`)을 제공합니다.
- **유틸리티 (`src/utils/`)**
  - `canvas.ts`: 4개 모서리 개별 반지름 및 음수 높이 보정을 지원하는 `drawRoundedRect`, 수직/수평 `createGradient`.
  - `tokens.ts`: `DESIGN_TOKENS`, `RADIUS_TOKENS`, `SPACING_TOKENS` 사전, `normalizeTokenKey`, `toFigmaVariableName`, `resolveColor`, `parseColorToRgba`, `adjustColorHsl`, `buildCssFontString`.
  - `responsive.ts`: `normalizeResponsiveOptions`, `resolveContainerDimensions`, `computeResponsivePadding`.
  - `svg.ts`: `figma.createNodeFromSvg` 호환 순수 벡터 SVG 생성 유틸리티(`svgRoundedRectElement`, `buildSvgLinePathData`, `buildSvgPieSlicePathData`, `buildSvgGridGroup`, `buildSvgAxesGroups`, `buildSvgLegendGroup`, `wrapSvgDocument`).

---

## 2. 차트 오케스트레이터 및 시리즈 (`src/core/`, `src/series/`)

- **`BarChart` (`src/core/Chart.ts`) & `BarSeries` (`src/series/BarSeries.ts`)**
  - 단일 시리즈 및 다중 시리즈(`grouped`, `stacked`, `percent`), 픽셀 요소 간격(`bar.barGap`), 뷰포트 컬링, 양수/음수 양방향 바 렌더링, 조건부 컬러링(`ColorAccessor`), 테두리(`BarBorderStyle`), 6종 데이터 라벨 위치·독립 간격(`labels.offset`) 및 `renderCustom` 콜백을 지원합니다.
  - 마우스 휠 커서 중심 줌, 드래그 팬, 모바일 터치 호버/팬, `toSVG()` 벡터 추출을 구현합니다.
- **`LineChart` (`src/core/LineChart.ts`) & `LineSeries` (`src/series/LineSeries.ts`)**
  - 단일/다중 라인 및 누적 영역(`stacked: true`), `smooth`/`linear`/`step` 보간, Area HSL 채도·명도·투명도 그라데이션, `downsampleLTTB` 다운샘플링(기본 임계치 `600`), 수직/수평 크로스헤어, 휠 줌 & 드래그 팬, `toSVG()`를 구현합니다.
- **`PieChart` (`src/core/PieChart.ts`), `DonutChart` (`src/core/DonutChart.ts`) & `PieSeries` (`src/series/PieSeries.ts`)**
  - 순수 파이(`PieChart`)와 도넛 전용(`DonutChart`, 기본 `innerRadiusRatio: 0.6`, `donut` 옵션) 클래스를 분리 제공하며 `innerRadiusRatio` 기반 하위 호환도 유지합니다.
  - 일정한 평행 픽셀 간격(`sliceGap`), `maxValue`/`trackColor` 잔여 트랙, 극좌표 히트 테스팅, rAF Lerp 기반 `hoverExplode`, 내부/외부 라벨(`offset`, 5종 `format`), 도넛 중앙 요약 텍스트, `toSVG()`를 구현합니다.
- **`FunnelChart` (`src/core/FunnelChart.ts`) & `FunnelSeries` (`src/series/FunnelSeries.ts`)**
  - `vertical`/`horizontal` 진행 방향, `trapezoid`/`bar` 도형, `gap`/`minSizeRatio`/`neckStyle`, 직전/최초 단계 대비 전환율(`%`), Ray-casting 다각형 히트 테스팅, `toSVG()`를 구현합니다.

---

## 3. 공통 컴포넌트 (`src/components/`)

- **`Axis` (`src/components/Axis.ts`)**: Y축 눈금 및 X축 라벨 렌더링, 이진 탐색 기반 `truncateText` 말줄임, 최대 24개 샘플링 기반 라벨 겹침 방지 간격 계산.
- **`Grid` (`src/components/Grid.ts`)**: Y/X 격자선(`solid`/`dashed`/`dotted`, `opacity`, `lineWidth`, `0.5px` 선명도 보정), 줄무늬 배경(`alternateBand`), 플롯 외곽 박스(`border`).
- **`Tooltip` (`src/components/Tooltip.ts`)**: 단일(`show`) 및 다중 시리즈 통합(`showMulti`) 부동형 DOM 툴팁, XSS 방어(`escapeHtml`), 컨테이너 좌우 클램핑 및 상하 자동 반전.
- **`Legend` (`src/components/Legend.ts`)**: 12방향 앵커 배치(`parseLegendAnchor`), 4종 마커(`circle`/`rounded`/`square`/`line`), 클릭 데이터 토글 및 양방향 호버 하이라이트 연동.

---

## 4. 패키징 및 Figma 플러그인 (`figma-plugin/`, `scripts/`)

- **패키지 번들**: `vite.config.ts` + `vite-plugin-dts`로 ES(`dist/index.js`), CJS(`dist/index.cjs`), 타입 선언(`dist/index.d.ts`, `dist/index.d.cts`) 생성.
- **Figma 플러그인**: `scripts/build-figma-plugin.mjs`로 `figma-plugin/src/code.ts` 및 `ui.template.html`을 `figma-plugin/dist/`로 번들링.

---

## 5. 상세 스펙 문서 링크

- [docs/API.md](docs/API.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- [docs/EDGE_CASES.md](docs/EDGE_CASES.md)
- [docs/WORK_LOG.md](docs/WORK_LOG.md)
