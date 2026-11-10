const NANOCHARTS_BUILD_META = {"version":"0.1.9","buildId":"0.1.9-1794289981024","buildTime":1794289981024,"builtAt":"2026-11-10T05:53:01.024Z","githubRepo":"junwoo1519/nanocharts","githubBranch":"main","npmPackage":"@ju9nu7/nanocharts"};
/**
 * @fileoverview NanoCharts Figma Plugin Sandbox Controller (code.ts)
 *
 * 피그마 메인 스레드(Sandbox)에서 실행되며,
 * 1. UI(iframe)에서 `@ju9nu7/nanocharts`의 `toSVG()`로 생성한 순수 벡터(SVG)를 전달받아
 *    `figma.createNodeFromSvg()`를 통해 편집 가능한 Frame, Rectangle, Vector, Text 레이어로 변환합니다.
 * 2. 현재 열린 피그마 프로젝트(A 프로젝트, B 프로젝트 등)의 Local Color Variables를 감지하여
 *    `variables.scss` 토큰명(`primary`, `surface-ultra-low`, `on-surface`, `outline`, `teal`, `indigo` 등)과
 *    일치하는 피그마 변수로 차트 도형(단색 Fill, Stroke, 그라데이션 Stop) 및 텍스트의 색상을 100% 자동 바인딩합니다.
 * 3. 만약 현재 피그마 파일에 해당 변수가 아직 등록되어 있지 않다면, 삽입 시 자동으로 로컬 변수 컬렉션에
 *    변수를 생성하여 16진수(HEX) 하드코딩 대신 항상 피그마 Variable이 적용되도록 보장합니다.
 * 4. 생성된 노드에 `setPluginData`로 차트 설정을 보존하여 재선택 시 즉시 수정할 수 있게 지원합니다.
 */
const PLUGIN_DATA_KEY = 'nanocharts-state';
const OTA_CACHE_KEY = 'nanocharts-ota-cache-v1';
let lastAppliedOtaBuildTime = typeof NANOCHARTS_BUILD_META !== 'undefined' && (NANOCHARTS_BUILD_META === null || NANOCHARTS_BUILD_META === void 0 ? void 0 : NANOCHARTS_BUILD_META.buildTime)
    ? NANOCHARTS_BUILD_META.buildTime
    : 0;
const LEGACY_COLLECTION_NAME = 'Design Tokens (variables.scss)';
const SEMANTIC_COLLECTION_NAME = '2.Color token';
const POINT_COLLECTION_NAME = '3.Color token - point';
const RADIUS_COLLECTION_NAME = '4.Radius';
const SPACING_COLLECTION_NAME = '5.Spacing';
const DEFAULT_RADIUS_TOKENS = {
    'rounded-xxs': 2,
    'rounded-xs': 3,
    'rounded-sm': 4,
    'rounded-md': 6,
    'rounded-lg': 8,
    'rounded-xl': 12,
    'rounded-xxl': 16,
    'rounded-full': 999,
};
const DEFAULT_SPACING_TOKENS = {
    'padding/p-0_5': 2,
    'padding/p-1': 4,
    'padding/p-1_5': 6,
    'padding/p-2': 8,
    'padding/p-3': 12,
    'padding/p-4': 16,
    'padding/p-5': 20,
    'padding/p-6': 24,
    'padding/p-7': 28,
    'padding/p-8': 32,
    'padding/p-9': 36,
    'padding/p-10': 40,
    'gap/gap-0_5': 2,
    'gap/gap-1': 4,
    'gap/gap-1_5': 6,
    'gap/gap-2': 8,
    'gap/gap-3': 12,
    'gap/gap-4': 16,
    'gap/gap-5': 20,
    'gap/gap-6': 24,
    'gap/gap-7': 28,
    'gap/gap-8': 32,
    'gap/gap-9': 36,
    'gap/gap-10': 40,
};
const SEMANTIC_GROUPS = new Set([
    'primary',
    'on-primary',
    'surface',
    'on-surface',
    'outline',
    'transparent',
    'overlay',
    'variant',
]);
const POINT_COLOR_BASES = new Set([
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'teal',
    'cyan',
    'sky',
    'blue',
    'indigo',
    'purple',
    'violet',
    'pink',
]);
const NUMERIC_SCALE_TO_STEPS = {
    '30': ['ultra-low', 'lower', 'lowest'],
    '40': ['ultra-low', 'lowest'],
    '50': ['lowest', 'low', 'ultra-low'],
    '100': ['lower'],
    '200': ['low', 'mid'],
    '300': ['mid'],
    '400': ['high', 'low'],
    '500': [''],
    '600': ['higher', 'mid'],
    '700': ['highest'],
    '800': ['ultra-high', 'highest', 'high'],
    '900': ['ultra-high', 'highest', 'higher'],
    '950': ['ultra-high', 'highest'],
};
const POINT_NUMERIC_SCALE_TO_STEPS = {
    '30': ['lower'],
    '50': ['low'],
    '100': ['lower', 'low'],
    '200': ['mid'],
    '400': ['high'],
    '500': [''],
    '600': ['higher'],
    '800': ['highest'],
    '900': ['highest', 'higher'],
    '950': ['highest'],
};
const TRANSPARENCY_SCALE_TO_TOKEN = {
    '20': 'overlay-gray',
    '30': 'overlay-gray-lower',
    '40': 'overlay-gray-low',
    '50': 'overlay-gray-mid',
    '100': 'overlay-gray-high',
    '200': 'overlay-gray-higher',
};
/**
 * 플러그인 시작 시 로컬 빌드 타임스탬프와 `figma.clientStorage`에 캐시된 원격(GitHub OTA) 번들을 비교하여
 * 더 최신인 UI 번들로 실행합니다.
 */
async function bootPluginUiAsync() {
    let uiHtmlToLoad = __html__;
    const localBuildTime = typeof NANOCHARTS_BUILD_META !== 'undefined' && (NANOCHARTS_BUILD_META === null || NANOCHARTS_BUILD_META === void 0 ? void 0 : NANOCHARTS_BUILD_META.buildTime)
        ? NANOCHARTS_BUILD_META.buildTime
        : 0;
    try {
        if (figma.clientStorage && typeof figma.clientStorage.getAsync === 'function') {
            const cached = await figma.clientStorage.getAsync(OTA_CACHE_KEY);
            if (cached &&
                typeof cached.buildTime === 'number' &&
                cached.buildTime > localBuildTime &&
                typeof cached.uiHtml === 'string' &&
                cached.uiHtml.includes('NanoCharts')) {
                uiHtmlToLoad = cached.uiHtml;
                lastAppliedOtaBuildTime = cached.buildTime;
            }
        }
    }
    catch (_a) {
        // clientStorage 접근 실패 시 기본 내장 __html__ 사용
    }
    figma.showUI(uiHtmlToLoad, {
        width: 920,
        height: 680,
        themeColors: true,
    });
    notifySelectionState();
    notifyProjectVariables();
}
bootPluginUiAsync();
/**
 * 피그마 변수명(`--primary`, `primary/-`, `primary/lower`, `Primary/500`, `point red/500`, `overlay/white/low`, `Transparency/50`)을
 * 표준 토큰 키(`primary`, `primary-lower`, `red`, `overlay-white-low`, `overlay-gray-mid`)로 정규화합니다.
 */
function normalizeTokenKey(raw) {
    let s = (raw || '').trim();
    const varMatch = s.match(/^var\(\s*--([a-zA-Z0-9_/-]+)(?:\s*,\s*([^)]+))?\s*\)$/);
    if (varMatch) {
        s = varMatch[1];
    }
    s = s.replace(/^--+/, '');
    s = s.replace(/^(?:color|colors|token|tokens|point|theme|palette|weseed|semantic|primitive)[\s/-]+/i, '');
    // 디자이너 변수 구조의 기본값 표기(`primary/-`, `overlay/white/-`, `primary/default`, `primary/base`) 제거
    s = s.replace(/[/-](?:default|base|-)+$/i, '');
    s = s
        .replace(/\//g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    // Transparency/20 ~ Transparency/200 -> overlay-gray-* 매핑
    const transMatch = s.match(/^transparency-(\d+)$/);
    if (transMatch && TRANSPARENCY_SCALE_TO_TOKEN[transMatch[1]]) {
        return TRANSPARENCY_SCALE_TO_TOKEN[transMatch[1]];
    }
    return s;
}
/**
 * 표준 토큰 키(`primary`, `primary-lower`, `overlay-white-low`, `overlay-black`)를
 * 디자이너의 피그마 변수 폴더 구조(`primary/-`, `primary/lower`, `overlay/white/low`, `overlay/black/-`)로 변환합니다.
 */
