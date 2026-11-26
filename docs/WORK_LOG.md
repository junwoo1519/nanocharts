# 작업 이력 로그 (`docs/WORK_LOG.md`)

> **문서 목적:** 서로 다른 AI 에이전트 세션이 이전 작업 맥락과 주의사항을 즉시 이어받고, 모든 변경 이력을 최신순으로 누적 기록하는 공용 Work Log입니다.

---

## 표준 기록 양식 (Template)

새 작업 완료 시 아래 양식을 복사하여 **`---` 구분선 바로 아래(최상단)**에 추가합니다.

```markdown
## [YYYY-MM-DD HH:mm] 한 줄 요약

- **변경된 파일 목록:**
  - 생성: `path/to/new-file`
  - 수정: `path/to/modified-file`
  - 삭제: `path/to/deleted-file` (없으면 생략)
- **주요 변경 내용 및 이유:**
  - 변경 사항 1
  - 변경 사항 2
- **관련 스펙 문서(`docs/`) 동기화 여부:** `동기화 완료 (대상 파일)` 또는 `해당 없음`
- **다음 세션 주의사항:** (필요 시 기재, 없으면 `없음`)
```

---

## [2026-11-26 10:01] `DonutChart` / `PieChart` 라이브러리 클래스 및 Figma 플러그인 UI 완전 분리

