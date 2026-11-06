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

declare const figma: any;
declare const __html__: string;

const PLUGIN_DATA_KEY = 'nanocharts-state';
const DEFAULT_COLLECTION_NAME = 'Design Tokens (variables.scss)';

figma.showUI(__html__, {
  width: 920,
  height: 680,
  themeColors: true,
});

/**
 * 피그마 변수명(`--primary`, `primary`, `color/primary/high`, `surface/ultra-low`)을
 * `variables.scss`의 표준 토큰 키(`primary`, `primary-high`, `surface-ultra-low`)로 정규화합니다.
 */
function normalizeTokenKey(raw: string): string {
  let s = (raw || '').trim();
  const varMatch = s.match(/^var\(\s*--([a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\s*\)$/);
  if (varMatch) {
    s = varMatch[1];
  }
  s = s.replace(/^--+/, '');
  s = s.replace(/^(?:color|colors|token|tokens|theme|palette|weseed|semantic|primitive)[/-]/i, '');
  s = s.replace(/[/-](?:default|base)$/i, '');
  s = s.replace(/\//g, '-').replace(/\s+/g, '-').toLowerCase();
  return s;
}

/**
 * 폴더 계층 구조를 가진 피그마 변수명(예: `Primary/primary-high`, `Colors/Surface/ultra-low`, `Brand/--primary`)에서
 * 매칭 가능한 모든 후보 토큰 키 배열을 추출합니다.
 */
function extractCandidateTokenKeys(rawName: string): string[] {
  const candidates = new Set<string>();
  const full = normalizeTokenKey(rawName);
  if (full) candidates.add(full);

  const parts = (rawName || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const lastOne = normalizeTokenKey(parts[parts.length - 1]);
    const lastTwo = normalizeTokenKey(parts.slice(-2).join('-'));
    if (lastTwo) candidates.add(lastTwo);
    if (lastOne && lastOne !== 'default' && lastOne !== 'base') {
      candidates.add(lastOne);
    }

    // 예: "Primary/primary-high" -> "primary-high" (폴더명 중복 제거)
    const firstNorm = normalizeTokenKey(parts[0]);
    const restNorm = normalizeTokenKey(parts.slice(1).join('-'));
    if (firstNorm && restNorm && restNorm.startsWith(firstNorm + '-')) {
      candidates.add(restNorm);
    }
    if (firstNorm && restNorm && firstNorm === restNorm) {
      candidates.add(firstNorm);
    }
  }

  return Array.from(candidates);
}

/**
 * 피그마 0~1 RGB 객체를 대문자 `#RRGGBB` 문자열로 변환합니다.
 */
function rgbToHex(color: { r: number; g: number; b: number }): string {
  const r = Math.max(0, Math.min(255, Math.round(color.r * 255)));
  const g = Math.max(0, Math.min(255, Math.round(color.g * 255)));
  const b = Math.max(0, Math.min(255, Math.round(color.b * 255)));
  return (
    '#' +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * `#RRGGBB` 문자열을 피그마 0~1 `{ r, g, b }` 객체로 변환합니다.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
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
function safeCreateColorVariable(name: string, collection: any): any {
  try {
    return figma.variables.createVariable(name, collection, 'COLOR');
  } catch {
    return figma.variables.createVariable(name, collection.id, 'COLOR');
  }
}

/**
 * 변수의 첫 번째 모드 색상값을 해석합니다 (`VARIABLE_ALIAS` 별칭 참조 포함).
 */
async function resolveVariableHexAsync(variable: any, depth: number = 0): Promise<string | null> {
  if (!variable || !variable.valuesByMode || depth > 4) return null;
  const modeIds = Object.keys(variable.valuesByMode);
  if (modeIds.length === 0) return null;

  const val = variable.valuesByMode[modeIds[0]];
  if (!val || typeof val !== 'object') return null;

  if (typeof val.r === 'number' && typeof val.g === 'number' && typeof val.b === 'number') {
    return rgbToHex(val);
  }

  if (val.type === 'VARIABLE_ALIAS' && val.id && typeof figma.variables.getVariableByIdAsync === 'function') {
    try {
      const aliasedVar = await figma.variables.getVariableByIdAsync(val.id);
      if (aliasedVar) {
        return await resolveVariableHexAsync(aliasedVar, depth + 1);
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * 현재 열려 있는 피그마 프로젝트의 로컬 컬러 변수(Local Color Variables)를 스캔하여
 * 정규화된 토큰 키 맵, HEX 역매핑 맵, 실제 HEX 색상 맵을 반환합니다.
 */
async function scanProjectColorVariables(): Promise<{
  variableMap: Map<string, any>;
  hexToVariableMap: Map<string, any>;
  tokenHexMap: Record<string, string>;
}> {
  const variableMap = new Map<string, any>();
  const hexToVariableMap = new Map<string, any>();
  const tokenHexMap: Record<string, string> = {};

  if (!figma.variables || typeof figma.variables.getLocalVariablesAsync !== 'function') {
    return { variableMap, hexToVariableMap, tokenHexMap };
  }

  try {
    const localVars = await figma.variables.getLocalVariablesAsync('COLOR');
    for (const v of localVars) {
      const candidateKeys = extractCandidateTokenKeys(v.name);
      const resolvedHex = await resolveVariableHexAsync(v);

      for (const key of candidateKeys) {
        if (!variableMap.has(key)) {
          variableMap.set(key, v);
        }
        if (resolvedHex && !tokenHexMap[key]) {
          tokenHexMap[key] = resolvedHex;
        }
      }

      if (resolvedHex && !hexToVariableMap.has(resolvedHex)) {
        hexToVariableMap.set(resolvedHex, v);
      }
    }
  } catch {
    // 변수 API 미지원 환경 무시
  }

  return { variableMap, hexToVariableMap, tokenHexMap };
}

/**
 * 현재 프로젝트의 변수 스캔 결과를 UI로 전송합니다.
 */
async function notifyProjectVariables(): Promise<void> {
  const { variableMap, tokenHexMap } = await scanProjectColorVariables();
  figma.ui.postMessage({
    type: 'PROJECT_VARIABLES_STATE',
    matchedCount: variableMap.size,
    tokenHexMap,
  });
}

/**
 * 기본 로컬 변수 컬렉션(`Design Tokens (variables.scss)`)을 가져오거나 새로 생성합니다.
 */
async function getOrCreateTokenCollectionAsync(): Promise<{ collection: any; modeId: string } | null> {
  if (!figma.variables || typeof figma.variables.createVariableCollection !== 'function') {
    return null;
  }
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    let collection = collections.find((c: any) => c.name === DEFAULT_COLLECTION_NAME);
    if (!collection) {
      collection = figma.variables.createVariableCollection(DEFAULT_COLLECTION_NAME);
    }
    const modeId = collection.modes[0].modeId;
    return { collection, modeId };
  } catch {
    return null;
  }
}

/**
 * 차트에서 사용된 토큰(`hexToTokenMap`)이 현재 피그마 파일의 변수에 아직 없을 경우,
 * 즉시 로컬 변수로 자동 생성하여 16진수(HEX)로 남지 않고 무조건 피그마 변수로 바인딩되게 보장합니다.
 */
async function ensureChartVariablesAsync(
  hexToTokenMap: Record<string, string>,
  allTokens?: Record<string, string>
): Promise<{
  variableMap: Map<string, any>;
  hexToVariableMap: Map<string, any>;
  reverseDesignTokens: Record<string, string>;
  autoCreatedCount: number;
}> {
  const { variableMap, hexToVariableMap } = await scanProjectColorVariables();
  const reverseDesignTokens: Record<string, string> = {};

  if (allTokens) {
    for (const [tokenKey, hexVal] of Object.entries(allTokens)) {
      const upper = (hexVal || '').trim().toUpperCase();
      if (upper.startsWith('#') && !reverseDesignTokens[upper]) {
        reverseDesignTokens[upper] = normalizeTokenKey(tokenKey);
      }
    }
  }

  let collectionInfo: { collection: any; modeId: string } | null = null;
  let autoCreatedCount = 0;

  for (const [hex, rawTokenName] of Object.entries(hexToTokenMap)) {
    const normKey = normalizeTokenKey(rawTokenName);
    if (!normKey) continue;

    let targetVar = variableMap.get(normKey);
    if (!targetVar) {
      if (!collectionInfo) {
        collectionInfo = await getOrCreateTokenCollectionAsync();
      }
      if (collectionInfo) {
        const rgb = hexToRgb(hex);
        if (rgb) {
          try {
            targetVar = safeCreateColorVariable(normKey, collectionInfo.collection);
            targetVar.setValueForMode(collectionInfo.modeId, rgb);
            variableMap.set(normKey, targetVar);
            hexToVariableMap.set(hex.toUpperCase(), targetVar);
            autoCreatedCount++;
          } catch {
            // 개별 변수 생성 실패 시 무시
          }
        }
      }
    } else {
      hexToVariableMap.set(hex.toUpperCase(), targetVar);
    }
  }

  return { variableMap, hexToVariableMap, reverseDesignTokens, autoCreatedCount };
}

/**
 * 특정 HEX 색상에 대응하는 피그마 `Variable`을 찾거나, 없으면 로컬 컬렉션에 즉시 생성하여 반환합니다.
 */
async function resolveOrCreateVariableForHexAsync(
  hex: string,
  hexToTokenMap: Record<string, string>,
  reverseDesignTokens: Record<string, string>,
  variableMap: Map<string, any>,
  hexToVariableMap: Map<string, any>
): Promise<any | null> {
  const upperHex = (hex || '').toUpperCase();
  if (!upperHex.startsWith('#')) return null;

  // 1. 차트에서 명시적으로 사용한 토큰 매핑 우선 확인
  const explicitToken = hexToTokenMap[upperHex];
  if (explicitToken) {
    const normKey = normalizeTokenKey(explicitToken);
    const v = variableMap.get(normKey);
    if (v) return v;
  }

  // 2. 이미 동일 HEX로 매핑된 변수 확인
  if (hexToVariableMap.has(upperHex)) {
    return hexToVariableMap.get(upperHex);
  }

  // 3. variables.scss 전체 토큰 사전에서 역탐색
  const fallbackToken = reverseDesignTokens[upperHex];
  const tokenKeyToCreate = explicitToken
    ? normalizeTokenKey(explicitToken)
    : fallbackToken || `chart-color-${upperHex.slice(1).toLowerCase()}`;

  if (variableMap.has(tokenKeyToCreate)) {
    const existing = variableMap.get(tokenKeyToCreate);
    hexToVariableMap.set(upperHex, existing);
    return existing;
  }

  // 4. 파일에 해당 변수가 없으면 즉시 생성하여 16진수(HEX) 노출 원천 차단
  const collectionInfo = await getOrCreateTokenCollectionAsync();
  const rgb = hexToRgb(upperHex);
  if (collectionInfo && rgb) {
    try {
      const newVar = safeCreateColorVariable(tokenKeyToCreate, collectionInfo.collection);
      newVar.setValueForMode(collectionInfo.modeId, rgb);
      variableMap.set(tokenKeyToCreate, newVar);
      hexToVariableMap.set(upperHex, newVar);
      return newVar;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * 단일 Paint 객체(SOLID 또는 GRADIENT_LINEAR 등)에 피그마 Color Variable을 바인딩합니다.
 */
async function bindVariableToPaintAsync(
  paint: any,
  hexToTokenMap: Record<string, string>,
  reverseDesignTokens: Record<string, string>,
  variableMap: Map<string, any>,
  hexToVariableMap: Map<string, any>
): Promise<{ paint: any; boundCount: number }> {
  if (!paint || typeof paint !== 'object') {
    return { paint, boundCount: 0 };
  }

  // 1. 단색(SOLID) Paint 바인딩
  if (paint.type === 'SOLID' && paint.color) {
    const hex = rgbToHex(paint.color);
    const targetVar = await resolveOrCreateVariableForHexAsync(
      hex,
      hexToTokenMap,
      reverseDesignTokens,
      variableMap,
      hexToVariableMap
    );

    if (targetVar) {
      // Paint 프록시 객체 동결(Frozen) 문제를 피하기 위해 순수 객체로 복제 후 바인딩
      const clonedPaint: any = {
        type: 'SOLID',
        color: { r: paint.color.r, g: paint.color.g, b: paint.color.b },
        opacity: typeof paint.opacity === 'number' ? paint.opacity : 1,
        visible: paint.visible !== false,
        blendMode: paint.blendMode || 'NORMAL',
      };

      try {
        const boundPaint = figma.variables.setBoundVariableForPaint(clonedPaint, 'color', targetVar);
        return { paint: boundPaint, boundCount: 1 };
      } catch {
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
  if (
    typeof paint.type === 'string' &&
    paint.type.startsWith('GRADIENT_') &&
    Array.isArray(paint.gradientStops)
  ) {
    let stopBoundCount = 0;
    const newStops = [];

    for (const stop of paint.gradientStops) {
      if (stop && stop.color) {
        const hex = rgbToHex(stop.color);
        const targetVar = await resolveOrCreateVariableForHexAsync(
          hex,
          hexToTokenMap,
          reverseDesignTokens,
          variableMap,
          hexToVariableMap
        );

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
          } catch {
            // 그라데이션 스톱 바인딩 미지원 시 원본 유지
          }
        }
      }
      newStops.push(stop);
    }

    if (stopBoundCount > 0) {
      const clonedGrad: any = {
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
 * 생성된 차트 노드 트리를 재귀 순회하며 모든 도형/선/텍스트의 Fill 및 Stroke를
 * 16진수(HEX) 대신 피그마 Variable로 바인딩합니다.
 */
async function bindFigmaVariablesToTreeAsync(
  node: any,
  hexToTokenMap: Record<string, string>,
  reverseDesignTokens: Record<string, string>,
  variableMap: Map<string, any>,
  hexToVariableMap: Map<string, any>
): Promise<number> {
  let totalBound = 0;

  if (!figma.variables || typeof figma.variables.setBoundVariableForPaint !== 'function') {
    return 0;
  }

  // 1. Fills 바인딩
  if (Array.isArray(node.fills) && node.fills.length > 0) {
    let modified = false;
    const newFills = [];
    for (const paint of node.fills) {
      const res = await bindVariableToPaintAsync(
        paint,
        hexToTokenMap,
        reverseDesignTokens,
        variableMap,
        hexToVariableMap
      );
      newFills.push(res.paint);
      if (res.boundCount > 0) {
        modified = true;
        totalBound += res.boundCount;
      }
    }
    if (modified) {
      try {
        node.fills = newFills;
      } catch {
        // 읽기 전용 노드 무시
      }
    }
  }

  // 2. Strokes 바인딩
  if (Array.isArray(node.strokes) && node.strokes.length > 0) {
    let modified = false;
    const newStrokes = [];
    for (const paint of node.strokes) {
      const res = await bindVariableToPaintAsync(
        paint,
        hexToTokenMap,
        reverseDesignTokens,
        variableMap,
        hexToVariableMap
      );
      newStrokes.push(res.paint);
      if (res.boundCount > 0) {
        modified = true;
        totalBound += res.boundCount;
      }
    }
    if (modified) {
      try {
        node.strokes = newStrokes;
      } catch {
        // 읽기 전용 노드 무시
      }
    }
  }

  // 3. 자식 노드 재귀 순회
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      totalBound += await bindFigmaVariablesToTreeAsync(
        child,
        hexToTokenMap,
        reverseDesignTokens,
        variableMap,
        hexToVariableMap
      );
    }
  }

  return totalBound;
}

/**
 * 현재 피그마 파일에 `variables.scss` 컬러 토큰 컬렉션이 없을 때
 * 디자이너가 버튼 한 번으로 로컬 변수들을 생성/동기화할 수 있게 지원합니다.
 */
async function syncVariablesScssToFigma(tokens: Record<string, string>): Promise<number> {
  const collectionInfo = await getOrCreateTokenCollectionAsync();
  if (!collectionInfo) {
    throw new Error('현재 피그마 환경에서 Variables API를 사용할 수 없습니다.');
  }

  const { collection, modeId } = collectionInfo;
  const { variableMap } = await scanProjectColorVariables();
  let createdOrUpdated = 0;

  for (const [tokenKey, hexVal] of Object.entries(tokens)) {
    const rgb = hexToRgb(hexVal);
    if (!rgb) continue;

    const normKey = normalizeTokenKey(tokenKey);
    let existingVar = variableMap.get(normKey);

    if (!existingVar) {
      existingVar = safeCreateColorVariable(normKey, collection);
      variableMap.set(normKey, existingVar);
    }

    existingVar.setValueForMode(modeId, rgb);
    createdOrUpdated++;
  }

  await notifyProjectVariables();
  return createdOrUpdated;
}

/**
 * 생성된 피그마 차트 프레임과 내부 벡터/텍스트 레이어에 반응형 제약 조건(Constraints)을 설정합니다.
 */
function applyResponsiveFigmaConstraints(node: any, ancestorGroupName: string = ''): void {
  const currentGroup =
    node.type === 'GROUP' || node.type === 'FRAME' ? node.name || ancestorGroupName : ancestorGroupName;

  if ('constraints' in node && node.parent && node.parent.type !== 'PAGE') {
    try {
      const name: string = node.name || '';
      if (name === 'Chart Background') {
        node.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' };
      } else if (currentGroup === 'Grid' || name.startsWith('Grid Line')) {
        node.constraints = { horizontal: 'STRETCH', vertical: 'SCALE' };
      } else if (currentGroup === 'Y-Axis' || name.startsWith('Y-Tick') || name === 'Y-Axis Line') {
        node.constraints = { horizontal: 'MIN', vertical: 'SCALE' };
      } else if (name === 'X-Axis Baseline') {
        node.constraints = { horizontal: 'STRETCH', vertical: 'MAX' };
      } else if (currentGroup === 'X-Axis' || name.startsWith('X-Tick')) {
        node.constraints = { horizontal: 'SCALE', vertical: 'MAX' };
      } else if (currentGroup.startsWith('Legend')) {
        node.constraints = { horizontal: 'SCALE', vertical: 'MIN' };
      } else {
        node.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
      }
    } catch {
      // 일부 특수 노드에서 constraints 설정 불가 시 무시
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      applyResponsiveFigmaConstraints(child, currentGroup);
    }
  }
}

/**
 * 현재 피그마 캔버스에서 선택된 노드가 NanoCharts로 생성된 프레임인지 확인하고 UI에 상태를 전달합니다.
 */
function notifySelectionState(): void {
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
          figma.ui.postMessage({
            type: 'SELECTION_SAVED_CHART',
            hasSavedChart: true,
            nodeName: node.name,
            frameWidth: currentW,
            frameHeight: currentH,
            state: {
              ...parsedState,
              exportW: currentW,
              exportH: currentH,
            },
          });
          return;
        } catch {
          // JSON 파싱 실패 시 무시
        }
      }
    }
  }

  figma.ui.postMessage({
    type: 'SELECTION_SAVED_CHART',
    hasSavedChart: false,
  });
}

figma.on('selectionchange', () => {
  notifySelectionState();
});

// 초기 실행 시 현재 선택된 노드 및 프로젝트 로컬 변수 검사
notifySelectionState();
notifyProjectVariables();

figma.ui.onmessage = async (msg: {
  type: string;
  svg?: string;
  chartTitle?: string;
  replaceSelected?: boolean;
  bindVariables?: boolean;
  hexToTokenMap?: Record<string, string>;
  tokensToSync?: Record<string, string>;
  allTokens?: Record<string, string>;
  state?: unknown;
}) => {
  if (msg.type === 'INSERT_SVG' && msg.svg) {
    try {
      const newFrame = figma.createNodeFromSvg(msg.svg);
      newFrame.name = msg.chartTitle || 'NanoChart Vector';

      // 재편집을 위해 차트 옵션 및 데이터 상태를 노드에 메타데이터로 저장
      if (msg.state && typeof newFrame.setPluginData === 'function') {
        newFrame.setPluginData(PLUGIN_DATA_KEY, JSON.stringify(msg.state));
      }

      // 피그마 프레임 리사이징 대응 반응형 Constraints 자동 설정
      applyResponsiveFigmaConstraints(newFrame);

      // 피그마 변수(Variables) 자동 생성 및 바인딩 실행 (16진수 하드코딩 방지)
      let boundCount = 0;
      if (msg.bindVariables !== false) {
        const hexMap = msg.hexToTokenMap || {};
        const { variableMap, hexToVariableMap, reverseDesignTokens, autoCreatedCount } =
          await ensureChartVariablesAsync(hexMap, msg.allTokens);

        boundCount = await bindFigmaVariablesToTreeAsync(
          newFrame,
          hexMap,
          reverseDesignTokens,
          variableMap,
          hexToVariableMap
        );

        if (autoCreatedCount > 0) {
          await notifyProjectVariables();
        }
      }

      const selection = figma.currentPage.selection;
      const targetToReplace =
        msg.replaceSelected && selection && selection.length === 1 ? selection[0] : null;

      if (targetToReplace && targetToReplace.parent) {
        const parent = targetToReplace.parent;
        const index = parent.children.indexOf(targetToReplace);
        newFrame.x = targetToReplace.x;
        newFrame.y = targetToReplace.y;
        parent.insertChild(index, newFrame);
        targetToReplace.remove();
      } else {
        const center = figma.viewport.center;
        newFrame.x = Math.round(center.x - newFrame.width / 2);
        newFrame.y = Math.round(center.y - newFrame.height / 2);
        figma.currentPage.appendChild(newFrame);
      }

      figma.currentPage.selection = [newFrame];
      figma.viewport.scrollAndZoomIntoView([newFrame]);

      if (boundCount > 0) {
        figma.notify(`✨ 벡터 레이어 삽입 완료! (${boundCount}개 컬러 속성이 16진수 대신 피그마 변수로 바인딩됨)`);
      } else {
        figma.notify('✨ NanoCharts 벡터 레이어가 피그마에 삽입되었습니다!');
      }
      notifySelectionState();
    } catch (err: any) {
      figma.notify(`❌ SVG 삽입 오류: ${err?.message || String(err)}`, { error: true });
    }
  } else if (msg.type === 'RESCAN_VARIABLES') {
    await notifyProjectVariables();
  } else if (msg.type === 'SYNC_VARIABLES_SCSS' && msg.tokensToSync) {
    try {
      const count = await syncVariablesScssToFigma(msg.tokensToSync);
      figma.notify(`🎨 variables.scss 컬러 변수 ${count}개가 현재 피그마 파일에 등록되었습니다!`);
    } catch (err: any) {
      figma.notify(`❌ 변수 등록 실패: ${err?.message || String(err)}`, { error: true });
    }
  } else if (msg.type === 'CLOSE_PLUGIN') {
    figma.closePlugin();
  }
};
