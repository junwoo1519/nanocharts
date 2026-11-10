# NanoCharts 📊

> **Ultra-lightweight, High-performance, and Designer-friendly Canvas Chart Library.**

`nanocharts`는 수만 개의 대용량 데이터에서도 60fps의 부드러운 반응성을 유지하며, 디자이너가 의도한 정교한 UI(그라데이션, 모서리 라운딩, 자유로운 라벨 위치 등)를 100% 코드로 구현할 수 있는 초경량 Canvas 차트 엔진입니다.

---

## ✨ Features

- ⚡ **극강의 렌더링 성능**: 3단 멀티 레이어 Canvas 아키텍처로 수천~수만 개의 데이터 포인트에서도 부드러운 줌 & 팬 지원.
- 🎯 **$O(1)$ 히트 테스팅**: 마우스 호버 시 전체 데이터를 순회하지 않고 즉각 타겟 인덱스를 역산해 렉 없는 상호작용 보장.
- 🎨 **디자이너 친화적 커스텀 자유도**:
  - **둥근 모서리(`borderRadius`)**: 상단만 둥글게, 캡슐형 등 자유 조절
  - **선형 그라데이션**: 수평/수직 그라데이션 및 데이터 기반 **조건부 색상 콜백** 지원
  - **라벨 위치 완전 자유화**: `top-outside`, `inside-top`, `inside-center`, `inside-bottom` 등
  - **테두리(Border)**: 색상, 굵기, 대시선 스타일 커스텀
- 📦 **Zero Dependency & 초경량**: 외부 무거운 프레임워크 의존성 없이 번들 크기 최소화.
- 💻 **TypeScript First**: 모든 옵션과 콜백에 대한 완벽한 타입 지원.

---

## 🚀 Installation

```bash
npm install @ju9nu7/nanocharts
# or
yarn add @ju9nu7/nanocharts
# or
pnpm add @ju9nu7/nanocharts
```

---

## 📖 Quick Start

### 1. Bar Chart (바 차트)
```typescript
import { BarChart } from '@ju9nu7/nanocharts';

const chart = new BarChart('#chart', {
  data: [
    { label: 'Q1', value: 120 },
    { label: 'Q2', value: 240 },
    { label: 'Q3', value: 180 },
    { label: 'Q4', value: 310 },
  ],
  bar: {
    borderRadius: [6, 6, 0, 0],
    fill: {
      type: 'linear',
      from: '#6366F1',
      to: '#9333EA',
    },
    widthRatio: 0.6,
  },
  labels: { visible: true, position: 'top-outside' },
  zoom: { enabled: true },
  pan: { enabled: true },
});
```

### 2. Line & Area Chart (라인 & 영역 차트)
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
  line: {
    color: '#6366F1',
    width: 2.5,
    curve: 'smooth', // 'smooth' | 'linear' | 'step'
  },
  area: {
    visible: true,
    fill: {
      type: 'linear',
      from: 'rgba(99, 102, 241, 0.45)',
      to: 'rgba(99, 102, 241, 0.0)',
      direction: 'vertical',
    },
  },
  crosshair: { enabled: true, vertical: true, horizontal: true },
  zoom: { enabled: true },
  pan: { enabled: true },
});
```

### 3. Pie & Donut Chart (파이 & 도넛 차트)
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
    innerRadiusRatio: 0.6, // 0이면 파이 차트, 0.6이면 세련된 도넛 차트!
    padAngle: 0.03,        // 조각 사이의 여백
    hoverExplode: 8,       // 마우스 호버 시 밖으로 팝아웃되는 거리
  },
  center: {
    title: '100%',
    subtitle: '전체 점유율',
  },
  labels: { position: 'outside' },
});
```

