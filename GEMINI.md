# GEMINI.md — AI Agent Rules & Project Protocol (`@ju9nu7/nanocharts`)

> **문서 목적:** 모든 AI 에이전트 세션이 `@ju9nu7/nanocharts` (`v0.1.16`)의 기술 스택, 번들 제약, 코딩 컨벤션, 검증 명령어 및 **세션 간 작업 자동 기록 프로토콜**을 일관되게 따르도록 강제 규칙을 정의합니다.

---

## 1. 작업 프로토콜 (필수 강제 규칙)

모든 세션의 AI 에이전트는 아래 3가지 규칙을 반드시 지켜야 합니다.

1. **[작업 시작 시]:** `docs/WORK_LOG.md`의 최근 기록 2~3개를 먼저 읽어 이전 작업 맥락과 주의사항을 파악한다.
2. **[작업 종료 시]:** 코드나 설정, 문서를 수정한 경우, 최종 답변 직전에 반드시 `docs/WORK_LOG.md` 최상단에 이번 세션의 작업 내역을 표준 양식에 맞춰 추가한다.
3. **[문서 동기화]:** Props, 아키텍처, 디자인 토큰, 엣지 케이스 처리 로직이 변경되었다면 `docs/` 내 관련 스펙 문서(`docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/EDGE_CASES.md`)도 함께 최신화한다.

---

## 2. 기술 스택 및 번들 제약 조건

- **언어:** TypeScript `^5.6.3` (`strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `target: ES2020`)
- **빌드 도구:** Vite `^5.4.10` + `vite-plugin-dts` `^4.3.0` (`rollupTypes: true`)
- **Zero Runtime Dependency 제약:** `package.json`의 `dependencies`와 `peerDependencies`는 비어 있어야 합니다. 런타임 서드파티 라이브러리(D3, lodash 등)를 추가하지 않고 순수 Canvas 2D API와 표준 Web API만 사용합니다.
- **패키지 출력 규격:**
  - ESM: `./dist/index.js` (`types: ./dist/index.d.ts`)
  - CJS: `./dist/index.cjs` (`types: ./dist/index.d.cts`)
  - Tree-shaking: `"sideEffects": false`
- **Framework-Agnostic:** React/Vue 등 특정 UI 프레임워크에 종속되지 않으며, DOM 선택자 문자열 또는 `HTMLElement`만으로 초기화되어야 합니다.

---

## 3. 신규 차트 추가 컨벤션

1. **타입 정의 (`src/types/index.ts`)**: 차트 옵션(`XxxChartOptions`), 스타일 옵션(`XxxStyleOptions`), 기하학 타입(`XxxGeometry`)을 한국어 JSDoc과 함께 추가합니다. 공통 옵션(`padding`, `font`, `responsive`, `tooltip`, `legend`, `animation`)을 누락하지 않습니다.
2. **시리즈 렌더러 (`src/series/XxxSeries.ts`)**: Canvas 2D 렌더링, `resolveColor()` 기반 디자인 토큰 해석, `toSvgElements()` Figma 호환 SVG 직렬화를 분리 구현합니다.
3. **메인 오케스트레이터 (`src/core/XxxChart.ts`)**: `EventEmitter<XxxChartEventMap>`를 상속하고 3단 `LayerManager`, `ResizeObserver`, `Tooltip`, `Legend`, `Animator`, 마우스/터치 히트 테스팅, `update()`, `resize()`, `render()`, `replayAnimation()`, `toSVG()`, `destroy()`를 구현합니다.
4. **진입점 Export (`src/index.ts`)**: 클래스, 이벤트 맵 타입, 시리즈 렌더러를 공개 내보내기합니다.
5. **안전성 & 성능 규칙**:
   - `ctx.save()` / `ctx.restore()` 짝을 반드시 유지합니다.
   - SSR(`typeof window === 'undefined'`), 빈 배열(`[]`), `NaN`/`Infinity`, 컨테이너 크기 `0`을 방어합니다.
   - `destroy()`에서 `ResizeObserver`, `window` 이벤트 리스너, `requestAnimationFrame`, DOM 요소를 모두 해제합니다.

---

## 4. 빌드 및 검증 명령어

> Windows PowerShell에서 `npm.ps1` 실행이 제한된 환경에서는 `npm.cmd` / `npx.cmd`를 사용합니다.

```bash
# 타입 체크 + 라이브러리 빌드 (tsc && vite build)
npm.cmd run build

# 라이브러리 + Figma 플러그인 통합 빌드
npm.cmd run build:figma

# 로컬 데모 서버 실행
npm.cmd run dev

# 패키지 exports/types 정합성 검증
npx.cmd publint

# npm 배포 파일 목록 드라이런 확인
npm.cmd pack --dry-run
```

---

## 5. 핵심 참조 문서

- [docs/API.md](docs/API.md) — 공개 API, Props, 데이터 포맷, 커스텀 렌더러 시그니처
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 디렉토리 구조 및 렌더링·인터랙션 파이프라인
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — 컬러 팔레트, 디자인 토큰, 폰트, 여백, 스타일 격리
- [docs/EDGE_CASES.md](docs/EDGE_CASES.md) — 빈 배열, `NaN`, 음수, 긴 라벨, 크기 `0` 방어 로직
- [docs/WORK_LOG.md](docs/WORK_LOG.md) — 세션 간 누적 작업 이력