function toFigmaVariableName(rawKey) {
    const trimmed = (rawKey || '').trim();
    if (!trimmed)
        return 'primary/-';
    if (trimmed.includes('/')) {
        return trimmed.replace(/\s*\/\s*/g, '/');
    }
    const norm = normalizeTokenKey(trimmed);
    // 3단 폴더 구조: overlay/white/*, overlay/gray/*, overlay/black/*
    const overlayMatch = norm.match(/^overlay-(white|gray|black)(?:-(ultra-low|lowest|lower|low|mid|high|higher|highest|ultra-high|\d+))?$/);
    if (overlayMatch) {
        return `overlay/${overlayMatch[1]}/${overlayMatch[2] || '-'}`;
    }
    if (norm === 'transparent') {
        return 'transparent';
    }
    const stepMatch = norm.match(/^(.+)-(ultra-low|lowest|lower|low|mid|high|higher|highest|ultra-high|\d+)$/);
    if (stepMatch) {
        return `${stepMatch[1]}/${stepMatch[2]}`;
    }
    return `${norm}/-`;
}
/**
 * 폴더 계층 구조를 가진 피그마 변수명(예: `primary/-`, `primary/lower`, `Primary/500`, `point/teal/-`)에서
 * 매칭 가능한 모든 후보 토큰 키 배열을 우선순위 순으로 추출합니다.
 */
function extractCandidateTokenKeys(rawName) {
    const candidates = new Set();
    const trimmedLower = (rawName || '').trim().toLowerCase();
    if (trimmedLower) {
        candidates.add(trimmedLower);
    }
    const full = normalizeTokenKey(rawName);
    if (full) {
        candidates.add(full);
        candidates.add(toFigmaVariableName(full).toLowerCase());
    }
    const rawParts = (rawName || '')
        .split('/')
        .map((p) => p.trim())
        .filter(Boolean);
    // 마지막 파트가 '-', 'default', 'base'인 경우 상위 폴더 자체가 베이스 토큰명 (예: ['primary', '-'] -> 'primary')
    const effectiveParts = [...rawParts];
    while (effectiveParts.length > 1 &&
        /^(?:-|default|base)$/i.test(effectiveParts[effectiveParts.length - 1])) {
        effectiveParts.pop();
    }
    if (effectiveParts.length >= 1) {
        const joined = normalizeTokenKey(effectiveParts.join('/'));
        if (joined) {
            candidates.add(joined);
            candidates.add(`${joined}/-`);
        }
        const lastPart = normalizeTokenKey(effectiveParts[effectiveParts.length - 1]);
        if (effectiveParts.length === 1 && lastPart) {
            candidates.add(lastPart);
            candidates.add(`${lastPart}/-`);
        }
    }
    if (effectiveParts.length >= 2) {
        const lastTwo = normalizeTokenKey(effectiveParts.slice(-2).join('-'));
        const lastTwoSlash = `${normalizeTokenKey(effectiveParts[effectiveParts.length - 2])}/${normalizeTokenKey(effectiveParts[effectiveParts.length - 1])}`;
        if (lastTwo)
            candidates.add(lastTwo);
        if (lastTwoSlash)
            candidates.add(lastTwoSlash);
        // 예: "Primary/primary-high" -> "primary-high"
        const firstNorm = normalizeTokenKey(effectiveParts[0]);
        const restNorm = normalizeTokenKey(effectiveParts.slice(1).join('-'));
        if (firstNorm && restNorm && restNorm.startsWith(firstNorm + '-')) {
            candidates.add(restNorm);
            candidates.add(toFigmaVariableName(restNorm).toLowerCase());
        }
        if (firstNorm && restNorm && firstNorm === restNorm) {
            candidates.add(firstNorm);
            candidates.add(`${firstNorm}/-`);
        }
    }
    // 숫자 스케일(예: Primary/500 -> primary, point red/30 -> red-lower) 후보 추가
    const numMatch = full.match(/^([a-z-]+)-(\d+)$/);
    if (numMatch) {
        const base = numMatch[1];
        const num = numMatch[2];
        const mappedSteps = POINT_COLOR_BASES.has(base)
            ? POINT_NUMERIC_SCALE_TO_STEPS[num] || NUMERIC_SCALE_TO_STEPS[num]
            : NUMERIC_SCALE_TO_STEPS[num];
        if (mappedSteps) {
            for (const step of mappedSteps) {
                const semanticKey = step ? `${base}-${step}` : base;
                candidates.add(semanticKey);
                candidates.add(step ? `${base}/${step}` : `${base}/-`);
            }
        }
    }
    return Array.from(candidates);
}
/**
 * 피그마 0~1 RGB 객체를 대문자 `#RRGGBB` 문자열로 변환합니다.
 */