- **변경된 파일 목록:**
  - 생성: `src/core/DonutChart.ts`
  - 수정: `src/types/index.ts`, `src/index.ts`, `figma-plugin/src/ui.template.html`, `figma-plugin/src/code.ts`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/WORK_LOG.md`
  - 재빌드: `dist/*`, `figma-plugin/dist/ui.html`, `figma-plugin/dist/code.js`, `figma-plugin/dist/version.json`
- **주요 변경 내용 및 이유:**
  - 라이브러리(`src/`)에 `PieChart`를 상속하고 기본 `innerRadiusRatio: 0.6` 및 전용 `donut` 옵션(`DonutStyleOptions`, `DonutChartOptions`, `DonutLabelOptions`, `DonutCenterContentOptions`, `DonutChartEventMap`)을 제공하는 독립 `DonutChart` 클래스를 추가하고 `src/index.ts`에서 공개 export함 (기존 `PieChart`의 `innerRadiusRatio` 사용 방식도 100% 하위 호환 유지).
  - Figma 플러그인(`figma-plugin/src/ui.template.html`) 상단 차트 유형 선택을 5개 탭(`Bar`, `Line`, `Donut`, `Pie`, `Funnel`)으로 분리함. `Donut` 선택 시 `DonutChart`와 내부 구멍 비율 슬라이더(`20%`~`80%`)·중앙 텍스트가 활성화되고, `Pie` 선택 시 `PieChart`(`innerRadiusRatio: 0`)로 동작하며 내부 구멍 비율 컨트롤을 숨김.
  - 개발자용 코드 내보내기(`ui.template.html`) 및 Dev Mode 코드 생성(`figma-plugin/src/code.ts`)이 `DonutChart` / `PieChart`를 각각 구분해 생성하도록 동기화하고, 기존 통합 버전(`chartType: 'pie'`, `holeRatio > 0`)으로 저장된 피그마 노드 재선택 시 자동으로 `Donut` 탭으로 복원되는 하위 호환 로직을 추가함.
- **관련 스펙 문서(`docs/`) 동기화 여부:** 동기화 완료 (`docs/API.md`, `docs/ARCHITECTURE.md`)
- **다음 세션 주의사항:** 없음

---

## [2026-11-26 09:55] Figma 플러그인 GUI 라이트 테마 포인트 컬러 블루(`#226CFF`) 적용

- **변경된 파일 목록:**
  - 수정: `figma-plugin/src/ui.template.html`, `docs/WORK_LOG.md`
  - 재빌드: `figma-plugin/dist/ui.html`, `figma-plugin/dist/code.js`, `figma-plugin/dist/version.json`
- **주요 변경 내용 및 이유:**
  - 화이트 배경(`#FFFFFF`) + 블랙 텍스트(`#111111`) 라이트 테마를 유지하면서, 포인트 컬러를 블루(`#226CFF`, 호버 `#1A56DB`)로 적용함.
  - 버전 배지, 섹션 번호, 슬라이더/체크박스/포커스 테두리, 활성 세그먼트·탭, 선택된 토큰 칩, 주요 CTA/코드 버튼, 리사이즈 핸들, `랜덤 생성` 버튼에 블루 포인트 컬러를 반영함.
- **관련 스펙 문서(`docs/`) 동기화 여부:** 해당 없음 (플러그인 GUI 포인트 컬러 조정)
- **다음 세션 주의사항:** 없음

---

## [2026-11-26 09:52] Figma 플러그인 GUI 화이트 배경 · 블랙 텍스트 모노크롬 라이트 테마 적용

- **변경된 파일 목록:**
  - 수정: `figma-plugin/src/ui.template.html`, `docs/WORK_LOG.md`
  - 재빌드: `figma-plugin/dist/ui.html`, `figma-plugin/dist/code.js`, `figma-plugin/dist/version.json`
- **주요 변경 내용 및 이유:**
  - 사용자 요청에 따라 Figma 플러그인 GUI를 심플한 화이트 배경(`#FFFFFF`, 프리뷰 스테이지 `#F5F5F7`)과 블랙 텍스트(`#111111`, 보조 `#3F3F46`/`#71717A`) 기반의 모노크롬 라이트 테마로 전환함.
  - 세그먼트 활성 상태, 주요 CTA 버튼, 체크박스·슬라이더, 선택 배지, 코드 내보내기 모달까지 모두 `#111111` / `#FFFFFF` / 뉴트럴 그레이 보더(`#E5E5E5`, `#D4D4D8`)로 통일함.
- **관련 스펙 문서(`docs/`) 동기화 여부:** 해당 없음 (플러그인 GUI 테마 조정)
- **다음 세션 주의사항:** 없음

---

## [2026-11-26 09:49] Figma 플러그인 GUI 텍스트 좌측 아이콘 제거 및 차콜·에메랄드 컬러 테마 개편

- **변경된 파일 목록:**
  - 수정: `figma-plugin/src/ui.template.html`, `docs/WORK_LOG.md`
  - 재빌드: `figma-plugin/dist/ui.html`, `figma-plugin/dist/code.js`, `figma-plugin/dist/version.json`
- **주요 변경 내용 및 이유:**
  - Figma 플러그인 GUI 패널(차트 유형 버튼, 프리셋/범례/변수 셀렉트, 반응형 크기 프리셋, 체크박스, 툴바 상태 배지, 푸터 안내·액션 버튼, 코드 내보내기 모달 및 동적 상태 텍스트)에서 텍스트 좌측에 들어가 있던 이모지/아이콘을 전면 제거하여 UI를 깔끔하게 정리함.
  - 기존 남색/파란색 계열(`#0B0F19`, `#111622`, `#182032`, `#226CFF`, `#3B82F6` 등)의 플러그인 UI 테마를 뉴트럴 차콜(`#111113`, `#17171A`, `#1F1F23`) 베이스 + 에메랄드/틸(`#10B981`, `#0D9488`, `#34D399`) 포인트 컬러 계열로 전면 교체함.
- **관련 스펙 문서(`docs/`) 동기화 여부:** 해당 없음 (플러그인 GUI 스타일 및 텍스트 정리)
- **다음 세션 주의사항:** 없음

---

## [2026-11-25 17:50] Figma 플러그인 Donut/Funnel 불필요 요소 간격 숨김 및 `code.ts` `sliceGap` 코드젠 동기화

- **변경된 파일 목록:**
  - 수정: `figma-plugin/src/ui.template.html`, `figma-plugin/src/code.ts`, `docs/WORK_LOG.md`
- **주요 변경 내용 및 이유:**
  - Donut(`pie`)·Funnel(`funnel`) 차트에서 렌더링에 영향을 주지 않는 하단 `요소 간격 (gap-slider)` 컨트롤을 숨기고, Bar·Line 차트에서만 표시되도록 `updateControlVisibility()`를 개선함.
  - `figma-plugin/src/code.ts`의 기본 상태 및 Dev Mode 코드 생성부에도 `pieGapMode` / `pieSliceGap` (`sliceGap` vs `padAngle`) 분기를 동기화함.
- **관련 스펙 문서(`docs/`) 동기화 여부:** 해당 없음 (플러그인 UI 및 코드젠 정리)
- **다음 세션 주의사항:** 없음

---

## [2026-11-25 17:45] 도넛/파이 차트 평행 픽셀 간격(`sliceGap`) 추가 및 Figma 플러그인·규칙 동기화

- **변경된 파일 목록:**
  - 수정: `src/types/index.ts`, `src/series/PieSeries.ts`, `src/utils/svg.ts`, `figma-plugin/src/ui.template.html`, `AGENTS.md`, `GEMINI.md`, `docs/API.md`, `docs/EDGE_CASES.md`, `docs/WORK_LOG.md`
- **주요 변경 내용 및 이유:**
  - 기존 각도 기반 여백(`padAngle`)이 외곽은 넓고 안쪽은 좁아지는 쐐기형 간격을 만드는 문제를 해결하기 위해, `PieStyleOptions.sliceGap?: number` (px 단위) 옵션을 하위 호환 형태로 추가함.
  - `PieSeries`의 `calculateSlices()`, `render()`, `drawSingleSlice()`, `toSvgElements()` 및 `svg.ts`의 `buildSvgPieSlicePathData()`에서 외곽/내부 아크에 `arcsin(halfGap / r)` 기반 평행 각도 오프셋을 분리 적용하고, 좁은 조각의 내부 교점 수렴 및 극소 조각 `halfGap` 클램핑 방어 로직을 구현함.
  - Figma 플러그인(`figma-plugin/src/ui.template.html`)의 Pie/Donut 컨트롤에 간격 방식(`일정 간격 (px · 평행)` / `각도 간격 (° · PadAngle)`) 선택과 동적 슬라이더, 프리뷰 매핑, 코드 Export, 상태 복원 로직을 반영함.
  - `AGENTS.md`와 `GEMINI.md`의 필수 프로토콜에 라이브러리 옵션/기능 변경 시 Figma 플러그인 UI 컨트롤도 함께 동기화하도록 강제 규칙을 추가함.
- **관련 스펙 문서(`docs/`) 동기화 여부:** 동기화 완료 (`docs/API.md`, `docs/EDGE_CASES.md`)
- **다음 세션 주의사항:** 없음

---

## [2026-11-25 14:35] 기존 문서 코드 싱크, `docs/` 핵심 스펙 문서 구축 및 Work Log 시스템 도입

- **변경된 파일 목록:**
  - 생성: `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/EDGE_CASES.md`, `docs/WORK_LOG.md`, `GEMINI.md`
  - 수정: `README.md`, `AGENTS.md`, `ANALYSIS.md`
- **주요 변경 내용 및 이유:**
  - 실제 소스 코드(`src/`)와 `package.json`(`v0.1.16`)을 전수 분석하여 기존 마크다운 문서에서 미구현 로드맵·TODO·향후 계획 섹션(`AGENTS.md`의 Phase 3, `ANALYSIS.md`의 보완 포인트 및 로드맵 등)을 전면 삭제하고 현재 구현 스펙에 맞게 동기화함.
  - 라이브러리 공개 API, 3단 Canvas 아키텍처, 디자인 토큰/반응형/스타일 격리, 엣지 케이스 방어 로직을 `docs/` 하위 4개 핵심 스펙 문서로 체계화함.
  - 세션 간 컨텍스트 연속성을 위해 `docs/WORK_LOG.md` 표준 양식과 `GEMINI.md`·`AGENTS.md`의 3단계 강제 작업 프로토콜(시작 시 읽기 / 종료 시 기록 / 스펙 문서 동기화)을 구축함.
- **관련 스펙 문서(`docs/`) 동기화 여부:** 동기화 완료 (`docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/EDGE_CASES.md`)
- **다음 세션 주의사항:**
  - `src/types/index.ts`에 선언된 `BarStyleOptions.minWidth`/`maxWidth`, `BarStyleOptions.hover.brightness`, `PieStyleOptions.cornerRadius`, `AxisOptions.tickSize`는 현재 타입 선언만 존재하며 런타임 렌더링에는 미적용 상태임(`docs/API.md`에 명시됨). 추후 실제 구현 시 `docs/API.md`를 함께 갱신할 것.
