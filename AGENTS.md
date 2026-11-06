# AGENTS.md — Developer & AI Agent Guide for nanocharts

> 이 문서는 AI 에이전트(Antigravity, Cursor 등) 및 기여자가 **`@ju9nu7/nanocharts`** 코드베이스를 이해하고, 일관된 철학으로 기능을 유지보수 및 확장(새 차트 추가, 피그마 플러그인 고도화 등)할 수 있도록 안내하는 개발 가이드라인입니다.

---

## 1. 프로젝트 철학 및 핵심 원칙

1. **Zero Dependency (외부 의존성 제로)**
   - 런타임에 외부 서드파티 라이브러리(D3, lodash 등)를 일체 사용하지 않습니다. 순수 Canvas 2D API와 표준 TypeScript로만 구현하여 번들 크기를 극소화합니다.
2. **Multi-layer Canvas Architecture (성능 최우선)**
   - 마우스 이동(호버, 크로스헤어) 시 무거운 데이터 전체를 다시 그리지 않고 최상단 `interaction` 레이어만 지우고 다시 그립니다.
   - 대용량 데이터 시각화에서도 항상 60fps를 보장해야 합니다.
3. **Designer-Friendly & Design System Integrated (극대화된 비주얼 자유도 & 디자인 토큰 연동)**
   - 디자이너가 요청하는 세밀한 디테일(그라데이션 채도/명도 조절, 개별 모서리 둥글기, 12방향 범례, 차트 전역 폰트, 그리드 선 커스텀, 호버 시 팝아웃, 조건부 컬러링)을 지원합니다.
   - `variables.scss` 디자인 시스템 컬러 토큰(`var(--primary)`, `--surface-ultra-low`, `--on-surface`, `--outline` 등)을 웹 Canvas와 피그마 플러그인 Variables API 양쪽에서 일관되게 지원합니다.
4. **Framework-Agnostic (순수 바닐라 코어)**
   - 특정 프레임워크(React, Vue 등)의 가상 DOM이나 훅에 종속되지 않고, DOM Element만 넘기면 어디서든(Next.js, Svelte, Vue, Vanilla) 독립적으로 동작해야 합니다.

---

## 2. 디렉토리 구조 및 역할

```
src/
├── types/
│   └── index.ts            # 모든 차트 옵션, 데이터 구조, 스타일 인터페이스 (JSDoc 필수)
├── core/
│   ├── Chart.ts            # BarChart 메인 오케스트레이터 (단일/Grouped/Stacked/Percent, 반응형, 줌/팬, toSVG)
│   ├── PieChart.ts         # PieChart 메인 오케스트레이터 (극좌표 히트테스팅, 팝아웃, 도넛/파이 전환, toSVG)
│   ├── LineChart.ts        # LineChart 메인 오케스트레이터 (단일/Multi-Line/Stacked Area, 크로스헤어, LTTB, toSVG)
│   ├── FunnelChart.ts      # FunnelChart 메인 오케스트레이터 (상하/좌우 방향, 사다리꼴/바 도형, 전환율, toSVG)
│   ├── Animator.ts         # 초경량 60fps rAF 애니메이션 엔진 및 이징 함수
│   ├── LayerManager.ts     # 3단 Canvas(Background, Series, Interaction) 및 DPR 보정
│   └── EventEmitter.ts     # 초경량 이벤트 버스 (on, off, emit)
├── scale/
│   ├── Scale.ts            # Scale 공통 인터페이스
│   ├── LinearScale.ts      # 수치형 Y축 스케일 (Nice Ticks 생성 알고리즘 내장)
│   └── BandScale.ts        # 이산형 X축 바 스케일 (O(1) invert 역산 및 뷰포트 윈도우)
├── series/
│   ├── BarSeries.ts        # 바 렌더링 (뷰포트 컬링, 그룹/누적/100%, roundRect, 라벨, SVG 직렬화)
│   ├── PieSeries.ts        # 파이/도넛 아크 연산, padAngle 자동 보정, 리더라인 라벨, 중앙 텍스트, SVG 직렬화
│   ├── LineSeries.ts       # 라인/영역 렌더링 (smooth/linear/step, Area 채도/명도 HSL 그라데이션, LTTB, SVG 직렬화)
│   └── FunnelSeries.ts     # 퍼널 렌더링 (vertical/horizontal, trapezoid/bar, 단계 전환율, SVG 직렬화)
├── components/
│   ├── Axis.ts             # X/Y축 눈금선 및 라벨 렌더링 (전역/개별 폰트 연동)
│   ├── Grid.ts             # 배경 격자선 렌더링 (X/Y축 토글, solid/dashed/dotted, 외곽 박스, 줄무늬 배경)
│   ├── Tooltip.ts          # 모던 부동형 DOM 툴팁 (단일 및 다중 시리즈 통합 포맷)
│   └── Legend.ts           # 12방향(9방향+상하좌우) 범례 배치, 클릭 데이터 토글 및 호버 하이라이트 연동
├── utils/
│   ├── canvas.ts           # 둥근 사각형(drawRoundedRect), 그라데이션(createGradient) 유틸
│   ├── tokens.ts           # variables.scss 디자인 토큰 내장 사전, CSS var(--*) 리졸버, HSL 채도/명도 보정, 폰트 빌더
│   ├── responsive.ts       # 컨테이너 크기/종횡비 기반 반응형 크기 및 여백(Padding) 자동 계산 유틸
│   └── svg.ts              # 피그마(figma.createNodeFromSvg) 호환 순수 벡터(SVG) 변환 엔진
└── index.ts                # 라이브러리 공개 진입점 (Public Export)

figma-plugin/
├── manifest.json           # 피그마 로컬/사내 Import용 플러그인 매니페스트
├── src/
│   ├── code.ts             # 피그마 샌드박스 컨트롤러 (SVG 벡터 변환, Variables 자동 생성/바인딩, 반응형 Constraints)
│   └── ui.template.html    # 실시간 차트 스튜디오 UI 템플릿 (빌드 시 dist/index.js 인라인 결합)
└── dist/
    ├── code.js             # 트랜스파일된 피그마 메인 스크립트
    └── ui.html             # 단일 파일로 번들링된 피그마 UI
```