function rgbToHex(color) {
    const r = Math.max(0, Math.min(255, Math.round(color.r * 255)));
    const g = Math.max(0, Math.min(255, Math.round(color.g * 255)));
    const b = Math.max(0, Math.min(255, Math.round(color.b * 255)));
    return ('#' +
        [r, g, b]
            .map((v) => v.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase());
}
/**
 * `#RRGGBB` 문자열을 피그마 0~1 `{ r, g, b }` 객체로 변환합니다.
 */
function hexToRgb(hex) {
    const clean = (hex || '').trim().replace(/^#/, '');
    if (clean.length === 3) {
        const r = parseInt(clean[0] + clean[0], 16) / 255;
        const g = parseInt(clean[1] + clean[1], 16) / 255;
        const b = parseInt(clean[2] + clean[2], 16) / 255;
        return { r, g, b };
    }
    if (clean.length >= 6) {
        const r = parseInt(clean.slice(0, 2), 16) / 255;
        const g = parseInt(clean.slice(2, 4), 16) / 255;
        const b = parseInt(clean.slice(4, 6), 16) / 255;
        return { r, g, b };
    }
    return null;
}
/**
 * 피그마 버전별 `createVariable` 시그니처 차이(Collection 객체 vs Collection ID)를 안전하게 처리합니다.
 */
function safeCreateColorVariable(name, collection) {
    try {
        return figma.variables.createVariable(name, collection, 'COLOR');
    }
    catch (_a) {
        return figma.variables.createVariable(name, collection.id, 'COLOR');
    }
}
/**
 * 변수의 첫 번째 모드 색상값 및 투명도(`alpha`)를 해석합니다 (`VARIABLE_ALIAS` 별칭 참조 포함).
 */
async function resolveVariableColorInfoAsync(variable, depth = 0, varById) {
    if (!variable || !variable.valuesByMode || depth > 5)
        return null;
    const modeIds = Object.keys(variable.valuesByMode);
    if (modeIds.length === 0)
        return null;
    const val = variable.valuesByMode[modeIds[0]];
    if (!val || typeof val !== 'object')
        return null;
    if (typeof val.r === 'number' && typeof val.g === 'number' && typeof val.b === 'number') {
        const hex = rgbToHex(val);
        const alpha = typeof val.a === 'number' ? Math.max(0, Math.min(1, Number(val.a.toFixed(3)))) : 1;
        const r = Math.max(0, Math.min(255, Math.round(val.r * 255)));
        const g = Math.max(0, Math.min(255, Math.round(val.g * 255)));
        const b = Math.max(0, Math.min(255, Math.round(val.b * 255)));
        const cssColor = alpha < 0.999 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : hex;
        return { hex, alpha, cssColor };
    }
    if (val.type === 'VARIABLE_ALIAS' && val.id) {
        const cachedTarget = varById === null || varById === void 0 ? void 0 : varById.get(val.id);
        if (cachedTarget) {
            return await resolveVariableColorInfoAsync(cachedTarget, depth + 1, varById);
        }
        if (typeof figma.variables.getVariableByIdAsync === 'function') {
            try {
                const aliasedVar = await figma.variables.getVariableByIdAsync(val.id);
                if (aliasedVar) {
                    return await resolveVariableColorInfoAsync(aliasedVar, depth + 1, varById);
                }
            }
            catch (_a) {
                return null;
            }
        }
    }
    return null;
}
const semiTransparentVariableIds = new Set();
/**
 * 컬렉션 이름에 따른 스캔 우선순위를 반환합니다 (낮을수록 최우선 매칭).
 * 1순위: 2.Color token (시맨틱 토큰)
 * 2순위: 3.Color token - point (포인트 컬러 토큰)
 * 3순위: 1.Color Palette 및 기타 사용자 컬렉션
 */
function getCollectionPriority(collectionName) {
    const lower = (collectionName || '').toLowerCase();
    if (lower.includes('token') && !lower.includes('point') && !lower.includes('variables.scss')) {
        return 0;
    }
    if (lower.includes('token') && lower.includes('point')) {
        return 1;
    }
    if (lower.includes('palette')) {
        return 2;
    }
    if (collectionName === LEGACY_COLLECTION_NAME) {
        return 99;
    }
    return 3;
}
/**
 * 현재 열려 있는 피그마 프로젝트의 로컬 컬러 변수(Local Color Variables)를 스캔하여
 * 정규화된 토큰 키 맵, HEX 역매핑 맵, 실제 HEX 색상 맵, 변수 목록을 반환합니다.
 */
async function scanProjectColorVariables() {
    var _a;
    const variableMap = new Map();
    const hexToVariableMap = new Map();
    const tokenHexMap = {};
    const tokenToVarNameMap = {};
    const projectVariables = [];
    let hasDesignerCollections = false;
    if (!figma.variables || typeof figma.variables.getLocalVariablesAsync !== 'function') {
        return {
            variableMap,
            hexToVariableMap,
            tokenHexMap,
            tokenToVarNameMap,
            projectVariables,
            hasDesignerCollections,
        };
    }
    try {
        const collections = typeof figma.variables.getLocalVariableCollectionsAsync === 'function'
            ? await figma.variables.getLocalVariableCollectionsAsync()
            : [];
        const collectionById = new Map();
        for (const c of collections) {
            collectionById.set(c.id, c);
        }
        let localVars = await figma.variables.getLocalVariablesAsync('COLOR');
        // 기존에 잘못 생성된 평면 구조의 'Design Tokens (variables.scss)' 컬렉션이 있고,
        // 프로젝트에 실제 디자이너 컬렉션(1.Color Palette, 2.Color token 등)이 존재하면 자동 정리
        const legacyCol = collections.find((c) => c.name === LEGACY_COLLECTION_NAME);
        const otherColorVars = localVars.filter((v) => { var _a; return ((_a = collectionById.get(v.variableCollectionId)) === null || _a === void 0 ? void 0 : _a.name) !== LEGACY_COLLECTION_NAME; });
        if (legacyCol && otherColorVars.length > 0) {
            try {
                legacyCol.remove();
                localVars = otherColorVars;
                collectionById.delete(legacyCol.id);
            }
            catch (_b) {
                // 삭제 권한이 없는 경우 스캔 대상에서만 제외
                localVars = otherColorVars;
            }
        }
        if (otherColorVars.length > 0) {
            hasDesignerCollections = true;
        }
        const varById = new Map();
        for (const v of localVars) {
            varById.set(v.id, v);
        }
        // 컬렉션 우선순위(2.Color token -> 3.Color token - point -> 1.Color Palette) 순으로 정렬
        const sortedVars = [...localVars].sort((a, b) => {
            var _a, _b;
            const colA = ((_a = collectionById.get(a.variableCollectionId)) === null || _a === void 0 ? void 0 : _a.name) || '';
            const colB = ((_b = collectionById.get(b.variableCollectionId)) === null || _b === void 0 ? void 0 : _b.name) || '';
            const prioDiff = getCollectionPriority(colA) - getCollectionPriority(colB);
            if (prioDiff !== 0)
                return prioDiff;
            return (a.name || '').localeCompare(b.name || '');
        });
        for (const v of sortedVars) {
            const colName = ((_a = collectionById.get(v.variableCollectionId)) === null || _a === void 0 ? void 0 : _a.name) || 'Local';
            const candidateKeys = extractCandidateTokenKeys(v.name);
            const colorInfo = await resolveVariableColorInfoAsync(v, 0, varById);
            const exactLower = (v.name || '').trim().toLowerCase();
            const normKey = normalizeTokenKey(v.name);
            if (colorInfo) {
                const isSemi = colorInfo.alpha < 0.999;
                if (isSemi && v.id) {
                    semiTransparentVariableIds.add(v.id);
                }
                const displayHex = isSemi
                    ? `${colorInfo.hex} (${Math.round(colorInfo.alpha * 100)}%)`
                    : colorInfo.hex;
                projectVariables.push({
                    name: v.name,
                    collectionName: colName,
                    hex: displayHex,
                    normKey,
                });
            }
            // 정확한 원본 변수명(대소문자 원본 및 소문자) 최우선 등록
            if (exactLower && !variableMap.has(exactLower)) {
                variableMap.set(exactLower, v);
            }
            if (colorInfo) {
                const colorVal = colorInfo.cssColor;
                if (!tokenHexMap[v.name])
                    tokenHexMap[v.name] = colorVal;
                if (!tokenHexMap[exactLower])
                    tokenHexMap[exactLower] = colorVal;
                if (!tokenToVarNameMap[v.name])
                    tokenToVarNameMap[v.name] = v.name;
                if (!tokenToVarNameMap[exactLower])
                    tokenToVarNameMap[exactLower] = v.name;
            }
            for (const key of candidateKeys) {
                if (!variableMap.has(key)) {
                    variableMap.set(key, v);
                }
                if (colorInfo && !tokenHexMap[key]) {
                    tokenHexMap[key] = colorInfo.cssColor;
                }
                if (!tokenToVarNameMap[key]) {
                    tokenToVarNameMap[key] = v.name;
                }
            }
            if (colorInfo) {
                if (colorInfo.alpha >= 0.999) {
                    if (!hexToVariableMap.has(colorInfo.hex)) {
                        hexToVariableMap.set(colorInfo.hex, v);
                    }
                }
                else {
                    // 반투명 오버레이 변수(overlay/white/*, overlay/gray/*, overlay/black/*)는
                    // 불투명 #FFFFFF / #06131F를 덮어쓰지 않고 `#HEX@투명도%` 및 `RGBA(...)` 키로 등록
                    const alphaPctKey = `${colorInfo.hex}@${Math.round(colorInfo.alpha * 100)}`;
                    if (!hexToVariableMap.has(alphaPctKey)) {
                        hexToVariableMap.set(alphaPctKey, v);
                    }
                    const upperCss = colorInfo.cssColor.toUpperCase();
                    if (!hexToVariableMap.has(upperCss)) {
                        hexToVariableMap.set(upperCss, v);
                    }
                }
            }
        }
    }
    catch (_c) {
        // 변수 API 미지원 환경 무시
    }
    return {
        variableMap,
        hexToVariableMap,
        tokenHexMap,
        tokenToVarNameMap,
        projectVariables,
        hasDesignerCollections,
    };
}
/**
 * 현재 열려 있는 피그마 프로젝트의 `4.Radius` 숫자형 변수(FLOAT Variables)를 스캔합니다.
 */
async function scanProjectRadiusVariables() {
    var _a;
    const radiusVarByName = new Map();
    const radiusVarByValue = new Map();
    const radiusTokensMap = Object.assign({}, DEFAULT_RADIUS_TOKENS);
    if (!figma.variables || typeof figma.variables.getLocalVariablesAsync !== 'function') {
        return { radiusVarByName, radiusVarByValue, radiusTokensMap };
    }
    try {
        const collections = typeof figma.variables.getLocalVariableCollectionsAsync === 'function'
            ? await figma.variables.getLocalVariableCollectionsAsync()
            : [];
        const collectionById = new Map();
        for (const c of collections) {
            collectionById.set(c.id, c);
        }
        const floatVars = await figma.variables.getLocalVariablesAsync('FLOAT');
        const varById = new Map();
        for (const v of floatVars) {
            varById.set(v.id, v);
        }
        const resolveFloatVal = (v, depth = 0) => {
            if (!v || !v.valuesByMode || depth > 4)
                return null;
            const modeIds = Object.keys(v.valuesByMode);
            if (modeIds.length === 0)
                return null;
            const val = v.valuesByMode[modeIds[0]];
            if (typeof val === 'number')
                return val;
            if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS' && val.id) {
                const target = varById.get(val.id);
                if (target)
                    return resolveFloatVal(target, depth + 1);
            }
            return null;
        };
        // 4.Radius 컬렉션 또는 rounded-* 이름을 가진 변수를 최우선 스캔
        const sortedFloatVars = [...floatVars].sort((a, b) => {
            var _a, _b;
            const colA = (((_a = collectionById.get(a.variableCollectionId)) === null || _a === void 0 ? void 0 : _a.name) || '').toLowerCase();
            const colB = (((_b = collectionById.get(b.variableCollectionId)) === null || _b === void 0 ? void 0 : _b.name) || '').toLowerCase();
            const isRadA = colA.includes('radius') || (a.name || '').toLowerCase().includes('rounded') ? 0 : 1;
            const isRadB = colB.includes('radius') || (b.name || '').toLowerCase().includes('rounded') ? 0 : 1;
            return isRadA - isRadB;
        });
        for (const v of sortedFloatVars) {
            const colName = (((_a = collectionById.get(v.variableCollectionId)) === null || _a === void 0 ? void 0 : _a.name) || '').toLowerCase();
            const varName = (v.name || '').trim();
            const lowerName = varName.toLowerCase();
            const isRadiusCollection = colName.includes('radius') || lowerName.startsWith('rounded') || lowerName.includes('radius');
            if (!isRadiusCollection)
                continue;
            const numVal = resolveFloatVal(v);
            if (numVal === null)
                continue;
            const shortKey = lowerName.split('/').pop() || lowerName;
            if (!radiusVarByName.has(lowerName))
                radiusVarByName.set(lowerName, v);
            if (!radiusVarByName.has(shortKey))
                radiusVarByName.set(shortKey, v);
            if (!radiusVarByValue.has(Math.round(numVal))) {
                radiusVarByValue.set(Math.round(numVal), v);
            }
            radiusTokensMap[shortKey] = Math.round(numVal);
        }
    }
    catch (_b) {
        // FLOAT 변수 스캔 실패 시 기본값 유지
    }
    return { radiusVarByName, radiusVarByValue, radiusTokensMap };
}
/**
 * 현재 열려 있는 피그마 프로젝트의 `5.Spacing` 숫자형 변수(`padding/*`, `gap/*`)를 스캔합니다.
 */
async function scanProjectSpacingVariables() {
    var _a;
    const spacingVarByName = new Map();
    const paddingVarByValue = new Map();
    const gapVarByValue = new Map();
    const spacingTokensMap = Object.assign({}, DEFAULT_SPACING_TOKENS);
    let spacingCount = 0;
    if (!figma.variables || typeof figma.variables.getLocalVariablesAsync !== 'function') {
        return { spacingVarByName, paddingVarByValue, gapVarByValue, spacingTokensMap, spacingCount };
    }
    try {
        const collections = typeof figma.variables.getLocalVariableCollectionsAsync === 'function'
            ? await figma.variables.getLocalVariableCollectionsAsync()
            : [];
        const collectionById = new Map();
        for (const c of collections) {
            collectionById.set(c.id, c);
        }
        const floatVars = await figma.variables.getLocalVariablesAsync('FLOAT');
        const varById = new Map();
        for (const v of floatVars) {
            varById.set(v.id, v);
        }
        const resolveFloatVal = (v, depth = 0) => {
            if (!v || !v.valuesByMode || depth > 4)
                return null;
            const modeIds = Object.keys(v.valuesByMode);
            if (modeIds.length === 0)
                return null;
            const val = v.valuesByMode[modeIds[0]];
            if (typeof val === 'number')
                return val;
            if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS' && val.id) {
                const target = varById.get(val.id);
                if (target)
                    return resolveFloatVal(target, depth + 1);
            }
            return null;
        };
        for (const v of floatVars) {
            const colName = (((_a = collectionById.get(v.variableCollectionId)) === null || _a === void 0 ? void 0 : _a.name) || '').toLowerCase();
            const varName = (v.name || '').trim();
            const lowerName = varName.toLowerCase();
            const isSpacing = colName.includes('spacing') ||
                lowerName.startsWith('padding/') ||
                lowerName.startsWith('gap/') ||
                /^p-\d/.test(lowerName) ||
                /^gap-\d/.test(lowerName);
            if (!isSpacing)
                continue;
            const numVal = resolveFloatVal(v);
            if (numVal === null)
                continue;
            spacingCount++;
            const shortKey = lowerName.split('/').pop() || lowerName;
            if (!spacingVarByName.has(lowerName))
                spacingVarByName.set(lowerName, v);
            if (!spacingVarByName.has(shortKey))
                spacingVarByName.set(shortKey, v);
            const rounded = Math.round(numVal);
            if (lowerName.includes('padding') || shortKey.startsWith('p-')) {
                const fullKey = `padding/${shortKey}`;
                if (!spacingVarByName.has(fullKey))
                    spacingVarByName.set(fullKey, v);
                if (!paddingVarByValue.has(rounded))
                    paddingVarByValue.set(rounded, v);
                spacingTokensMap[fullKey] = rounded;
            }
            else if (lowerName.includes('gap') || shortKey.startsWith('gap-')) {
                const fullKey = `gap/${shortKey}`;
                if (!spacingVarByName.has(fullKey))
                    spacingVarByName.set(fullKey, v);
                if (!gapVarByValue.has(rounded))
                    gapVarByValue.set(rounded, v);
                spacingTokensMap[fullKey] = rounded;
            }
        }
    }
    catch (_b) {
        // FLOAT 변수 스캔 실패 시 기본값 유지
    }
    return { spacingVarByName, paddingVarByValue, gapVarByValue, spacingTokensMap, spacingCount };
}
/**
 * 현재 프로젝트의 변수 스캔 결과를 UI로 전송합니다.
 */
