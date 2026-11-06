/**
 * @fileoverview NanoCharts Figma Plugin Sandbox Controller (code.ts)
 *
 * 피그마 메인 스레드(Sandbox)에서 실행되며,
 * 1. UI(iframe)에서 `@ju9nu7/nanocharts`의 `toSVG()`로 생성한 순수 벡터(SVG)를 전달받아
 *    `figma.createNodeFromSvg()`를 통해 편집 가능한 Frame, Rectangle, Vector, Text 레이어로 변환합니다.
 * 2. 현재 열린 피그마 프로젝트(A 프로젝트, B 프로젝트 등)의 Local Color Variables를 감지하여
 *    `variables.scss` 토큰명(`primary`, `surface-ultra-low`, `on-surface`, `outline`, `teal`, `indigo` 등)과
 *    일치하는 피그마 변수로 차트 도형 및 텍스트의 Fill/Stroke를 자동 바인딩(`setBoundVariableForPaint`)합니다.
 * 3. 생성된 노드에 `setPluginData`로 차트 설정을 보존하여 재선택 시 즉시 수정할 수 있게 지원합니다.
 */

declare const figma: any;
declare const __html__: string;

const PLUGIN_DATA_KEY = 'nanocharts-state';

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
  s = s.replace(/^(?:color|colors|token|tokens|theme|palette)[/-]/i, '');
  s = s.replace(/[/-](?:default|base)$/i, '');
  s = s.replace(/\//g, '-').replace(/\s+/g, '-').toLowerCase();
  return s;
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
 * 현재 열려 있는 피그마 프로젝트의 로컬 컬러 변수(Local Color Variables)를 스캔하여
 * 정규화된 토큰 키 맵과 실제 HEX 색상 맵을 반환합니다.
 */
async function scanProjectColorVariables(): Promise<{
  variableMap: Map<string, any>;
  tokenHexMap: Record<string, string>;
}> {
  const variableMap = new Map<string, any>();
  const tokenHexMap: Record<string, string> = {};

  if (!figma.variables || typeof figma.variables.getLocalVariablesAsync !== 'function') {
    return { variableMap, tokenHexMap };
  }

  try {
    const localVars = await figma.variables.getLocalVariablesAsync('COLOR');
    for (const v of localVars) {
      const key = normalizeTokenKey(v.name);
      if (!key) continue;
      variableMap.set(key, v);

      // 현재 기본 모드의 RGB 색상값을 추출하여 UI 실시간 프리뷰에도 반영
      const valuesByMode = v.valuesByMode;
      if (valuesByMode) {
        const modeIds = Object.keys(valuesByMode);
        if (modeIds.length > 0) {
          const firstVal = valuesByMode[modeIds[0]];
          if (
            firstVal &&
            typeof firstVal === 'object' &&
            typeof firstVal.r === 'number' &&
            typeof firstVal.g === 'number' &&
            typeof firstVal.b === 'number'
          ) {
            tokenHexMap[key] = rgbToHex(firstVal);
          }
        }
      }
    }
  } catch {
    // 변수 API 미지원 환경 무시
  }

  return { variableMap, tokenHexMap };
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
 * 생성된 차트 노드 트리를 순회하며, HEX 색상에 매핑된 토큰명(`primary`, `surface-ultra-low` 등)이
 * 현재 피그마 프로젝트의 변수에 존재하면 실제 피그마 Variable로 바인딩합니다.
 */
function bindFigmaVariablesToTree(
  node: any,
  hexToTokenMap: Record<string, string>,
  variableMap: Map<string, any>
): number {
  let boundCount = 0;

  if (!figma.variables || typeof figma.variables.setBoundVariableForPaint !== 'function') {
    return 0;
  }

  // 1. Fills 바인딩
  if (Array.isArray(node.fills) && node.fills.length > 0) {
    let modified = false;
    const newFills = node.fills.map((paint: any) => {
      if (paint && paint.type === 'SOLID' && paint.color) {
        const hex = rgbToHex(paint.color);
        const tokenName = hexToTokenMap[hex];
        if (tokenName) {
          const normKey = normalizeTokenKey(tokenName);
          const targetVar = variableMap.get(normKey);
          if (targetVar) {
            try {
              const boundPaint = figma.variables.setBoundVariableForPaint(paint, 'color', targetVar);
              modified = true;
              boundCount++;
              return boundPaint;
            } catch {
              return paint;
            }
          }
        }
      }
      return paint;
    });
    if (modified) {
      node.fills = newFills;
    }
  }

  // 2. Strokes 바인딩
  if (Array.isArray(node.strokes) && node.strokes.length > 0) {
    let modified = false;
    const newStrokes = node.strokes.map((paint: any) => {
      if (paint && paint.type === 'SOLID' && paint.color) {
        const hex = rgbToHex(paint.color);
        const tokenName = hexToTokenMap[hex];
        if (tokenName) {
          const normKey = normalizeTokenKey(tokenName);
          const targetVar = variableMap.get(normKey);
          if (targetVar) {
            try {
              const boundPaint = figma.variables.setBoundVariableForPaint(paint, 'color', targetVar);
              modified = true;
              boundCount++;
              return boundPaint;
            } catch {
              return paint;
            }
          }
        }
      }
      return paint;
    });
    if (modified) {
      node.strokes = newStrokes;
    }
  }

  // 3. 자식 노드 재귀 순회
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      boundCount += bindFigmaVariablesToTree(child, hexToTokenMap, variableMap);
    }
  }

  return boundCount;
}

/**
 * 현재 피그마 파일에 `variables.scss` 컬러 토큰 컬렉션이 없을 때
 * 디자이너가 버튼 한 번으로 로컬 변수들을 생성/동기화할 수 있게 지원합니다.
 */
async function syncVariablesScssToFigma(tokens: Record<string, string>): Promise<number> {
  if (!figma.variables || typeof figma.variables.createVariableCollection !== 'function') {
    throw new Error('현재 피그마 환경에서 Variables API를 사용할 수 없습니다.');
  }

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  let collection = collections.find((c: any) => c.name === 'Design Tokens (variables.scss)');
  if (!collection) {
    collection = figma.variables.createVariableCollection('Design Tokens (variables.scss)');
  }

  const modeId = collection.modes[0].modeId;
  const { variableMap } = await scanProjectColorVariables();
  let createdOrUpdated = 0;

  for (const [tokenKey, hexVal] of Object.entries(tokens)) {
    const rgb = hexToRgb(hexVal);
    if (!rgb) continue;

    const normKey = normalizeTokenKey(tokenKey);
    let existingVar = variableMap.get(normKey);

    if (!existingVar) {
      // 피그마 변수 그룹 계층 구조(예: primary/high, surface/ultra-low) 또는 평면 이름 생성
      existingVar = figma.variables.createVariable(normKey, collection, 'COLOR');
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
 * 디자이너가 피그마에서 차트 프레임 크기를 자유롭게 늘리거나 줄여도
 * 배경은 STRETCH, 축은 가장자리 고정(MIN/MAX), 바/라인/라벨은 비율(SCALE)에 맞춰 반응형으로 동작합니다.
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

      // 피그마 변수(Variables) 자동 바인딩 실행
      let boundCount = 0;
      if (msg.bindVariables !== false && msg.hexToTokenMap) {
        const { variableMap } = await scanProjectColorVariables();
        if (variableMap.size > 0) {
          boundCount = bindFigmaVariablesToTree(newFrame, msg.hexToTokenMap, variableMap);
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
        figma.notify(`✨ 벡터 레이어 삽입 완료! (${boundCount}개 속성에 프로젝트 피그마 변수 자동 바인딩됨)`);
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
