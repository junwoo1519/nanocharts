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
