# `@ju9nu7/nanocharts`

> **문서 목적:** `@ju9nu7/nanocharts` (`v0.1.16`)의 핵심 특징, 설치 방법, 즉시 실행 가능한 차트별 예제, API 요약 및 Figma 플러그인 연동 방법을 안내합니다.

`@ju9nu7/nanocharts`는 런타임 외부 의존성이 없는(Zero Dependency) 순수 TypeScript + Canvas 2D 기반 초경량 차트 라이브러리입니다. 3단 멀티 레이어 Canvas 아키텍처와 $O(1)$ 히트 테스팅으로 대용량 데이터에서도 60fps 인터랙션을 유지하며, 디자인 토큰(`var(--*)`) 해석과 Figma 호환 순수 벡터(`toSVG()`) 추출을 기본 지원합니다.

---

## 핵심 특징

- **Zero Runtime Dependency**: `package.json` 기준 런타임 `dependencies`·`peerDependencies`가 전혀 없는 순수 바닐라 TypeScript/Canvas 2D 엔진입니다. (ES Module `./dist/index.js` 및 CommonJS `./dist/index.cjs` 듀얼 번들, `sideEffects: false`)
- **3단 멀티 레이어 Canvas (`LayerManager`)**: `background`(그리드·축), `series`(데이터 도형), `interaction`(호버 하이라이트·크로스헤어) 3개 Canvas를 분리해 마우스 이동 시 전체 데이터를 다시 그리지 않습니다.
- **고성능 데이터 처리**: `BandScale.invert()` 기반 $O(1)$ 인덱스 역산, 뷰포트 컬링(Viewport Culling), `LineSeries` LTTB(Largest-Triangle-Three-Buckets) 다운샘플링(기본 임계치 `600`)을 내장합니다.
- **디자인 시스템 & Figma 연동**: `DESIGN_TOKENS`, `RADIUS_TOKENS`, `SPACING_TOKENS`를 내장하여 `var(--primary)` 등 CSS 변수를 웹 Canvas와 Figma Local Variables 양쪽에서 일관되게 해석하며, 모든 차트에서 `toSVG()` 벡터 추출을 지원합니다.
- **반응형 & 터치 대응**: `ResizeObserver` 기반 자동 리사이즈, `aspectRatio` 기반 높이 자동 계산, 브레이크포인트(`compactBreakpoint: 480`) 여백 보정, 모바일 `touchstart`/`touchmove` 인터랙션을 제공합니다.

---

## 현재 지원 차트 목록

| 차트 클래스 | 파일 위치 | 주요 지원 기능 |
| :--- | :--- | :--- |
| `BarChart` | `src/core/Chart.ts` | 단일/다중 시리즈(`grouped`, `stacked`, `percent`), 그라데이션, 조건부 컬러링, 개별 모서리 둥글기, 테두리, 수치 라벨, 휠 줌 & 드래그 팬, `toSVG()` |
| `LineChart` | `src/core/LineChart.ts` | 단일/다중 라인 & 누적 영역(`stacked`), `smooth`/`linear`/`step` 보간, Area HSL 채도·명도·투명도 그라데이션, LTTB 다운샘플링, 크로스헤어, 휠 줌 & 드래그 팬, `toSVG()` |
| `PieChart` | `src/core/PieChart.ts` | 파이/도넛 전환(`innerRadiusRatio`), 목표 최대값 배경 트랙(`maxValue`/`trackColor`), 극좌표 히트 테스팅, Lerp 호버 팝아웃(`hoverExplode`), 리더라인 라벨, 도넛 중앙 요약 텍스트, `toSVG()` |
| `FunnelChart` | `src/core/FunnelChart.ts` | 상하(`vertical`)/좌우(`horizontal`) 방향, 사다리꼴(`trapezoid`)/바(`bar`) 형태, 단계 간격(`gap`), 직전/최초 단계 대비 전환율(`%`) 자동 표시, Ray-casting 히트 테스팅, `toSVG()` |

---

## 설치 방법

```bash
npm install @ju9nu7/nanocharts
# or
yarn add @ju9nu7/nanocharts
# or
pnpm add @ju9nu7/nanocharts
```

---

## 빠른 시작 (Quick Start)

### 1. BarChart (단일 / 다중 시리즈)

```typescript
import { BarChart } from '@ju9nu7/nanocharts';

const bar = new BarChart('#bar-chart', {
  data: [
    { label: 'Q1', value: 120 },
    { label: 'Q2', value: 240 },
    { label: 'Q3', value: 180 },
    { label: 'Q4', value: 310 },
  ],
  bar: {
    borderRadius: [6, 6, 0, 0],
    fill: { type: 'linear', from: '#6366F1', to: '#9333EA', direction: 'vertical' },
    widthRatio: 0.6,
  },
  labels: { visible: true, position: 'top-outside' },
  zoom: { enabled: true },
  pan: { enabled: true },
});
```

```typescript
// 다중 시리즈 (grouped | stacked | percent)
const multiBar = new BarChart('#multi-bar', {
  xLabels: ['1분기', '2분기', '3분기', '4분기'],
  series: [
    { name: 'Frontend', data: [120, 150, 180, 210], color: '#6366F1' },
    { name: 'Backend', data: [90, 110, 140, 160], color: '#10B981' },
  ],
  bar: { mode: 'stacked', borderRadius: [6, 6, 0, 0] },
  legend: { visible: true, position: 'top-right' },
});
```

