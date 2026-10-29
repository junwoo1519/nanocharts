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

```typescript
import { BarChart } from '@ju9nu7/nanocharts';

// 1. 차트 컨테이너 준비 (<div id="chart" style="width: 100%; height: 400px;"></div>)
const chart = new BarChart('#chart', {
  data: [
    { label: 'Q1', value: 120 },
    { label: 'Q2', value: 240 },
    { label: 'Q3', value: 180 },
    { label: 'Q4', value: 310 },
  ],
  // 바 스타일 커스텀
  bar: {
    borderRadius: [6, 6, 0, 0], // 상단만 둥글게
    fill: {
      type: 'linear',
      from: '#6366F1',
      to: '#9333EA',
      direction: 'vertical',
    },
    widthRatio: 0.6,
  },
  // 데이터 라벨 커스텀
  labels: {
    visible: true,
    position: 'top-outside',
    formatter: (val) => `${val.toLocaleString()}건`,
  },
  // 줌 & 팬 활성화
  zoom: { enabled: true },
  pan: { enabled: true },
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

---

## 🛠 API Options

| 옵션명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `data` | `DataItem[]` | 표시할 데이터 배열 (`{ label, value, ... }`) |
| `bar.fill` | `ColorAccessor` | 단색, 그라데이션 객체, 또는 `(item, index) => string` 콜백 |
| `bar.borderRadius`| `number \| number[]` | 둥근 모서리 반지름 (예: `8` 또는 `[6, 6, 0, 0]`) |
| `bar.border` | `BarBorderStyle` | 테두리 색상, 굵기, 대시선 옵션 |
| `bar.widthRatio` | `number` | 바 두께 비율 (`0.1` ~ `1.0`, 기본 `0.65`) |
| `labels.position`| `LabelPosition` | `'top-outside'` \| `'inside-top'` \| `'inside-center'` \| `'inside-bottom'` \| `'none'` |
| `labels.formatter`| `Function` | 텍스트 포맷팅 함수 |
| `zoom.enabled` | `boolean` | 마우스 휠 줌 활성화 여부 |
| `pan.enabled` | `boolean` | 마우스 드래그 좌우 스크롤 탐색 활성화 여부 |

---

## 📄 License

MIT License © 2026
