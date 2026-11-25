# AGENTS.md — Developer & AI Agent Guide for `@ju9nu7/nanocharts`

> **문서 목적:** AI 에이전트 및 기여자가 `@ju9nu7/nanocharts` (`v0.1.16`) 코드베이스의 아키텍처 원칙, 번들 제약, 컨벤션, 빌드/검증 명령어 및 **세션 간 작업 기록 프로토콜**을 일관되게 준수하도록 안내합니다.

---

## 1. 세션 간 작업 프로토콜 (필수 강제 규칙)

모든 AI 에이전트는 본 저장소에서 작업을 수행할 때 아래 4단계 프로토콜을 **예외 없이** 준수해야 합니다.

1. **[작업 시작 시]:** `docs/WORK_LOG.md`의 최근 기록 2~3개를 먼저 읽어 이전 세션의 작업 맥락, 변경 이력, 주의사항을 파악한다.
2. **[Figma 플러그인 동기화]:** 라이브러리(`src/`)에 차트 옵션, 스타일, 렌더링 기능을 추가하거나 변경할 때는 반드시 `figma-plugin/src/ui.template.html`의 UI 컨트롤, 프리뷰 옵션 매핑, 코드 Export 스니펫, 저장 상태 복원 로직도 함께 반영하고 `npm.cmd run build:figma`로 통합 빌드를 검증한다.
3. **[문서 동기화]:** Props/타입, 렌더링·인터랙션 아키텍처, 디자인 토큰, 엣지 케이스 방어 로직이 변경되었다면 `docs/` 내 관련 스펙 문서(`docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/EDGE_CASES.md`)도 함께 최신화한다.
4. **[작업 종료 시]:** 코드, 문서, 설정을 수정한 경우 최종 답변 직전에 반드시 `docs/WORK_LOG.md` 최상단에 이번 세션의 작업 내역을 표준 양식(Template)에 맞춰 추가한다.

---

## 2. 기술 스택 및 번들 제약 조건

| 항목 | 현재 구성 및 제약 |
| :--- | :--- |
| **언어 / 런타임** | TypeScript (`^5.6.3`, `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`) + Browser Canvas 2D API |
| **번들러** | Vite (`^5.4.10`) + `vite-plugin-dts` (`^4.3.0`, `rollupTypes: true`) |
| **런타임 의존성** | **Zero Dependency** (`dependencies`, `peerDependencies` 없음 — D3, lodash 등 외부 런타임 라이브러리 추가 금지) |
| **출력 포맷** | ES Module (`dist/index.js`, `dist/index.d.ts`) + CommonJS (`dist/index.cjs`, `dist/index.d.cts`), `sideEffects: false` |
| **프레임워크 종속성** | 순수 바닐라 코어(Framework-Agnostic) — DOM Element 또는 선택자 문자열만 받아 독립 동작 |

---

## 3. 프로젝트 핵심 원칙

1. **Multi-layer Canvas Architecture (`LayerManager`)**
   - `background`(z-index 1), `series`(z-index 2), `interaction`(z-index 3) 3개 Canvas로 분리하여 호버/크로스헤어 시 최상단 레이어만 갱신합니다.
2. **Designer-Friendly & Design System Integrated**
   - `src/utils/tokens.ts`의 `DESIGN_TOKENS`, `RADIUS_TOKENS`, `SPACING_TOKENS`를 통해 `var(--token)` 및 Figma 변수명을 웹 Canvas와 Figma 플러그인 양쪽에서 일관되게 해석합니다.
3. **성능 및 안전성 수칙**
   - `ctx.save()`와 `ctx.restore()`의 짝을 반드시 맞춥니다.
   - 마우스 이벤트 리스너 내부에서는 $O(1)$ 수학적 역산(`BandScale.invert`) 등 경량 연산을 유지하고, `destroy()` 시 `ResizeObserver`, `window` 리스너, rAF 애니메이션, DOM 요소를 완전히 해제합니다.
4. **JSDoc 주석 규칙**
   - 공개 클래스, 메서드, 인터페이스 필드에 한국어 JSDoc(`/** ... */`)을 작성하여 `dist/index.d.ts` IDE 자동완성에 노출되도록 유지합니다.

---

## 4. 디렉토리 구조