async function notifyProjectVariables() {
    const { tokenHexMap, tokenToVarNameMap, projectVariables } = await scanProjectColorVariables();
    const { radiusTokensMap } = await scanProjectRadiusVariables();
    const { spacingTokensMap, spacingCount } = await scanProjectSpacingVariables();
    figma.ui.postMessage({
        type: 'PROJECT_VARIABLES_STATE',
        matchedCount: projectVariables.length,
        radiusMatchedCount: Object.keys(radiusTokensMap).length,
        spacingMatchedCount: spacingCount,
        tokenHexMap,
        tokenToVarNameMap,
        projectVariables,
        radiusTokensMap,
        spacingTokensMap,
    });
}
/**
 * 토큰 그룹명(`primary`, `surface` vs `teal`, `indigo` 등)에 맞춰
 * 디자이너 변수 컬렉션(`2.Color token` 또는 `3.Color token - point`)을 가져오거나 생성합니다.
 */
async function getOrCreateCollectionForTokenAsync(tokenKey) {
    if (!figma.variables || typeof figma.variables.createVariableCollection !== 'function') {
        return null;
    }
    try {
        const figmaVarName = toFigmaVariableName(tokenKey);
        const groupName = figmaVarName.split('/')[0].toLowerCase();
        const targetColName = SEMANTIC_GROUPS.has(groupName)
            ? SEMANTIC_COLLECTION_NAME
            : POINT_COLLECTION_NAME;
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        let collection = collections.find((c) => c.name === targetColName) ||
            collections.find((c) => SEMANTIC_GROUPS.has(groupName)
                ? c.name.toLowerCase().includes('token') && !c.name.toLowerCase().includes('point')
                : c.name.toLowerCase().includes('point'));
        if (!collection) {
            collection = figma.variables.createVariableCollection(targetColName);
        }
        const modeId = collection.modes[0].modeId;
        return { collection, modeId };
    }
    catch (_a) {
        return null;
    }
}
/**
 * 변수 맵(`variableMap`)에서 사용자가 지정한 토큰 문자열(`primary/-`, `primary/lower`, `Primary/500`, `primary`)에
 * 해당하는 피그마 Variable을 탐색합니다.
 */
function lookupVariableByTokenInput(rawInput, variableMap) {
    if (!rawInput)
        return null;
    const trimmed = rawInput.trim();
    const lower = trimmed.toLowerCase();
    if (variableMap.has(lower))
        return variableMap.get(lower);
    const slashForm = toFigmaVariableName(trimmed).toLowerCase();
    if (variableMap.has(slashForm))
        return variableMap.get(slashForm);
    const norm = normalizeTokenKey(trimmed);
    if (variableMap.has(norm))
        return variableMap.get(norm);
    const normSlash = toFigmaVariableName(norm).toLowerCase();
    if (variableMap.has(normSlash))
        return variableMap.get(normSlash);
    return null;
}
/**
 * 차트에서 사용된 토큰(`hexToTokenMap`)을 현재 피그마 파일의 변수와 매칭하고,
 * 변수 컬렉션이 아예 없는 빈 파일일 때만 디자이너 폴더 구조(`primary/-`, `primary/lower` 등)로 생성합니다.
 */
async function ensureChartVariablesAsync(hexToTokenMap, allTokens) {
    const { variableMap, hexToVariableMap, hasDesignerCollections } = await scanProjectColorVariables();
    const reverseDesignTokens = {};
    if (allTokens) {
        for (const [tokenKey, hexVal] of Object.entries(allTokens)) {
            const upper = (hexVal || '').trim().toUpperCase();
            if (upper.startsWith('#') && !reverseDesignTokens[upper]) {
                reverseDesignTokens[upper] = normalizeTokenKey(tokenKey);
            }
        }
    }
    let autoCreatedCount = 0;
    for (const [hex, rawTokenName] of Object.entries(hexToTokenMap)) {
        if (!rawTokenName)
            continue;
        let targetVar = lookupVariableByTokenInput(rawTokenName, variableMap);
        // 파일에 디자이너 컬렉션이 아예 없는 상태에서만 폴더 계층 구조(primary/-, primary/lower)로 생성
        if (!targetVar && !hasDesignerCollections) {
            const colInfo = await getOrCreateCollectionForTokenAsync(rawTokenName);
            const rgb = hexToRgb(hex);
            if (colInfo && rgb) {
                try {
                    const hierarchicalName = toFigmaVariableName(rawTokenName);
                    targetVar = safeCreateColorVariable(hierarchicalName, colInfo.collection);
                    targetVar.setValueForMode(colInfo.modeId, rgb);
                    for (const k of extractCandidateTokenKeys(hierarchicalName)) {
                        variableMap.set(k, targetVar);
                    }
                    hexToVariableMap.set(hex.toUpperCase(), targetVar);
                    autoCreatedCount++;
                }
                catch (_a) {
                    // 개별 변수 생성 실패 시 무시
                }
            }
        }
        else if (targetVar) {
            hexToVariableMap.set(hex.toUpperCase(), targetVar);
        }
    }
    return { variableMap, hexToVariableMap, reverseDesignTokens, autoCreatedCount };
}
/**
 * 특정 HEX 색상 및 투명도(`opacity`, 0~1)에 대응하는 피그마 `Variable`을 찾아 반환합니다.
 */
