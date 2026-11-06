# `@ju9nu7/nanocharts` (v0.1.2) 코드베이스 분석 및 다음 작업 가이드

> 작성일: 2026-11-03  
> 목적: 차트 라이브러리 개발을 이어서 진행하기 위한 현재 구현 상태, 코드 디테일 점검 결과, 다음 단계 작업 명세 기록

---

## 1. 현재 구현 완료 현황

### 코어 & 인프라 (`src/core/`, `src/scale/`, `src/utils/`)
- **`LayerManager` (`src/core/LayerManager.ts`)**
  - `background` (z-index: 1), `series` (z-index: 2), `interaction` (z-index: 3) 3중 Canvas 레이어 분리.
  - `window.devicePixelRatio` 기반 High-DPI 물리 픽셀 버퍼 및 `ctx.scale(dpr, dpr)` 자동 동기화.
- **`EventEmitter` (`src/core/EventEmitter.ts`)**
  - `on`, `off`, `emit`, `clear` 경량 이벤트 버스 (`hover` 이벤트 발행 중).
- **`BandScale` (`src/scale/BandScale.ts`)**
  - 이산형(Categorical) X축 스케일, `_viewStart` ~ `_viewEnd` 뷰포트 윈도우 가상화 지원.
  - `invert(pixel)` 메서드로 $O(1)$ 수학적 나눗셈 역산 구현.
- **`LinearScale` (`src/scale/LinearScale.ts`)**
  - 연속형 수치 Y축 스케일, 1-2-5 배수 기반 `ticks(count)` 및 `nice(count)` 도메인 보정 구현.
- **`canvas.ts` (`src/utils/canvas.ts`)**
  - `drawRoundedRect`: 4개 모서리 개별 반지름(`[TL, TR, BR, BL]`) 및 음수 높이 안전 처리.
  - `createGradient`: 수직(`vertical`) / 수평(`horizontal`) 선형 그라데이션 생성.

### 차트 시리즈 & 오케스트레이터 (`src/series/`, `src/core/`)
- **`BarChart` (`src/core/Chart.ts`) & `BarSeries` (`src/series/BarSeries.ts`)**
  - 뷰포트 컬링(`start` ~ `end` 인덱스만 렌더링), 양수/음수 양방향 바 렌더링.
  - 단색, 그라데이션, 조건부 함수(`ColorAccessor`) 채우기 및 대시 테두리(`BarBorderStyle`) 지원.
  - 데이터 라벨 위치 6종(`top-outside`, `inside-top`, `inside-center`, `inside-bottom`, `bottom-outside`, `none`) 및 `renderCustom` 콜백 지원.
  - 마우스 휠 커서 중심 줌(`handleZoom`) 및 드래그 팬(`handlePan`), 호버 하이라이트(`renderHighlight`).
- **`PieChart` (`src/core/PieChart.ts`) & `PieSeries` (`src/series/PieSeries.ts`)**
  - `innerRadiusRatio`를 통한 파이/도넛 차트 전환, 조각 간 여백(`padAngle`).
  - 극좌표(`Math.atan2` 및 반지름 거리) 기반 히트 테스팅 및 호버 팝아웃(`hoverExplode`).
  - 도넛 중앙 요약 텍스트(`PieCenterContentOptions`) 및 외부 리더라인(Leader line) / 내부 라벨 렌더링.

### 공통 컴포넌트 (`src/components/`)
- **`Axis` (`src/components/Axis.ts`)**: Y축 눈금 텍스트 및 X축 라벨 자동 간격 폴백(`measureText` 기반 겹침 방지).
- **`Grid` (`src/components/Grid.ts`)**: Y축 수평 점선/실선 그리드 렌더링 (`0.5px` 선명도 보정 포함).
- **`Tooltip` (`src/components/Tooltip.ts`)**: 블러 배경(`backdrop-filter`) 부동형 DOM 툴팁 및 커스텀 HTML `formatter`.

---

## 2. 기존 코드 보완 포인트 (Quick Fixes / Polish)

다음 작업 진행 시 함께 보완하면 좋은 디테일 항목들입니다:

1. **`BarSeries`의 `minWidth` / `maxWidth` 옵션 미적용**
   - `src/types/index.ts`의 `BarStyleOptions`에는 `maxWidth`, `minWidth`가 선언되어 있으나, `BarSeries.getBarGeometry()`에서는 `rawWidth * ratio`만 계산하고 클램핑을 하지 않고 있음.
2. **`BarChart`의 `window` 이벤트 리스너 메모리 누수 방지**
   - `BarChart.setupInteractions()`에서 `window.addEventListener('mouseup', ...)`를 익명 함수로 등록하고 있어 `destroy()` 호출 시 해제되지 않음. 핸들러를 멤버로 보관해 `destroy()`에서 `window.removeEventListener` 호출 필요.
3. **`Grid` 컴포넌트의 수직선(`GridOptions.x`) 미구현**
   - 타입에는 `grid.x`, `grid.y`가 모두 정의되어 있으나 `Grid.render()`는 현재 `options.y`만 그리고 있음.
4. **`PieSeries`의 `cornerRadius` 미적용**
   - `PieStyleOptions.cornerRadius`가 타입에 정의되어 있으나 `drawSingleSlice`에서 일반 `ctx.arc`만 사용 중.
5. **데모 페이지(`index.html`, `demo/main.ts`)의 `PieChart` 쇼케이스 부재**
   - `PieChart`가 구현되어 있으나 데모 화면에는 `BarChart`만 마운트되어 있어, 탭 전환 또는 멀티 차트 대시보드 형태로 데모를 확장하면 테스트와 프리뷰가 훨씬 편리해짐.

---

## 3. 다음 단계 로드맵 (우선순위 제안)

### Step A: `LineChart` / `AreaChart` 신규 추가 (로드맵 1순위)
1. **타입 정의 (`src/types/index.ts`)**:
   - `LineStyleOptions` (`strokeColor`, `lineWidth`, `smooth` 곡선 여부, `lineDash`, `areaFill` 그라데이션/단색, `point` 마커 옵션)
   - `LineChartOptions` (`data`, `padding`, `line`, `labels`, `grid`, `xAxis`, `yAxis`, `tooltip`, `crosshair`, `zoom`, `pan`)
2. **시리즈 렌더러 (`src/series/LineSeries.ts`)**:
   - 직선 연결 및 Monotone Cubic / Catmull-Rom 베지에 곡선(`smooth: true`) 드로잉
   - 하단 영역 채우기(`areaFill` - 선형 그라데이션 연동)
   - 데이터 포인트 심볼(원형 마커) 및 호버 시 활성 포인트 강조 + 수직 크로스헤어(Crosshair) 가이드라인
3. **메인 클래스 (`src/core/LineChart.ts`)**:
   - `BandScale` (또는 포인트 위치) 기반 $O(1)$ X축 최근접 인덱스 역산 히트 테스팅
   - 마우스 휠 줌 & 드래그 팬 지원
4. **Export 및 데모 연동 (`src/index.ts`, `demo/main.ts`)**

### Step B: `Legend` (범례) 컴포넌트 및 데이터 토글
- 차트 상단/하단/우측 범례 렌더링 및 클릭 시 특정 항목/시리즈 숨김·표시 토글.

### Step C: `Animation` 엔진
- `requestAnimationFrame` + Easing 함수(`easeOutCubic` 등)를 활용해 최초 렌더링 시 바 상승, 파이 회전, 라인 드로잉 애니메이션 지원.