### 2. LineChart (라인 & 영역 / 누적 영역)

```typescript
import { LineChart } from '@ju9nu7/nanocharts';

const line = new LineChart('#line-chart', {
  data: [
    { label: 'Mon', value: 140 },
    { label: 'Tue', value: 230 },
    { label: 'Wed', value: 195 },
    { label: 'Thu', value: 290 },
    { label: 'Fri', value: 340 },
  ],
  font: { family: 'Pretendard, sans-serif', size: 11, weight: 500 },
  line: { color: 'var(--primary)', width: 2.5, curve: 'smooth' },
  area: {
    visible: true,
    topOpacity: 0.45,
    bottomOpacity: 0.02,
    saturationDelta: 15,
    lightnessDelta: 10,
  },
  grid: {
    y: { visible: true, style: 'dashed', lineWidth: 1, color: 'var(--outline)' },
    x: { visible: true, style: 'dotted', lineWidth: 1, color: 'var(--outline-low)' },
    border: { visible: true, color: 'var(--outline)', radius: 4 },
    alternateBand: { visible: true, color: 'rgba(233, 236, 239, 0.35)' },
  },
  crosshair: { enabled: true, vertical: true, horizontal: true },
});
```

### 3. PieChart (파이 & 도넛)

```typescript
import { PieChart } from '@ju9nu7/nanocharts';

const pie = new PieChart('#pie-chart', {
  data: [
    { label: 'Frontend', value: 45 },
    { label: 'Backend', value: 30 },
    { label: 'DevOps', value: 15 },
    { label: 'Design', value: 10 },
  ],
  pie: {
    innerRadiusRatio: 0.6,
    padAngle: 0.03,
    hoverExplode: 8,
  },
  center: { title: '100%', subtitle: '전체 점유율' },
  labels: { position: 'outside' },
});
```

### 4. FunnelChart (상하/좌우 퍼널 & 전환율)

```typescript
import { FunnelChart } from '@ju9nu7/nanocharts';

const funnel = new FunnelChart('#funnel-chart', {
  data: [
    { label: '방문', value: 1200 },
    { label: '회원가입', value: 820 },
    { label: '장바구니', value: 540 },
    { label: '구매완료', value: 310 },
  ],
  funnel: {
    direction: 'vertical', // 'vertical' | 'horizontal'
    shape: 'trapezoid',    // 'trapezoid' | 'bar'
    gap: 4,
    showConversion: true,
    conversionBase: 'previous',
  },
  legend: { visible: true, position: 'top-center' },
});
```

### 5. Figma 호환 SVG 벡터 추출 (`toSVG`)

```typescript
const svgString = bar.toSVG({
  width: 640,
  height: 400,
  backgroundColor: '#151C2C',
  backgroundRadius: 16,
  includeLegend: true,
  includeGrid: true,
});
```

---

## Figma Plugin 연동

`figma-plugin/` 디렉토리에 `@ju9nu7/nanocharts` 엔진이 내장된 Figma 벡터 차트 플러그인이 포함되어 있습니다.

- **지원 Figma Variable 컬렉션**: `1.Color Palette`, `2.Color token`, `3.Color token - point`, `4.Radius`, `5.Spacing`
- **등록 방법**: Figma 데스크톱 앱 → `Plugins` → `Development` → `Import plugin from manifest...` → `figma-plugin/manifest.json` 선택

---

## 빌드 및 배포 명령어

> Windows PowerShell에서 `npm.ps1` 실행 정책 제한이 있는 경우 `npm.cmd`를 사용합니다.

```bash
# 로컬 데모 개발 서버 실행 (Vite)
npm.cmd run dev

# 라이브러리 프로덕션 빌드 (tsc && vite build -> dist/)
npm.cmd run build

# 라이브러리 + Figma 플러그인(figma-plugin/dist/) 통합 빌드
npm.cmd run build:figma

# 패치 버전 자동 증가 (예: 0.1.8 -> 0.1.9)
npm.cmd version patch --no-git-tag-version

# Figma 플러그인 빌드 후 Git 커밋 및 푸시 (OTA)
npm.cmd run deploy:figma

# npm 패키지 정식 배포 (prepublishOnly 훅으로 build:figma 자동 실행)
npm.cmd publish --access public
```

---

## 상세 문서 안내

| 문서 | 설명 |
| :--- | :--- |
| [docs/API.md](docs/API.md) | 공통 Props, 차트별 고유 옵션, 데이터 포맷, 커스텀 렌더러 시그니처, 메서드 및 이벤트 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 디렉토리 구조, 데이터→스케일→렌더링→인터랙션 파이프라인, 상태 및 성능 최적화 구조 |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | 컬러 팔레트·디자인 토큰, 폰트, 여백 및 반응형 보정, 축/그리드/범례 규칙, 스타일 격리 |
| [docs/EDGE_CASES.md](docs/EDGE_CASES.md) | 빈 배열, `null`/`NaN`, 동일 값, 음수, 긴 라벨, 컨테이너 크기 `0`, SSR 방어 로직 |
| [docs/WORK_LOG.md](docs/WORK_LOG.md) | 세션 간 변경 이력 및 작업 맥락 누적 로그 |

---

## License

MIT License