async function resolveOrCreateVariableForHexAsync(hex, hexToTokenMap, reverseDesignTokens, variableMap, hexToVariableMap, opacity = 1) {
    const upperHex = (hex || '').toUpperCase();
    if (!upperHex.startsWith('#'))
        return null;
    // 0. 반투명 Paint(`overlay/white/low`, `overlay/black/mid`, `overlay/gray/-` 등)인 경우 `#HEX@투명도%` 우선 매칭
    if (opacity < 0.999) {
        const alphaPctKey = `${upperHex}@${Math.round(opacity * 100)}`;
        const explicitAlphaToken = hexToTokenMap[alphaPctKey];
        if (explicitAlphaToken) {
            const v = lookupVariableByTokenInput(explicitAlphaToken, variableMap);
            if (v)
                return v;
        }
        if (hexToVariableMap.has(alphaPctKey)) {
            return hexToVariableMap.get(alphaPctKey);
        }
    }
    // 1. 차트에서 명시적으로 사용한 토큰 매핑 최우선 확인
    const explicitToken = hexToTokenMap[upperHex];
    if (explicitToken) {
        const v = lookupVariableByTokenInput(explicitToken, variableMap);
        if (v)
            return v;
    }
    // 2. 이미 동일 HEX로 매핑된 변수 확인
    if (hexToVariableMap.has(upperHex)) {
        return hexToVariableMap.get(upperHex);
    }
    // 3. variables.scss 전체 토큰 사전에서 역탐색
    const fallbackToken = reverseDesignTokens[upperHex];
    if (fallbackToken) {
        const v = lookupVariableByTokenInput(fallbackToken, variableMap);
        if (v) {
            hexToVariableMap.set(upperHex, v);
            return v;
        }
    }
    return null;
}
/**
 * 단일 Paint 객체(SOLID 또는 GRADIENT_LINEAR 등)에 피그마 Color Variable을 바인딩합니다.
 */
async function bindVariableToPaintAsync(paint, hexToTokenMap, reverseDesignTokens, variableMap, hexToVariableMap) {
    if (!paint || typeof paint !== 'object') {
        return { paint, boundCount: 0 };
    }
    // 1. 단색(SOLID) Paint 바인딩
    if (paint.type === 'SOLID' && paint.color) {
        const hex = rgbToHex(paint.color);
        const paintOpacity = typeof paint.opacity === 'number' ? paint.opacity : 1;
        const targetVar = await resolveOrCreateVariableForHexAsync(hex, hexToTokenMap, reverseDesignTokens, variableMap, hexToVariableMap, paintOpacity);
        if (targetVar) {
            // 만약 바인딩 대상 변수 자체가 알파값(예: overlay/white/low = 30%)을 내장하고 있다면,
            // Paint의 opacity를 1로 설정해야 피그마에서 (0.3 * 0.3 = 9%)로 중복 곱해지지 않고 정확히 30%로 표현됨
            const isVarSemiTransparent = targetVar.id && semiTransparentVariableIds.has(targetVar.id);
            const finalPaintOpacity = isVarSemiTransparent ? 1 : paintOpacity;
            // Paint 프록시 객체 동결(Frozen) 문제를 피하기 위해 순수 객체로 복제 후 바인딩
            const clonedPaint = {
                type: 'SOLID',
                color: { r: paint.color.r, g: paint.color.g, b: paint.color.b },
                opacity: finalPaintOpacity,
                visible: paint.visible !== false,
                blendMode: paint.blendMode || 'NORMAL',
            };
            try {
                const boundPaint = figma.variables.setBoundVariableForPaint(clonedPaint, 'color', targetVar);
                return { paint: boundPaint, boundCount: 1 };
            }
            catch (_a) {
                if (typeof figma.variables.createVariableAlias === 'function') {
                    clonedPaint.boundVariables = {
                        color: figma.variables.createVariableAlias(targetVar),
                    };
                    return { paint: clonedPaint, boundCount: 1 };
                }
            }
        }
        return { paint, boundCount: 0 };
    }
    // 2. 그라데이션(GRADIENT_LINEAR 등) ColorStop 변수 바인딩 (LineChart Area 그라데이션 등)
    if (typeof paint.type === 'string' &&
        paint.type.startsWith('GRADIENT_') &&
        Array.isArray(paint.gradientStops)) {
        let stopBoundCount = 0;
        const newStops = [];
        for (const stop of paint.gradientStops) {
            if (stop && stop.color) {
                const hex = rgbToHex(stop.color);
                const targetVar = await resolveOrCreateVariableForHexAsync(hex, hexToTokenMap, reverseDesignTokens, variableMap, hexToVariableMap);
                if (targetVar && typeof figma.variables.createVariableAlias === 'function') {
                    try {
                        newStops.push({
                            position: stop.position,
                            color: {
                                r: stop.color.r,
                                g: stop.color.g,
                                b: stop.color.b,
                                a: typeof stop.color.a === 'number' ? stop.color.a : 1,
                            },
                            boundVariables: {
                                color: figma.variables.createVariableAlias(targetVar),
                            },
                        });
                        stopBoundCount++;
                        continue;
                    }
                    catch (_b) {
                        // 그라데이션 스톱 바인딩 미지원 시 원본 유지
                    }
                }
            }
            newStops.push(stop);
        }
        if (stopBoundCount > 0) {
            const clonedGrad = {
                type: paint.type,
                gradientTransform: paint.gradientTransform,
                gradientStops: newStops,
                opacity: typeof paint.opacity === 'number' ? paint.opacity : 1,
                visible: paint.visible !== false,
                blendMode: paint.blendMode || 'NORMAL',
            };
            return { paint: clonedGrad, boundCount: stopBoundCount };
        }
    }
    return { paint, boundCount: 0 };
}
/**
 * XML 엔티티(`&amp;`, `&lt;` 등)를 원래 문자열로 디코딩합니다.
 */
function unescapeXml(str) {
    return (str || '')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}
/**
 * SVG 내의 `<path data-corners="tl,tr,br,bl" data-box="x,y,w,h" ... />` 요소를
 * 피그마 네이티브 `<rect>`(Rectangle 노드)로 변환하고 개별 모서리 둥글기 맵을 추출합니다.
 * 이를 통해 바 차트의 막대가 Vector가 아닌 Rectangle 노드로 생성되어 `4.Radius` 변수 바인딩이 가능해집니다.
 */
function prepareSvgAndExtractCornersForFigma(rawSvg) {
    const cornerRadiiByNodeName = new Map();
    // 1. <path ... data-corners="..." data-box="..." d="..." ... /> -> <rect ... /> 변환
    let cleanSvg = rawSvg.replace(/<path\s+id="([^"]+)"\s+data-corners="([^"]+)"\s+data-box="([^"]+)"\s+d="[^"]*"\s+([^>]+?)\/>/g, (_match, rawId, cornersStr, boxStr, restAttrs) => {
        const nodeName = unescapeXml(rawId);
        const [tl = 0, tr = 0, br = 0, bl = 0] = cornersStr.split(',').map((n) => parseFloat(n) || 0);
        const [x = '0', y = '0', w = '0', h = '0'] = boxStr.split(',');
        cornerRadiiByNodeName.set(nodeName, { tl, tr, br, bl });
        return `<rect id="${rawId}" x="${x}" y="${y}" width="${w}" height="${h}" ${restAttrs}/>`;
    });
    // 2. <rect ... data-corners="..." data-box="..." ... /> 에서 메타 속성 정리 및 추출
    cleanSvg = cleanSvg.replace(/<rect\s+id="([^"]+)"([^>]*?)\s+data-corners="([^"]+)"\s+data-box="[^"]+"([^>]*?)\/>/g, (_match, rawId, beforeAttrs, cornersStr, afterAttrs) => {
        const nodeName = unescapeXml(rawId);
        const [tl = 0, tr = 0, br = 0, bl = 0] = cornersStr.split(',').map((n) => parseFloat(n) || 0);
        cornerRadiiByNodeName.set(nodeName, { tl, tr, br, bl });
        return `<rect id="${rawId}"${beforeAttrs}${afterAttrs}/>`;
    });
    return { cleanSvg, cornerRadiiByNodeName };
}
/**
 * 생성된 차트 노드 트리를 재귀 순회하며:
 * 1. 모든 도형/선/텍스트의 Fill 및 Stroke를 피그마 Color Variable로 바인딩하고,
 * 2. Rectangle / Frame 노드의 모서리 둥글기(Corner Radius)를 적용 및 `4.Radius` 변수로 바인딩합니다.
 */
