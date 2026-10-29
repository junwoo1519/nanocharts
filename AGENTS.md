# AGENTS.md — Developer & AI Agent Guide for nanocharts

> 이 문서는 AI 에이전트(Antigravity, Cursor 등) 및 기여자가 **`@ju9nu7/nanocharts`** 코드베이스를 이해하고, 일관된 철학으로 기능을 유지보수 및 확장(새 차트 추가 등)할 수 있도록 안내하는 개발 가이드라인입니다.

---

## 1. 프로젝트 철학 및 핵심 원칙

1. **Zero Dependency (외부 의존성 제로)**
   - 런타임에 외부 서드파티 라이브러리(D3, lodash 등)를 일체 사용하지 않습니다. 순수 Canvas 2D API와 표준 TypeScript로만 구현하여 번들 크기를 극소화(~30KB 이하)합니다.
2. **Multi-layer Canvas Architecture (성능 최우선)**
   - 마우스 이동(호버, 크로스헤어) 시 무거운 데이터 전체를 다시 그리지 않고 최상단 `interaction` 레이어만 지우고 다시 그립니다.
   - 대용량 데이터 시각화에서도 항상 60fps를 보장해야 합니다.
3. **Designer-Friendly (극대화된 비주얼 자유도)**
   - 디자이너가 요청하는 세밀한 디테일(그라데이션, 개별 모서리 둥글기, 자유로운 라벨 위치, 호버 시 팝아웃, 조건부 컬러링)을 지원하는 유연한 옵션과 콜백 함수 슬롯을 항상 열어둡니다.
4. **Framework-Agnostic (순수 바닐라 코어)**
   - 특정 프레임워크(React, Vue 등)의 가상 DOM이나 훅에 종속되지 않고, DOM Element만 넘기면 어디서든(Next.js, Svelte, Vue, Vanilla) 독립적으로 동작해야 합니다.

---

## 2. 디렉토리 구조 및 역할

```
src/
├── types/
│   └── index.ts            # 모든 차트 옵션, 데이터 구조, 스타일 인터페이스 (JSDoc 필수)
├── core/
│   ├── Chart.ts            # BarChart 메인 오케스트레이터 (리사이즈, 줌/팬, 이벤트)
│   ├── PieChart.ts         # PieChart 메인 오케스트레이터 (극좌표 히트테스팅, 팝아웃)
│   ├── LayerManager.ts     # 3단 Canvas(Background, Series, Interaction) 및 DPR 보정
│   └── EventEmitter.ts     # 초경량 이벤트 버스 (on, off, emit)
├── scale/
│   ├── Scale.ts            # Scale 공통 인터페이스
│   ├── LinearScale.ts      # 수치형 Y축 스케일 (Nice Ticks 생성 알고리즘 내장)
│   └── BandScale.ts        # 이산형 X축 바 스케일 (O(1) invert 역산 및 뷰포트 윈도우)
├── series/
│   ├── BarSeries.ts        # 바 렌더링 (뷰포트 컬링, 배치 렌더, roundRect, 라벨)
│   └── PieSeries.ts        # 파이/도넛 아크 연산, padAngle, 리더라인 라벨, 중앙 텍스트
├── components/
│   ├── Axis.ts             # X/Y축 눈금선 및 라벨 렌더링
│   ├── Grid.ts             # 배경 격자선 렌더링
│   └── Tooltip.ts          # 모던 부동형 DOM 툴팁
├── utils/
│   └── canvas.ts           # 둥근 사각형(drawRoundedRect), 그라데이션(createGradient) 유틸
└── index.ts                # 라이브러리 공개 진입점 (Public Export)
```

---

## 3. 새로운 차트 타입 추가 시 표준 파이프라인

새로운 차트(예: `LineChart`, `AreaChart`, `ScatterChart` 등)를 구현할 때는 반드시 아래 단계를 따릅니다:

1. **타입 정의 ([`src/types/index.ts`](file:///C:/toy/chart/src/types/index.ts))**:
   - `XxxStyleOptions`, `XxxChartOptions` 인터페이스를 선언하고 풍부한 JSDoc 한국어 주석과 코드 예제를 첨부합니다.
2. **시리즈 렌더러 작성 (`src/series/XxxSeries.ts`)**:
   - Canvas 2D 상에서 데이터 도형을 그리는 순수 드로잉 로직을 분리합니다.
   - 단일 데이터 렌더링과 일괄 렌더링, 호버 하이라이트 로직을 구현합니다.
3. **메인 차트 클래스 작성 (`src/core/XxxChart.ts`)**:
   - `LayerManager`를 초기화하고, 컨테이너 크기 감지(`ResizeObserver`)를 연결합니다.
   - 마우스 이동에 반응하는 히트 테스팅(Hit Testing) 및 툴팁/하이라이트 연동을 구성합니다.
   - `update(options)` 및 `destroy()` 정리 메서드를 구현합니다.
4. **진입점 내보내기 ([`src/index.ts`](file:///C:/toy/chart/src/index.ts))**:
   - 새로 작성한 클래스와 타입을 re-export합니다.
5. **빌드 검증**:
   - `npm run build`를 실행하여 TypeScript 타입 오류 및 Vite 빌드 산출물(`dist/`)을 검증합니다.

---

## 4. 빌드 & 배포 명령어 (CLI)

```bash
# 로컬 개발 서버 (데모 페이지 실행)
npm run dev

# 프로덕션 빌드 (TypeScript 컴파일 + Vite 라이브러리 번들링 + DTS 선언 생성)
npm run build

# 배포 파일 목록 사전 검증 (Dry run)
npm pack --dry-run

# npm 정식 공개 배포 (버전 올린 후 실행)
npm publish --access public
```

---

## 5. 코딩 스타일 및 주의사항

- **주석 규칙**: 주요 함수, 클래스, 인터페이스 필드에는 반드시 한국어 JSDoc 주석(`/** ... */`)을 작성합니다. 이 주석들은 빌드 시 `dist/index.d.ts`로 번들되어 사용자의 IDE에 노출됩니다.
- **성능 수칙**:
  - `ctx.save()`와 `ctx.restore()`의 짝을 반드시 맞춥니다.
  - 마우스 이벤트 리스너 내부에서는 무거운 연산을 피하고, 수학적 역산($O(1)$) 또는 이진 탐색($O(\log N)$)을 우선 사용합니다.
- **버전 관리 (SemVer)**:
  - 기능 추가 시 `package.json`의 마이너/패치 버전(예: `0.1.2` -> `0.1.3`)을 올리고 배포합니다.

---

## 6. 기능 로드맵 (Feature Roadmap)

- [x] **Bar Chart**: 단색, 그라데이션, roundRect, 테두리, 수치 라벨, 줌/팬 탐색
- [x] **Pie / Donut Chart**: innerRadius 도넛 전환, padAngle, 호버 팝아웃, 가이드라인 라벨, 중앙 요약
- [ ] **Line / Area Chart**: 베지에 곡선(Smooth Spline), LTTB 다운샘플링, 채우기 그라데이션
- [ ] **Legend Component**: 범례 표시 및 항목 클릭 시 데이터 토글 기능
- [ ] **Animation Engine**: 최초 렌더링 시 성장(Grow/Wipe) 애니메이션
