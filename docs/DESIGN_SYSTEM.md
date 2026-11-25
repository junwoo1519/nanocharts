# 디자인 시스템 명세서 (`docs/DESIGN_SYSTEM.md`)

> **문서 목적:** `@ju9nu7/nanocharts` (`v0.1.16`)에 내장된 컬러 팔레트, 디자인 토큰 해석 체계, 타이포그래피, 여백 및 반응형 규칙, 축/그리드/범례 배치 규칙, DOM 스타일 격리 방식을 실제 코드(`src/utils/tokens.ts`, `src/utils/responsive.ts`, `src/components/`) 기준으로 정리합니다.

---

## 1. 기본 컬러 팔레트 및 디자인 토큰

### 1.1 기본 시리즈 팔레트 (`DEFAULT_PALETTE`, `src/series/PieSeries.ts`)

`PieChart`, `FunnelChart` 및 다중 시리즈 `BarChart`/`LineChart`에서 색상을 생략하면 아래 8색이 순환 적용됩니다.

| 인덱스 | HEX | 컬러명 | 용도 기본값 |
| :---: | :--- | :--- | :--- |
| 0 | `#6366F1` | Indigo | `LineSeries` 기본 선 색상, 다중 시리즈 1번 |
| 1 | `#06B6D4` | Cyan | 다중 시리즈 2번 |
| 2 | `#10B981` | Emerald | 다중 시리즈 3번 |
| 3 | `#F59E0B` | Amber | 다중 시리즈 4번 |
| 4 | `#EC4899` | Pink | 다중 시리즈 5번 |
| 5 | `#8B5CF6` | Purple | 다중 시리즈 6번 |
| 6 | `#3B82F6` | Blue | 다중 시리즈 7번 |
| 7 | `#14B8A6` | Teal | 다중 시리즈 8번 |

> 단일 `BarSeries` 기본 채우기 색상은 `#4F46E5`입니다.

### 1.2 내장 디자인 토큰 체계 (`src/utils/tokens.ts`)

`resolveColor(input, scopeElement?)`는 아래 우선순위로 색상을 해석합니다.
1. 브라우저 DOM(`getComputedStyle(scopeElement || document.documentElement)`)에 선언된 CSS 변수(`--*`) 조회
2. 내장 `DESIGN_TOKENS` 사전 폴백
3. `var(--token, fallback)`의 fallback 값 또는 원본 문자열 반환 (빈 입력 시 `#226CFF`)

| 토큰 그룹 | 내장 상수 | 주요 키 예시 및 값 |
| :--- | :--- | :--- |
| **시맨틱 컬러** | `DESIGN_TOKENS` | `primary` (`#226CFF`), `on-primary` (`#E7EFFF`), `surface` (`#F0F2F4`), `surface-ultra-low` (`#FFFFFF`), `surface-low` (`#E9ECEF`), `on-surface` (`#676C75`), `outline` (`#E9ECEF`), `transparent` |
| **오버레이** | `DESIGN_TOKENS` | `overlay-white-*` (`rgba(255,255,255,0.1~0.8)`), `overlay-gray-*` (`rgba(6,19,31,0.05~0.34)`), `overlay-black-*` (`rgba(6,19,31,0.1~0.8)`) |
| **포인트 14종** | `DESIGN_TOKENS` | `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `purple`, `violet`, `pink` 및 각 `on-*` 단계별 토큰 |
| **모서리 둥글기** | `RADIUS_TOKENS` | `rounded-xxs` (`2`) ~ `rounded-xxl` (`16`), `rounded-full` (`999`) |
| **여백/간격** | `SPACING_TOKENS` | `padding/p-0_5` (`2`) ~ `padding/p-10` (`40`), `gap/gap-0_5` (`2`) ~ `gap/gap-10` (`40`) |

- **토큰 정규화 (`normalizeTokenKey`)**: `var(--primary)`, `--primary`, `primary/-`, `Primary/500`, `point red/500`, `Transparency/50` 등 다양한 표기를 표준 키(`primary`, `red`, `overlay-gray-mid`)로 정규화합니다.
- **Area HSL 보정 (`adjustColorHsl`)**: `LineSeries` 영역 그라데이션은 선 색상을 HSL로 변환해 `topSaturation`, `bottomSaturation`, `saturationDelta`, `topLightness`, `bottomLightness`, `lightnessDelta`, `topOpacity`(`0.42`), `bottomOpacity`(`0.02`)를 적용합니다.

---

## 2. 타이포그래피 (폰트) 규칙

- **전역 폰트 (`ChartFontOptions`)**: `{ family?, size?, weight? }`를 지정하면 `buildCssFontString()`으로 CSS 폰트 문자열을 생성해 축, 데이터 라벨, 범례, 도넛 중앙 텍스트, SVG 추출에 일괄 전파합니다.
- **기본 폰트 패밀리**: `Pretendard, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