async function bindFigmaVariablesToTreeAsync(node, hexToTokenMap, reverseDesignTokens, variableMap, hexToVariableMap, cornerRadiiByNodeName, radiusVarByName, radiusVarByValue, preferredRadiusToken, bindVariables = true) {
    var _a, _b, _c;
    let totalBound = 0;
    // 0. Rectangle 노드의 개별 모서리 둥글기(tl, tr, br, bl) 복원 및 4.Radius 변수 바인딩
    if (node.type === 'RECTANGLE' || node.type === 'FRAME') {
        const customCorners = cornerRadiiByNodeName.get(node.name || '');
        let corners = null;
        if (customCorners) {
            corners = customCorners;
            try {
                node.topLeftRadius = customCorners.tl;
                node.topRightRadius = customCorners.tr;
                node.bottomRightRadius = customCorners.br;
                node.bottomLeftRadius = customCorners.bl;
            }
            catch (_d) {
                // 읽기 전용 속성 무시
            }
        }
        else if (typeof node.topLeftRadius === 'number' && node.topLeftRadius > 0) {
            corners = {
                tl: node.topLeftRadius,
                tr: (_a = node.topRightRadius) !== null && _a !== void 0 ? _a : node.topLeftRadius,
                br: (_b = node.bottomRightRadius) !== null && _b !== void 0 ? _b : node.topLeftRadius,
                bl: (_c = node.bottomLeftRadius) !== null && _c !== void 0 ? _c : node.topLeftRadius,
            };
        }
        if (bindVariables && corners && typeof node.setBoundVariable === 'function') {
            const cornerEntries = [
                ['topLeftRadius', corners.tl],
                ['topRightRadius', corners.tr],
                ['bottomRightRadius', corners.br],
                ['bottomLeftRadius', corners.bl],
            ];
            const isBarNode = (node.name || '').startsWith('Bar:');
            const prefVar = isBarNode && preferredRadiusToken
                ? radiusVarByName.get(preferredRadiusToken.toLowerCase())
                : null;
            for (const [field, val] of cornerEntries) {
                if (val > 0) {
                    const targetRadVar = prefVar || radiusVarByValue.get(Math.round(val));
                    if (targetRadVar) {
                        try {
                            node.setBoundVariable(field, targetRadVar);
                            totalBound++;
                        }
                        catch (_e) {
                            // 바인딩 미지원 버전 무시
                        }
                    }
                }
            }
        }
    }
    if (bindVariables && figma.variables && typeof figma.variables.setBoundVariableForPaint === 'function') {
        // 1. Fills 바인딩
        if (Array.isArray(node.fills) && node.fills.length > 0) {
            let modified = false;
            const newFills = [];
            for (const paint of node.fills) {
                const res = await bindVariableToPaintAsync(paint, hexToTokenMap, reverseDesignTokens, variableMap, hexToVariableMap);
                newFills.push(res.paint);
                if (res.boundCount > 0) {
                    modified = true;
                    totalBound += res.boundCount;
                }
            }
            if (modified) {
                try {
                    node.fills = newFills;
                }
                catch (_f) {
                    // 읽기 전용 노드 무시
                }
            }
        }
        // 2. Strokes 바인딩
        if (Array.isArray(node.strokes) && node.strokes.length > 0) {
            let modified = false;
            const newStrokes = [];
            for (const paint of node.strokes) {
                const res = await bindVariableToPaintAsync(paint, hexToTokenMap, reverseDesignTokens, variableMap, hexToVariableMap);
                newStrokes.push(res.paint);
                if (res.boundCount > 0) {
                    modified = true;
                    totalBound += res.boundCount;
                }
            }
            if (modified) {
                try {
                    node.strokes = newStrokes;
                }
                catch (_g) {
                    // 읽기 전용 노드 무시
                }
            }
        }
    }
    // 3. 자식 노드 재귀 순회
    if (Array.isArray(node.children)) {
        for (const child of node.children) {
            totalBound += await bindFigmaVariablesToTreeAsync(child, hexToTokenMap, reverseDesignTokens, variableMap, hexToVariableMap, cornerRadiiByNodeName, radiusVarByName, radiusVarByValue, preferredRadiusToken, bindVariables);
        }
    }
    return totalBound;
}
/**
 * 현재 피그마 파일에 `2.Color token` / `3.Color token - point` 및 `4.Radius` 변수가 없을 때
 * 디자이너 폴더 구조(`primary/-`, `primary/lower`, `rounded-md` 등)로 로컬 변수들을 생성/동기화합니다.
 */
async function syncVariablesScssToFigma(tokens) {
    if (!figma.variables || typeof figma.variables.createVariableCollection !== 'function') {
        throw new Error('현재 피그마 환경에서 Variables API를 사용할 수 없습니다.');
    }
    const { variableMap } = await scanProjectColorVariables();
    let createdOrUpdated = 0;
    for (const [tokenKey, hexVal] of Object.entries(tokens)) {
        const rgb = hexToRgb(hexVal);
        if (!rgb)
            continue;
        let existingVar = lookupVariableByTokenInput(tokenKey, variableMap);
        if (!existingVar) {
            const colInfo = await getOrCreateCollectionForTokenAsync(tokenKey);
            if (!colInfo)
                continue;
            const hierarchicalName = toFigmaVariableName(tokenKey);
            existingVar = safeCreateColorVariable(hierarchicalName, colInfo.collection);
            existingVar.setValueForMode(colInfo.modeId, rgb);
            for (const k of extractCandidateTokenKeys(hierarchicalName)) {
                variableMap.set(k, existingVar);
            }
            createdOrUpdated++;
        }
    }
    // 4.Radius 변수 동기화
    const { radiusVarByName } = await scanProjectRadiusVariables();
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    let radiusCol = collections.find((c) => c.name === RADIUS_COLLECTION_NAME || c.name.toLowerCase().includes('radius'));
    if (!radiusCol && radiusVarByName.size === 0) {
        radiusCol = figma.variables.createVariableCollection(RADIUS_COLLECTION_NAME);
    }
    if (radiusCol) {
        const radModeId = radiusCol.modes[0].modeId;
        for (const [radName, radVal] of Object.entries(DEFAULT_RADIUS_TOKENS)) {
            if (!radiusVarByName.has(radName)) {
                try {
                    let radVar;
                    try {
                        radVar = figma.variables.createVariable(radName, radiusCol, 'FLOAT');
                    }
                    catch (_a) {
                        radVar = figma.variables.createVariable(radName, radiusCol.id, 'FLOAT');
                    }
                    radVar.setValueForMode(radModeId, radVal);
                    createdOrUpdated++;
                }
                catch (_b) {
                    // FLOAT 변수 생성 실패 시 무시
                }
            }
        }
    }
    // 5.Spacing 변수 동기화 (padding/p-0_5 ~ p-10, gap/gap-0_5 ~ gap-10)
    const { spacingVarByName } = await scanProjectSpacingVariables();
    let spacingCol = collections.find((c) => c.name === SPACING_COLLECTION_NAME || c.name.toLowerCase().includes('spacing'));
    if (!spacingCol && spacingVarByName.size === 0) {
        spacingCol = figma.variables.createVariableCollection(SPACING_COLLECTION_NAME);
    }
    if (spacingCol) {
        const spModeId = spacingCol.modes[0].modeId;
        for (const [spName, spVal] of Object.entries(DEFAULT_SPACING_TOKENS)) {
            if (!spacingVarByName.has(spName.toLowerCase())) {
                try {
                    let spVar;
                    try {
                        spVar = figma.variables.createVariable(spName, spacingCol, 'FLOAT');
                    }
                    catch (_c) {
                        spVar = figma.variables.createVariable(spName, spacingCol.id, 'FLOAT');
                    }
                    spVar.setValueForMode(spModeId, spVal);
                    createdOrUpdated++;
                }
                catch (_d) {
                    // FLOAT 변수 생성 실패 시 무시
                }
            }
        }
    }
    await notifyProjectVariables();
    return createdOrUpdated;
}
/**
 * 그룹(`GROUP`) 내부의 모든 말단(Leaf) 도형/텍스트 노드를 재귀적으로 수집합니다.
 */
function collectLeafNodes(node, out = []) {
    if (!node)
        return out;
    if (node.type === 'GROUP' && Array.isArray(node.children)) {
        for (const child of [...node.children]) {
            collectLeafNodes(child, out);
        }
    }
    else {
        out.push(node);
    }
    return out;
}
/**
 * 텍스트 또는 포인트 원형 노드가 프레임 리사이즈 시 찌그러지거나 중심에서 벗어나지 않도록
 * 투명 Pin-Frame(`SCALE`) 내부의 `CENTER` 제약 조건으로 감싸 배치합니다.
 */
function appendPinnedNode(parentFrame, leaf, localX, localY, pinHConstraint, pinVConstraint, innerHConstraint = 'CENTER', innerVConstraint = 'CENTER') {
    const w = Math.max(1, leaf.width || 1);
    const h = Math.max(1, leaf.height || 1);
    const cx = localX + w / 2;
    const cy = localY + h / 2;
    const pin = figma.createFrame();
    pin.name = leaf.name || 'Pin';
    pin.fills = [];
    pin.clipsContent = false;
    pin.resizeWithoutConstraints(2, 2);
    pin.x = cx - 1;
    pin.y = cy - 1;
    parentFrame.appendChild(pin);
    pin.constraints = { horizontal: pinHConstraint, vertical: pinVConstraint };
    pin.appendChild(leaf);
    leaf.x = 1 - w / 2;
    leaf.y = 1 - h / 2;
    try {
        leaf.constraints = { horizontal: innerHConstraint, vertical: innerVConstraint };
    }
    catch (_a) {
        // 일부 노드에서 constraints 미지원 시 무시
    }
}
/**
 * 피그마에서 프레임을 좌우/상하로 자유롭게 늘이거나 줄여도 축, 바, 라인 포인트, 라벨, 범례가
 * 절대 깨지거나 겹치지 않도록 서브 프레임(`Plot Area`, `Y-Axis`, `X-Axis`, `Legend`) 계층과
 * 정밀 Constraints를 구성합니다.
 */