### 4. Multi-Series & Stacked Chart (다중 시리즈 & 누적 차트)
```typescript
import { BarChart, LineChart } from '@ju9nu7/nanocharts';

// 1) 그룹형(Grouped) / 누적형(Stacked) / 100% 비율(Percent) 바 차트
const multiBar = new BarChart('#multi-bar', {
  xLabels: ['1분기', '2분기', '3분기', '4분기'],
  series: [
    { name: 'Frontend', data: [120, 150, 180, 210], color: '#6366F1' },
    { name: 'Backend', data: [90, 110, 140, 160], color: '#10B981' },
    { name: 'AI / Cloud', data: [60, 85, 110, 145], color: '#F59E0B' },
  ],
  bar: {
    mode: 'stacked', // 'grouped' | 'stacked' | 'percent'
    borderRadius: [6, 6, 0, 0],
  },
  legend: { visible: true, position: 'top' },
  animation: { enabled: true, duration: 680, easing: 'easeOutQuart' },
});

// 2) 다중 라인(Multi-Line) & 누적 영역(Stacked Area) 차트
const multiLine = new LineChart('#multi-line', {
  xLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  stacked: true, // true 설정 시 누적 영역(Stacked Area) 차트로 동작
  series: [
    { name: '모바일 트래픽', data: [140, 230, 195, 290, 340], color: '#6366F1' },
    { name: '데스크톱 트래픽', data: [95, 130, 160, 185, 210], color: '#22D3EE', dash: [6, 4] },
  ],
});
```

### 5. Funnel Chart (퍼널 차트 — 상하/좌우 방향 & 전환율)
```typescript
import { FunnelChart } from '@ju9nu7/nanocharts';

const funnel = new FunnelChart('#funnel-chart', {
  data: [
    { label: '방문', value: 1200 },
    { label: '회원가입', value: 820 },
    { label: '장바구니', value: 540 },
    { label: '구매완료', value: 310 },
  ],
  font: {
    family: 'Pretendard, Inter, sans-serif',
    size: 12,
    weight: 600,
  },
  funnel: {
    direction: 'vertical', // 'vertical' (상->하 기본) | 'horizontal' (좌->우)
    shape: 'trapezoid',    // 'trapezoid' (사다리꼴) | 'bar' (단계별 바)
    gap: 4,
    showConversion: true,  // 단계별 전환율(%) 자동 표시
  },
  legend: {
    visible: true,
    position: 'top-right', // 상좌/상중/상우, 하좌/하중/하우, 좌상/좌중/좌하, 우상/우중/우하 12방향 지원
  },
});
```

### 6. Area 그라데이션 채도·명도 조절 & 그리드 선 커스텀
```typescript
const customLine = new LineChart('#custom-line', {
  data,
  font: { family: 'Pretendard, sans-serif', size: 11, weight: 500 },
  line: { color: 'var(--primary)', width: 2.5, curve: 'smooth' },
  area: {
    visible: true,
    topOpacity: 0.45,
    bottomOpacity: 0.02,
    saturationDelta: 15, // 원본 선 색상 대비 채도 +15%
    lightnessDelta: 10,  // 원본 선 색상 대비 명도 +10%
  },
  grid: {
    y: { visible: true, style: 'dashed', lineWidth: 1, color: 'var(--outline)' },
    x: { visible: true, style: 'dotted', lineWidth: 1, color: 'var(--outline-low)' },
    border: { visible: true, color: 'var(--outline)', radius: 4 },
    alternateBand: { visible: true, color: 'rgba(233, 236, 239, 0.35)' },
  },
  legend: { visible: true, position: 'bottom-center' },
});
```

---

## 🎨 Designer Customization Examples

### 1. 조건부 컬러링 (값에 따른 동적 색상 변경)

```typescript
bar: {
  fill: (item) => {
    if (item.value >= 80) return '#10B981'; // 목표 달성: 에메랄드 그린
    if (item.value < 40) return '#EF4444';  // 경고: 레드
    return '#6366F1';                       // 기본: 인디고
  }
}
```

### 2. 네온 테두리 & 사이버펑크 스타일

```typescript
bar: {
  fill: '#0891B2',
  border: {
    color: '#22D3EE',
    width: 2,
    dash: [4, 2], // 대시 테두리 지원
  },
  borderRadius: 8,
}
```

### 3. 바 내부 중앙 뱃지형 라벨

```typescript
labels: {
  visible: true,
  position: 'inside-center',
  font: '700 12px Pretendard, sans-serif',
  color: '#FFFFFF',
}
```

### 4. 인터랙티브 범례(Legend) & 애니메이션(Animation)