| 요소 | 기본 크기 | 기본 두께 | 기본 색상 |
| :--- | :---: | :---: | :--- |
| Y축 라벨 (`Axis`) | `11px` | `500` (전역 미지정 시 normal) | `#94A3B8` |
| X축 라벨 (`Axis`) | `11px` | `500` | `#64748B` |
| 바 데이터 라벨 (`BarSeries`) | `11px` | `600` | 내부 `#FFFFFF`, 외부 `#334155` (SVG `#94A3B8`) |
| 라인 데이터 라벨 (`LineSeries`) | `11px` | `600` | `#94A3B8` |
| 도넛 중앙 타이틀 / 서브타이틀 (`PieSeries`) | `20px` / `11px` | `700` / `500` | `#FFFFFF` / `#94A3B8` |
| 범례 (`Legend`) | `12px` (`font.size + 1`) | `500` | 활성 `#E2E8F0`, 비활성 `#64748B` |
| 툴팁 (`Tooltip`) | `12px` (값 `14px`) | `600` / `700` | 배경 `rgba(15, 23, 42, 0.92)`, 텍스트 `#F8FAFC` / `#94A3B8` |

---

## 3. 여백(Padding) 및 반응형 레이아웃 규칙

### 3.1 차트별 기본 여백 (`Padding`) 및 기본 종횡비

| 차트 | `top` | `right` | `bottom` | `left` | 기본 `aspectRatio` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `BarChart` | `30px` | `20px` | `40px` | `50px` | `1.6` |
| `LineChart` | `30px` | `20px` | `40px` | `50px` | `1.6` |
| `PieChart` | `20px` | `20px` | `20px` | `20px` | `1.35` |
| `FunnelChart` | `24px` | `24px` | `24px` | `24px` | `1.5` |

### 3.2 반응형 보정 (`src/utils/responsive.ts`)

- **자동 높이 계산**: 컨테이너 높이가 `<= 10px`이거나 `responsive.aspectRatio`가 명시된 경우 `Math.round(width / aspectRatio)`로 높이를 산출하며 `minHeight`(기본 `200px`, `responsive: false`일 때 `180px`) ~ `maxHeight` 범위로 클램핑합니다.
- **연속 스케일 여백 (`computeResponsivePadding`)**: `width` (`200~640px` → `0.68~1.0`), `height` (`160~400px` → `0.72~1.0`) 중 작은 비율로 기본 여백을 축소합니다.
- **Y축 라벨 폭 기반 좌측 여백 자동 산출**: `userPadding.left` 미지정 시 Y축 눈금 최대 문자열 길이 × 문자 폭(`compact: 6.0px`, 일반 `6.6px`) + `labelOffset` + `8px`로 계산하되, 최소 `32px`(compact)/`40px`, 최대 `width * 0.28` 범위로 제한합니다.
- **컴팩트 모드 기준**: `width < compactBreakpoint` (기본 `480px`).

---

## 4. 축 / 그리드 / 범례 배치 규칙

- **그리드 (`Grid`)**:
  - 렌더링 순서: `1. alternateBand` → `2. Y 수평선` → `3. X 수직선` → `4. plot border`.
  - 1px 선명도를 위해 좌표에 `Math.round(coord) + 0.5` 하프 픽셀 보정을 적용합니다.
  - 선 스타일 프리셋(`resolveGridLineDash`): `'solid'` → `[]`, `'dashed'` → `[5, 4]`, `'dotted'` → `[2, 3]`, 기본값 `[3, 3]`.
- **범례 (`Legend`, 12방향 배치)**:
  - `parseLegendAnchor()`로 `top-*`, `bottom-*`, `left-*`, `right-*`를 `{ side, align }`으로 해석합니다.
  - 범례 표시 시 차트 플롯 겹침 방지를 위해 `getReservedPadding()`으로 추가 여백을 확보합니다: `top: +28px`, `bottom: +30px`, `left: +120px`, `right: +120px`.
  - 차트별 범례 기본 위치: `BarChart`/`LineChart`는 `top`/`end`(다중 시리즈일 때 기본 표시), `PieChart`는 `bottom`/`center`/`circle`(기본 표시), `FunnelChart`는 `top`/`center`/`rounded`(기본 표시).

---

## 5. 스타일 격리 방식

외부 페이지의 전역 CSS(Tailwind Preflight, Bootstrap, Reset CSS 등)와 충돌하지 않도록 DOM 요소에 방어적 인라인 스타일을 적용합니다.

- **컨테이너**: `position: relative`, `userSelect: none`.
- **Canvas 레이어 (`LayerManager`)**: `display: block`, `maxWidth: none`, `boxSizing: border-box`, `position: absolute`, `top: 0`, `left: 0`. 최상단 `interaction`만 `pointerEvents: auto`, 하단 2개 레이어는 `pointerEvents: none`.
- **범례 (`Legend`)**: 루트 `z-index: 10`, `boxSizing: border-box`, `margin: 0`, `padding: 0`. 각 항목 `<button type="button">`에 `appearance: none`, `background: transparent`, `border: none`, `outline: none`, `minHeight: 0`, `minWidth: 0`, `textTransform: none`, `letterSpacing: normal`을 명시해 호스트 앱 버튼 스타일 오염을 차단합니다.
- **툴팁 (`Tooltip`)**: `z-index: 9999`, `pointerEvents: none`, `boxSizing: border-box`, `margin: 0`, `textAlign: left`, `whiteSpace: nowrap`, `backdropFilter: blur(8px)`.