function buildResponsiveFigmaLayout(rootFrame, chartType = 'bar', padding, legendPos = 'top-right') {
    if (!rootFrame || !Array.isArray(rootFrame.children))
        return;
    const W = Math.max(100, rootFrame.width || 640);
    const H = Math.max(100, rootFrame.height || 400);
    const pad = padding || { top: 46, right: 28, bottom: 42, left: 52 };
    const plotLeft = Math.max(0, pad.left);
    const plotTop = Math.max(0, pad.top);
    const plotRight = Math.max(0, pad.right);
    const plotBottom = Math.max(0, pad.bottom);
    const plotW = Math.max(20, W - plotLeft - plotRight);
    const plotH = Math.max(20, H - plotTop - plotBottom);
    const topChildren = [...rootFrame.children];
    const plotGroupNodes = [];
    let yAxisGroup = null;
    let xAxisGroup = null;
    let legendGroup = null;
    for (const child of topChildren) {
        const name = child.name || '';
        if (name === 'Chart Background') {
            try {
                child.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' };
            }
            catch (_a) {
                // 무시
            }
        }
        else if (name === 'Y-Axis') {
            yAxisGroup = child;
        }
        else if (name === 'X-Axis') {
            xAxisGroup = child;
        }
        else if (name === 'Legend') {
            legendGroup = child;
        }
        else {
            plotGroupNodes.push(child);
        }
    }
    // 1. Y-Axis 서브 프레임 (좌측 고정, 상하 플롯 영역과 1:1 스트레치)
    if (yAxisGroup) {
        const yFrame = figma.createFrame();
        yFrame.name = 'Y-Axis';
        yFrame.fills = [];
        yFrame.clipsContent = false;
        yFrame.resizeWithoutConstraints(Math.max(10, plotLeft), plotH);
        yFrame.x = 0;
        yFrame.y = plotTop;
        rootFrame.appendChild(yFrame);
        yFrame.constraints = { horizontal: 'MIN', vertical: 'STRETCH' };
        const leaves = collectLeafNodes(yAxisGroup);
        for (const leaf of leaves) {
            const localX = leaf.x;
            const localY = leaf.y - plotTop;
            if (leaf.type === 'TEXT') {
                appendPinnedNode(yFrame, leaf, localX, localY, 'MAX', 'SCALE', 'MAX', 'CENTER');
            }
            else {
                yFrame.appendChild(leaf);
                leaf.x = localX;
                leaf.y = localY;
                try {
                    leaf.constraints = { horizontal: 'MAX', vertical: 'STRETCH' };
                }
                catch (_b) {
                    // 무시
                }
            }
        }
        try {
            yAxisGroup.remove();
        }
        catch (_c) {
            // 빈 그룹 자동 제거됨
        }
    }
    // 2. Plot Area 서브 프레임 (파이/도넛은 정원 유지를 위해 CENTER, 바/라인/퍼널은 STRETCH)
    if (plotGroupNodes.length > 0) {
        const plotFrame = figma.createFrame();
        plotFrame.name = chartType === 'pie' ? 'Pie Plot Area' : 'Plot Area';
        plotFrame.fills = [];
        plotFrame.clipsContent = false;
        plotFrame.resizeWithoutConstraints(plotW, plotH);
        plotFrame.x = plotLeft;
        plotFrame.y = plotTop;
        rootFrame.appendChild(plotFrame);
        if (chartType === 'pie') {
            plotFrame.constraints = { horizontal: 'CENTER', vertical: 'CENTER' };
            for (const grp of plotGroupNodes) {
                const leaves = collectLeafNodes(grp);
                for (const leaf of leaves) {
                    const lx = leaf.x - plotLeft;
                    const ly = leaf.y - plotTop;
                    plotFrame.appendChild(leaf);
                    leaf.x = lx;
                    leaf.y = ly;
                    try {
                        leaf.constraints = { horizontal: 'CENTER', vertical: 'CENTER' };
                    }
                    catch (_d) {
                        // 무시
                    }
                }
                try {
                    if (grp.parent)
                        grp.remove();
                }
                catch (_e) {
                    // 무시
                }
            }
        }
        else {
            plotFrame.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' };
            for (const grp of plotGroupNodes) {
                const subFrame = figma.createFrame();
                subFrame.name = grp.name || 'Series Layer';
                subFrame.fills = [];
                subFrame.clipsContent = false;
                subFrame.resizeWithoutConstraints(plotW, plotH);
                subFrame.x = 0;
                subFrame.y = 0;
                plotFrame.appendChild(subFrame);
                subFrame.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' };
                const leaves = collectLeafNodes(grp);
                for (const leaf of leaves) {
                    const lx = leaf.x - plotLeft;
                    const ly = leaf.y - plotTop;
                    const lname = leaf.name || '';
                    if (leaf.type === 'TEXT' || leaf.type === 'ELLIPSE' || lname.startsWith('Point:')) {
                        appendPinnedNode(subFrame, leaf, lx, ly, 'SCALE', 'SCALE', 'CENTER', 'CENTER');
                    }
                    else {
                        subFrame.appendChild(leaf);
                        leaf.x = lx;
                        leaf.y = ly;
                        try {
                            if (lname === 'Plot Border') {
                                leaf.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' };
                            }
                            else if (lname.startsWith('Grid Line (')) {
                                leaf.constraints = { horizontal: 'STRETCH', vertical: 'SCALE' };
                            }
                            else {
                                leaf.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
                            }
                        }
                        catch (_f) {
                            // 무시
                        }
                    }
                }
                try {
                    if (grp.parent)
                        grp.remove();
                }
                catch (_g) {
                    // 무시
                }
            }
        }
    }
    // 3. X-Axis 서브 프레임 (좌우가 Plot Area와 정확히 1:1 STRETCH, 하단 고정)
    if (xAxisGroup) {
        const xFrame = figma.createFrame();
        xFrame.name = 'X-Axis';
        xFrame.fills = [];
        xFrame.clipsContent = false;
        xFrame.resizeWithoutConstraints(plotW, Math.max(10, plotBottom));
        xFrame.x = plotLeft;
        xFrame.y = plotTop + plotH;
        rootFrame.appendChild(xFrame);
        xFrame.constraints = { horizontal: 'STRETCH', vertical: 'MAX' };
        const leaves = collectLeafNodes(xAxisGroup);
        for (const leaf of leaves) {
            const lx = leaf.x - plotLeft;
            const ly = leaf.y - (plotTop + plotH);
            if (leaf.type === 'TEXT') {
                appendPinnedNode(xFrame, leaf, lx, ly, 'SCALE', 'MIN', 'CENTER', 'MIN');
            }
            else {
                xFrame.appendChild(leaf);
                leaf.x = lx;
                leaf.y = ly;
                try {
                    leaf.constraints = { horizontal: 'STRETCH', vertical: 'MIN' };
                }
                catch (_h) {
                    // 무시
                }
            }
        }
        try {
            if (xAxisGroup.parent)
                xAxisGroup.remove();
        }
        catch (_j) {
            // 무시
        }
    }
    // 4. Legend 서브 프레임 (설정된 12방향 앵커 위치에 고정하여 텍스트/마커 왜곡 방지)
    if (legendGroup) {
        const lgX = legendGroup.x;
        const lgY = legendGroup.y;
        const lgW = Math.max(10, legendGroup.width || 100);
        const lgH = Math.max(10, legendGroup.height || 24);
        const lgFrame = figma.createFrame();
        lgFrame.name = 'Legend';
        lgFrame.fills = [];
        lgFrame.clipsContent = false;
        lgFrame.resizeWithoutConstraints(lgW, lgH);
        lgFrame.x = lgX;
        lgFrame.y = lgY;
        rootFrame.appendChild(lgFrame);
        let hConst = 'MAX';
        if (legendPos.includes('left'))
            hConst = 'MIN';
        else if (legendPos.includes('center') || legendPos === 'top' || legendPos === 'bottom')
            hConst = 'CENTER';
        let vConst = 'MIN';
        if (legendPos.includes('bottom'))
            vConst = 'MAX';
        else if (legendPos.includes('middle') || legendPos === 'left' || legendPos === 'right')
            vConst = 'CENTER';
        lgFrame.constraints = { horizontal: hConst, vertical: vConst };
        const leaves = collectLeafNodes(legendGroup);
        for (const leaf of leaves) {
            const lx = leaf.x - lgX;
            const ly = leaf.y - lgY;
            lgFrame.appendChild(leaf);
            leaf.x = lx;
            leaf.y = ly;
            try {
                leaf.constraints = { horizontal: 'MIN', vertical: 'MIN' };
            }
            catch (_k) {
                // 무시
            }
        }
        try {
            if (legendGroup.parent)
                legendGroup.remove();
        }
        catch (_l) {
            // 무시
        }
    }
}
let lastObservedSelectionId = '';
let lastObservedW = 0;
let lastObservedH = 0;
/**
 * 현재 피그마 캔버스에서 선택된 노드가 NanoCharts로 생성된 프레임인지 확인하고 UI에 상태를 전달합니다.
 */