---

## 3. 새로운 차트 타입 추가 시 표준 파이프라인

새로운 차트(예: `ScatterChart`, `RadarChart`, `HorizontalBarChart` 등)를 구현할 때는 반드시 아래 단계를 따릅니다:

1. **타입 정의 ([`src/types/index.ts`](file:///C:/toy/chart/src/types/index.ts))**:
   - `XxxStyleOptions`, `XxxChartOptions` 인터페이스를 선언하고 풍부한 JSDoc 한국어 주석과 코드 예제를 첨부합니다.
   - 공통 옵션(`font?: ChartFontOptions`, `responsive?: boolean | ResponsiveOptions`, `legend?: boolean | LegendOptions`)을 포함합니다.
2. **시리즈 렌더러 작성 (`src/series/XxxSeries.ts`)**:
   - Canvas 2D 상에서 데이터 도형을 그리는 순수 드로잉 로직을 분리합니다.
   - `resolveColor()`를 통해 `var(--token)` 및 디자인 토큰 이름을 지원합니다.
   - 피그마 추출을 위한 `toSvgElements()` 메서드를 함께 구현합니다.
3. **메인 차트 클래스 작성 (`src/core/XxxChart.ts`)**:
   - `LayerManager`를 초기화하고, 컨테이너 크기 감지(`ResizeObserver`) 및 반응형 여백(`computeResponsivePadding`)을 연결합니다.
   - 마우스 이동 및 모바일 터치(`touchstart`, `touchmove`) 히트 테스팅, 툴팁/범례 하이라이트 연동을 구성합니다.
   - `toSVG()`, `update(options)` 및 `destroy()` 정리 메서드를 구현합니다.
4. **진입점 내보내기 ([`src/index.ts`](file:///C:/toy/chart/src/index.ts))**:
   - 새로 작성한 클래스와 타입을 re-export합니다.
5. **빌드 검증**:
   - `npm.cmd run build:figma`를 실행하여 TypeScript 타입 오류, Vite 라이브러리 번들(`dist/`), 피그마 플러그인 번들(`figma-plugin/dist/`)을 한 번에 검증합니다.

---

## 4. 빌드 & 배포 명령어 (CLI)

> **Windows PowerShell 참고**: 실행 정책으로 `npm.ps1`이 차단된 환경에서는 `npm.cmd`를 사용합니다.

```bash
# 로컬 개발 서버 (데모 페이지 실행)
npm.cmd run dev

# 프로덕션 빌드 (TypeScript 컴파일 + Vite 라이브러리 번들링 + DTS 선언 생성)
npm.cmd run build

# 라이브러리 + 피그마 플러그인(figma-plugin/dist/) 통합 빌드
npm.cmd run build:figma

# 배포 파일 목록 사전 검증 (Dry run)
npm.cmd pack --dry-run

# npm 정식 공개 배포 (버전 올린 후 실행)
npm.cmd publish --access public
```

---

## 5. 코딩 스타일 및 주의사항

- **주석 규칙**: 주요 함수, 클래스, 인터페이스 필드에는 반드시 한국어 JSDoc 주석(`/** ... */`)을 작성합니다. 이 주석들은 빌드 시 `dist/index.d.ts`로 번들되어 사용자의 IDE에 노출됩니다.
- **성능 수칙**:
  - `ctx.save()`와 `ctx.restore()`의 짝을 반드시 맞춥니다.
  - 마우스 이벤트 리스너 내부에서는 무거운 연산을 피하고, 수학적 역산($O(1)$) 또는 이진 탐색($O(\log N)$)을 우선 사용합니다.
- **버전 관리 (SemVer)**:
  - 기능 추가 시 `package.json`의 마이너/패치 버전(현재 `0.1.7`)을 올리고 배포합니다.

---

## 6. 작업 히스토리 및 기능 로드맵 (Feature Roadmap)

### Phase 1 ~ Phase 2 (완료 ✅ — 현재 버전 `v0.1.7`)
- [x] **Bar Chart**: 단색, 그라데이션, `roundRect`, 테두리, 수치 라벨, 줌/팬 탐색, 다중 시리즈(`grouped` / `stacked` / `percent`)
- [x] **Pie / Donut Chart**: `innerRadiusRatio` 도넛 전환(`0%`일 때 `padAngle: 0` 자동 전환 및 경계 안티앨리어싱 실금 방지), 호버 팝아웃, 리더라인 라벨, 중앙 요약
- [x] **Line / Area Chart**: 베지에 곡선(`smooth` / `linear` / `step`), LTTB 다운샘플링, 다중 라인 & 누적 영역(`stacked`), **Area 그라데이션 채도(Saturation)·명도(Lightness)·투명도(Opacity) 커스텀**
- [x] **Funnel Chart (`FunnelChart`)**: 상하(`vertical`) 및 좌우(`horizontal`) 진행 방향, 사다리꼴(`trapezoid`) 및 바(`bar`) 도형 형태, 단계 간격(`gap`), 전환율(`%`) 자동 표시
- [x] **12방향 범례 (`Legend`)**: `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`, `left-top`, `left-middle`, `left-bottom`, `right-top`, `right-middle`, `right-bottom` 배치 및 클릭 데이터 토글/호버 연동
- [x] **전역 및 세부 폰트 (`ChartFontOptions`)**: `font: { family, size, weight }` 설정으로 축, 라벨, 범례, 툴팁, 중앙 텍스트, SVG 추출 일괄 적용
- [x] **그리드(`Grid`) 커스텀**: 가로(`y`)/세로(`x`) 개별 표시, 선 스타일(`solid` | `dashed` | `dotted`), 두께(`lineWidth`), 불투명도(`opacity`), 플롯 외곽 박스(`border`), 줄무늬 배경(`alternateBand`)
- [x] **반응형(`ResponsiveOptions`)**: 컨테이너 크기·비율(`aspectRatio`) 자동 계산, 브레이크포인트별 폰트/여백 자동 축소, 모바일 터치 대응
- [x] **디자인 토큰(`variables.scss`) & 피그마 플러그인(`figma-plugin/`)**:
  - `var(--primary)`, `--surface-ultra-low`, `--on-surface`, `--outline` 등 디자인 토큰 내장
  - 피그마 플러그인에서 벡터(SVG) 삽입 시 16진수(HEX) 하드코딩 대신 **피그마 로컬 변수(Color Variables) 자동 생성 및 100% 바인딩** (단색 Fill, Stroke, Area 그라데이션 ColorStop 모두 포함)
  - 피그마 프레임 리사이즈 대응 반응형 Constraints 자동 적용 및 재선택 시 차트 옵션 복원/재편집 지원

### Phase 3 (다음 주 이어서 진행할 작업 후보 📋)
- [ ] **피그마 플러그인 사내 배포/공유 자동화**: 디자이너에게 매번 수동으로 파일을 전달하지 않고 사내 Git / 공유 폴더 / 자동 업데이트 스크립트로 배포하는 워크플로우 구성
- [ ] **새로운 차트 타입 확장**: `HorizontalBarChart`(가로형 바 차트), `ScatterChart`(산점도/버블 차트), `RadarChart`(방사형 차트)
- [ ] **복합 차트 (Combo Chart)**: Bar + Line 이중축(Dual Y-Axis) 혼합 차트 지원
- [ ] **npm 패키지 신규 버전 배포**: 변경 사항 통합 검증 후 `npm publish --access public` 배포