```
src/
├── types/index.ts          # 모든 차트 옵션, 데이터 구조, 스타일 인터페이스
├── core/
│   ├── Chart.ts            # BarChart 오케스트레이터 (단일/Grouped/Stacked/Percent, 줌/팬, toSVG)
│   ├── LineChart.ts        # LineChart 오케스트레이터 (단일/Multi-Line/Stacked Area, LTTB, 줌/팬, toSVG)
│   ├── PieChart.ts         # PieChart 오케스트레이터 (파이/도넛, 트랙, 극좌표 히트, Lerp 팝아웃, toSVG)
│   ├── FunnelChart.ts      # FunnelChart 오케스트레이터 (vertical/horizontal, trapezoid/bar, 전환율, toSVG)
│   ├── Animator.ts         # rAF 애니메이션 엔진 및 5종 이징 함수
│   ├── LayerManager.ts     # 3단 Canvas(Background, Series, Interaction) 및 DPR 보정
│   └── EventEmitter.ts     # 제네릭 타입 안전 이벤트 버스
├── scale/
│   ├── Scale.ts            # Scale 공통 인터페이스
│   ├── LinearScale.ts      # 수치형 선형 스케일 (Nice Ticks & Nice Domain)
│   └── BandScale.ts        # 이산형 밴드 스케일 (뷰포트 가상화, O(1) invert)
├── series/
│   ├── BarSeries.ts        # 바 렌더링, 뷰포트 컬링, 라벨, SVG 직렬화
│   ├── LineSeries.ts       # 라인/영역 렌더링, LTTB 다운샘플링, HSL 그라데이션, SVG 직렬화
│   ├── PieSeries.ts        # 파이/도넛 아크 연산, DEFAULT_PALETTE, 리더라인/중앙 텍스트, SVG 직렬화
│   └── FunnelSeries.ts     # 퍼널 도형 연산, Ray-casting 히트 테스팅, 전환율 라벨, SVG 직렬화
├── components/
│   ├── Axis.ts             # X/Y축 눈금선 및 라벨 렌더링 (이진 탐색 말줄임)
│   ├── Grid.ts             # X/Y 격자선, 줄무늬 배경, 플롯 외곽 박스
│   ├── Tooltip.ts          # 단일/다중 통합 부동형 DOM 툴팁 (경계 클램핑·반전, HTML 이스케이프)
│   └── Legend.ts           # 12방향 범례 배치, 클릭 토글 및 양방향 호버 연동
├── utils/
│   ├── canvas.ts           # normalizeBorderRadius, drawRoundedRect, createGradient
│   ├── tokens.ts           # DESIGN_TOKENS, RADIUS_TOKENS, SPACING_TOKENS, resolveColor, adjustColorHsl, buildCssFontString
│   ├── responsive.ts       # normalizeResponsiveOptions, resolveContainerDimensions, computeResponsivePadding
│   └── svg.ts              # Figma 호환 순수 벡터 SVG 직렬화 유틸리티
└── index.ts                # 라이브러리 공개 진입점

docs/
├── API.md                  # 공개 API, 옵션, 데이터 포맷, 커스텀 렌더러 명세
├── ARCHITECTURE.md         # 파이프라인, 상태 관리, 최적화 구조
├── DESIGN_SYSTEM.md        # 컬러 토큰, 폰트, 여백, 배치 규칙, 스타일 격리
├── EDGE_CASES.md           # 경계값 및 예외 방어 로직 명세
└── WORK_LOG.md             # 세션 간 작업 기록 로그

figma-plugin/               # Figma 벡터 차트 스튜디오 플러그인 (manifest.json, src/, dist/)
scripts/                    # 빌드 및 에셋 생성 스크립트 (build-figma-plugin.mjs 등)
demo/                       # 로컬 Vite 데모 엔트리 (demo/main.ts)
```

---

## 5. 신규 차트 타입 추가 컨벤션

새로운 차트(`XxxChart`)를 추가할 때는 아래 순서를 따릅니다.

1. **타입 정의 (`src/types/index.ts`)**: `XxxStyleOptions`, `XxxChartOptions`, 기하 정보 타입을 선언하고 한국어 JSDoc을 작성합니다. 공통 옵션(`padding`, `font`, `responsive`, `tooltip`, `legend`, `animation`)을 포함합니다.
2. **시리즈 렌더러 (`src/series/XxxSeries.ts`)**: Canvas 2D 드로잉 로직과 `resolveColor()` 디자인 토큰 해석, `toSvgElements()` SVG 직렬화를 구현합니다.
3. **오케스트레이터 (`src/core/XxxChart.ts`)**: `EventEmitter<XxxChartEventMap>`를 상속하고 `LayerManager`, `ResizeObserver`, `Tooltip`, `Legend`, `Animator`, 터치/마우스 히트 테스팅, `update()`, `resize()`, `render()`, `replayAnimation()`, `toSVG()`, `destroy()`를 구현합니다.
4. **공개 내보내기 (`src/index.ts`)**: 신규 클래스, 이벤트 맵 타입, 시리즈/헬퍼를 re-export합니다.
5. **빌드 검증 및 문서 동기화**: `npm.cmd run build:figma`로 타입·라이브러리·Figma 번들을 검증하고, `docs/` 스펙 문서와 `docs/WORK_LOG.md`를 업데이트합니다.

---

## 6. 빌드 및 검증 명령어

> Windows PowerShell에서 `npm.ps1`이 차단된 환경에서는 `npm.cmd` / `npx.cmd`를 사용합니다.

```bash
# 로컬 데모 개발 서버
npm.cmd run dev

# 타입 체크 + Vite 라이브러리 번들 빌드 (dist/)
npm.cmd run build

# 라이브러리 + Figma 플러그인 통합 빌드 (dist/ + figma-plugin/dist/)
npm.cmd run build:figma

# 배포 패키지 내보내기 구조 검증 (선택)
npx.cmd publint

# 배포 파일 목록 사전 검증
npm.cmd pack --dry-run

# npm 정식 공개 배포 (SemVer 버전 증가 후 실행, 현재 v0.1.16)
npm.cmd publish --access public
```