function notifySelectionState() {
    const selection = figma.currentPage.selection;
    if (selection && selection.length === 1) {
        const node = selection[0];
        if (typeof node.getPluginData === 'function') {
            const rawState = node.getPluginData(PLUGIN_DATA_KEY);
            if (rawState) {
                try {
                    const parsedState = JSON.parse(rawState);
                    const currentW = Math.round(node.width || parsedState.exportW || 640);
                    const currentH = Math.round(node.height || parsedState.exportH || 400);
                    lastObservedSelectionId = node.id || '';
                    lastObservedW = currentW;
                    lastObservedH = currentH;
                    figma.ui.postMessage({
                        type: 'SELECTION_SAVED_CHART',
                        hasSavedChart: true,
                        nodeName: node.name,
                        frameWidth: currentW,
                        frameHeight: currentH,
                        state: Object.assign(Object.assign({}, parsedState), { exportW: currentW, exportH: currentH }),
                    });
                    return;
                }
                catch (_a) {
                    // JSON 파싱 실패 시 무시
                }
            }
        }
    }
    lastObservedSelectionId = '';
    figma.ui.postMessage({
        type: 'SELECTION_SAVED_CHART',
        hasSavedChart: false,
    });
}
figma.on('selectionchange', () => {
    notifySelectionState();
});
// 피그마 캔버스에서 선택된 NanoChart 프레임의 크기를 마우스로 조절할 때 UI 프리뷰와 실시간 동기화
setInterval(() => {
    try {
        const selection = figma.currentPage.selection;
        if (!selection || selection.length !== 1)
            return;
        const node = selection[0];
        if (!node || node.id !== lastObservedSelectionId)
            return;
        const curW = Math.round(node.width || 0);
        const curH = Math.round(node.height || 0);
        if (curW >= 120 && curH >= 120 && (Math.abs(curW - lastObservedW) >= 2 || Math.abs(curH - lastObservedH) >= 2)) {
            lastObservedW = curW;
            lastObservedH = curH;
            figma.ui.postMessage({
                type: 'SELECTION_FRAME_RESIZED',
                frameWidth: curW,
                frameHeight: curH,
            });
        }
    }
    catch (_a) {
        // 무시
    }
}, 300);
figma.ui.onmessage = async (msg) => {
    var _a, _b;
    if (msg.type === 'INSERT_SVG' && msg.svg) {
        try {
            const { cleanSvg, cornerRadiiByNodeName } = prepareSvgAndExtractCornersForFigma(msg.svg);
            const newFrame = figma.createNodeFromSvg(cleanSvg);
            newFrame.name = msg.chartTitle || 'NanoChart Vector';
            // 재편집을 위해 차트 옵션 및 데이터 상태를 노드에 메타데이터로 저장
            if (msg.state && typeof newFrame.setPluginData === 'function') {
                newFrame.setPluginData(PLUGIN_DATA_KEY, JSON.stringify(msg.state));
            }
            // 피그마 변수(Color, 4.Radius, 5.Spacing Variables) 자동 매칭 및 바인딩 실행
            const hexMap = msg.hexToTokenMap || {};
            const shouldBind = msg.bindVariables !== false;
            const { variableMap, hexToVariableMap, reverseDesignTokens, autoCreatedCount } = await ensureChartVariablesAsync(hexMap, msg.allTokens);
            const { radiusVarByName, radiusVarByValue } = await scanProjectRadiusVariables();
            const { spacingVarByName, paddingVarByValue, gapVarByValue } = await scanProjectSpacingVariables();
            let boundCount = await bindFigmaVariablesToTreeAsync(newFrame, hexMap, reverseDesignTokens, variableMap, hexToVariableMap, cornerRadiiByNodeName, radiusVarByName, radiusVarByValue, msg.radiusToken, shouldBind);
            // 피그마 좌우/상하 자유 리사이즈 시에도 차트가 절대 깨지지 않도록 서브 프레임(Plot Area, Y-Axis, X-Axis, Legend) 계층 구성
            const chartType = ((_a = msg.state) === null || _a === void 0 ? void 0 : _a.chartType) || 'bar';
            const legendPos = ((_b = msg.state) === null || _b === void 0 ? void 0 : _b.legendPos) || 'top-right';
            buildResponsiveFigmaLayout(newFrame, chartType, msg.padding, legendPos);
            // 루트 차트 프레임에 5.Spacing (padding/* 및 gap/*) 변수 및 배경 모서리(rounded-xxl) 바인딩
            if (shouldBind && typeof newFrame.setBoundVariable === 'function') {
                const padKey = (msg.paddingToken || 'padding/p-6').toLowerCase();
                const padVar = spacingVarByName.get(padKey) ||
                    spacingVarByName.get(padKey.split('/').pop() || '') ||
                    paddingVarByValue.get(24);
                if (padVar) {
                    for (const field of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
                        try {
                            newFrame.setBoundVariable(field, padVar);
                            boundCount++;
                        }
                        catch (_c) {
                            // 프레임 패딩 바인딩 미지원 시 무시
                        }
                    }
                }
                const gapKey = (msg.gapToken || 'gap/gap-2').toLowerCase();
                const gapVar = spacingVarByName.get(gapKey) ||
                    spacingVarByName.get(gapKey.split('/').pop() || '') ||
                    gapVarByValue.get(8);
                if (gapVar) {
                    try {
                        newFrame.setBoundVariable('itemSpacing', gapVar);
                        boundCount++;
                    }
                    catch (_d) {
                        // 간격 바인딩 미지원 시 무시
                    }
                }
                const frameRadVar = radiusVarByName.get('rounded-xxl') || radiusVarByValue.get(16);
                if (frameRadVar) {
                    for (const field of ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius']) {
                        try {
                            newFrame.setBoundVariable(field, frameRadVar);
                            boundCount++;
                        }
                        catch (_e) {
                            // 모서리 바인딩 미지원 시 무시
                        }
                    }
                }
            }
            if (autoCreatedCount > 0) {
                await notifyProjectVariables();
            }
            const selection = figma.currentPage.selection;
            const targetToReplace = msg.replaceSelected && selection && selection.length === 1 ? selection[0] : null;
            if (targetToReplace && targetToReplace.parent) {
                const parent = targetToReplace.parent;
                const index = parent.children.indexOf(targetToReplace);
                newFrame.x = targetToReplace.x;
                newFrame.y = targetToReplace.y;
                parent.insertChild(index, newFrame);
                targetToReplace.remove();
            }
            else {
                const center = figma.viewport.center;
                newFrame.x = Math.round(center.x - newFrame.width / 2);
                newFrame.y = Math.round(center.y - newFrame.height / 2);
                figma.currentPage.appendChild(newFrame);
            }
            figma.currentPage.selection = [newFrame];
            lastObservedSelectionId = newFrame.id || '';
            lastObservedW = Math.round(newFrame.width || 640);
            lastObservedH = Math.round(newFrame.height || 400);
            if (!msg.silent) {
                figma.viewport.scrollAndZoomIntoView([newFrame]);
                if (boundCount > 0) {
                    figma.notify(`✨ 벡터 레이어 삽입 완료! (${boundCount}개 속성이 피그마 변수로 바인딩됨)`);
                }
                else {
                    figma.notify('✨ NanoCharts 반응형 벡터 레이어가 피그마에 삽입되었습니다!');
                }
            }
            notifySelectionState();
        }
        catch (err) {
            figma.notify(`❌ SVG 삽입 오류: ${(err === null || err === void 0 ? void 0 : err.message) || String(err)}`, { error: true });
        }
    }
    else if (msg.type === 'RESCAN_VARIABLES') {
        await notifyProjectVariables();
    }
    else if (msg.type === 'SYNC_VARIABLES_SCSS' && msg.tokensToSync) {
        try {
            const count = await syncVariablesScssToFigma(msg.tokensToSync);
            figma.notify(`🎨 variables.scss 컬러 변수 ${count}개가 현재 피그마 파일에 등록되었습니다!`);
        }
        catch (err) {
            figma.notify(`❌ 변수 등록 실패: ${(err === null || err === void 0 ? void 0 : err.message) || String(err)}`, { error: true });
        }
    }
    else if (msg.type === 'APPLY_OTA_UPDATE' && msg.uiHtml && typeof msg.buildTime === 'number') {
        if (msg.buildTime > lastAppliedOtaBuildTime && msg.uiHtml.includes('NanoCharts')) {
            lastAppliedOtaBuildTime = msg.buildTime;
            try {
                if (figma.clientStorage && typeof figma.clientStorage.setAsync === 'function') {
                    await figma.clientStorage.setAsync(OTA_CACHE_KEY, {
                        version: msg.version || 'latest',
                        buildId: msg.buildId || String(msg.buildTime),
                        buildTime: msg.buildTime,
                        uiHtml: msg.uiHtml,
                    });
                }
            }
            catch (_f) {
                // 캐시 저장 실패 시에도 현재 세션 UI는 즉시 최신으로 교체
            }
            figma.showUI(msg.uiHtml, {
                width: 920,
                height: 680,
                themeColors: true,
            });
            notifySelectionState();
            await notifyProjectVariables();
            figma.notify(`🚀 NanoCharts 최신 버전(v${msg.version || 'latest'})이 GitHub에서 자동 업데이트되었습니다!`);
        }
    }
    else if (msg.type === 'CLOSE_PLUGIN') {
        figma.closePlugin();
    }
};