```typescript
legend: {
  visible: true,
  position: 'top',       // 'top' | 'bottom' | 'left' | 'right'
  align: 'center',       // 'start' | 'center' | 'end'
  markerShape: 'rounded',// 'circle' | 'rounded' | 'square' | 'line'
  interactive: true,     // 클릭 시 시리즈/카테고리 데이터 토글 & 양방향 호버 하이라이트
},
animation: {
  enabled: true,
  duration: 680,
  easing: 'easeOutQuart', // 'linear' | 'easeOutCubic' | 'easeOutQuart' | 'easeOutExpo' | 'easeOutBack'
}
```

### 5. 피그마(Figma) 호환 순수 벡터(SVG) 추출 (`toSVG`)

모든 차트 인스턴스(`BarChart`, `LineChart`, `PieChart`)는 현재 렌더링 상태를 피그마(`figma.createNodeFromSvg`)에서 Frame, Vector, Rectangle, Text 레이어로 분해하여 개별 편집할 수 있는 표준 SVG 문자열로 추출하는 `toSVG()` 메서드를 제공합니다.

```typescript
const svgString = chart.toSVG({
  width: 640,
  height: 400,
  backgroundColor: '#151C2C',
  backgroundRadius: 16,
  includeLegend: true,
  includeGrid: true,
});

// Figma 플러그인(code.ts) 내부에서 즉시 벡터 레이어로 삽입:
const node = figma.createNodeFromSvg(svgString);
```

---

## 🛠 API Options

| 옵션명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `data` | `DataItem[]` | 단일 시리즈 데이터 배열 (`{ label, value, ... }`) |
| `series` | `BarSeriesDataset[] \| LineSeriesDataset[]` | 다중 시리즈 데이터셋 배열 (`{ name, data, color, ... }`) |
| `xLabels` | `string[]` | 다중 시리즈에서 `number[]` 데이터를 사용할 때 지정할 X축 라벨 배열 |
| `bar.mode` | `'grouped' \| 'stacked' \| 'percent'` | 다중 바 배치 모드 (그룹형 / 누적형 / 100% 비율 누적형) |
| `bar.fill` | `ColorAccessor` | 단색, 그라데이션 객체, 또는 `(item, index) => string` 콜백 |
| `bar.borderRadius`| `number \| number[]` | 둥근 모서리 반지름 (예: `8` 또는 `[6, 6, 0, 0]`) |
| `bar.border` | `BarBorderStyle` | 테두리 색상, 굵기, 대시선 옵션 |
| `bar.widthRatio` | `number` | 바 두께 비율 (`0.1` ~ `1.0`, 기본 `0.65`) |
| `stacked` | `boolean` | `LineChart` 다중 시리즈 누적(Stacked Area/Line) 활성화 여부 |
| `legend` | `boolean \| LegendOptions` | 범례 표시 위치, 마커 모양, 클릭 데이터 토글 옵션 |
| `animation` | `boolean \| AnimationOptions` | 렌더링 애니메이션 시간(`duration`) 및 이징(`easing`) 옵션 |
| `labels.position`| `LabelPosition` | `'top-outside'` \| `'inside-top'` \| `'inside-center'` \| `'inside-bottom'` \| `'none'` |
| `labels.formatter`| `Function` | 텍스트 포맷팅 함수 |
| `zoom.enabled` | `boolean` | 마우스 휠 줌 활성화 여부 |
| `pan.enabled` | `boolean` | 마우스 드래그 좌우 스크롤 탐색 활성화 여부 |

---

## 🧩 Figma Plugin & 디자인 시스템 변수(Variables) 연동

`figma-plugin/` 디렉토리에는 `@ju9nu7/nanocharts` 엔진이 내장된 **피그마 벡터 차트 스튜디오 플러그인**이 포함되어 있습니다.

### 1. 디자이너 5대 피그마 Variable 컬렉션 100% 호환
차트를 피그마에 벡터(SVG)로 삽입할 때 16진수(HEX)나 픽셀 하드코딩 대신 프로젝트의 **Figma Local Variables**에 자동으로 바인딩됩니다:

| 컬렉션 이름 | 지원 변수 범위 | 자동 바인딩 대상 |
| :--- | :--- | :--- |
| **`1.Color Palette`** | `Primary/500`, `point red/500`, `Common/white`, `Transparency/50` 등 (266개) | 팔레트 직접 입력 및 별칭(Alias) 역추적 |
| **`2.Color token`** | `primary/-`, `on-primary/*`, `surface/*`, `on-surface/*`, `outline/*`, `overlay/white/*`, `overlay/gray/*`, `overlay/black/*`, `transparent` (75개) | 차트 시리즈, 배경, 축/그리드, 라벨, 줄무늬 배경(반투명 Alpha 포함) |
| **`3.Color token - point`** | `red/*` ~ `pink/*` (112개) + `on-red/*` ~ `on-pink/*` (112개) 총 224개 | 포인트 컬러 시리즈 및 상태별 강조 색상 |
| **`4.Radius`** | `rounded-xxs`(2px) ~ `rounded-full`(999px) (8개) | 바 차트 개별 막대의 상단 모서리(`topLeftRadius`, `topRightRadius`) 및 카드 배경 프레임 |
| **`5.Spacing`** | `padding/p-0_5` ~ `p-10`(12개) + `gap/gap-0_5` ~ `gap-10`(12개) (24개) | 차트 루트 프레임의 상하좌우 여백(`padding*`) 및 요소 간격(`itemSpacing`) |

### 2. 디자이너 최초 1회 플러그인 등록 방법
1. 피그마 데스크톱 앱 실행 → 상단 메뉴 **`Plugins`** → **`Development`** → **`Import plugin from manifest...`** 클릭
2. `figma-plugin/manifest.json` 파일 선택
3. 최초 1회만 등록해 두면 이후에는 **GitHub(`junwoo1519/nanocharts`) 및 npm CDN(`@ju9nu7/nanocharts`)을 통해 원격 자동 업데이트(OTA)** 되므로 디자이너가 다시 Import 할 필요가 없습니다.

---

## 📦 빌드 및 배포 명령어 (Build & Release Guide)

> **💡 Windows PowerShell 참고**: PowerShell 보안 정책으로 `npm.ps1` 실행이 차단된 환경에서는 `npm` 대신 **`npm.cmd`**를 사용하세요.

### 1. 로컬 개발 및 빌드 명령어

```bash
# 로컬 데모 개발 서버 실행 (Vite)
npm.cmd run dev

# 라이브러리 프로덕션 빌드 (dist/ 생성)
npm.cmd run build

# 라이브러리 + 피그마 플러그인(figma-plugin/dist/) 통합 빌드
npm.cmd run build:figma
```

### 2. 피그마 플러그인 원격 자동 업데이트 배포 (GitHub OTA)
코드를 수정한 뒤 디자이너의 피그마 플러그인에 **파일 전달 없이 즉시 최신 버전을 반영**하려면 아래 명령어를 실행합니다:

```bash
# 방법 A: 원클릭 스크립트 (빌드 + git add + commit + push 자동 실행)
npm.cmd run deploy:figma

# 방법 B: 수동으로 커밋 메시지를 지정하여 푸시할 때
npm.cmd run build:figma
git add .
git commit -m "feat: 차트 기능 및 피그마 플러그인 업데이트"
git push origin main
```

### 3. npm 패키지 정식 배포 (`@ju9nu7/nanocharts`)
npm 레지스트리는 이미 배포된 버전 번호로 덮어쓰기를 허용하지 않으므로(`403 Forbidden` 방지), **반드시 버전을 먼저 올린 후 배포**합니다:

```bash
# 1단계: 패치 버전 자동 증가 (예: 0.1.8 -> 0.1.9)
npm.cmd version patch --no-git-tag-version

# 2단계: 라이브러리 + 피그마 번들 통합 빌드
npm.cmd run build:figma

# 3단계: 배포될 파일 목록 사전 확인 (선택 사항)
npm.cmd pack --dry-run

# 4단계: npm 공개 배포 실행 (prepublishOnly 훅으로 빌드 자동 검증 포함)
npm.cmd publish --access public
```

---

## 📄 License

MIT License © 2026
