/**
 * @fileoverview NanoCharts Figma Plugin Sandbox Controller (code.ts)
 * 
 * 피그마 메인 스레드(Sandbox)에서 실행되며,
 * UI(iframe)에서 `@ju9nu7/nanocharts`의 `toSVG()`로 생성한 순수 벡터(SVG)를 전달받아
 * `figma.createNodeFromSvg()`를 통해 편집 가능한 Frame, Rectangle, Vector, Text 레이어로 변환합니다.
 * 또한 생성된 노드에 `setPluginData`로 차트 설정을 보존하여 재선택 시 즉시 수정할 수 있게 지원합니다.
 */

declare const figma: any;
declare const __html__: string;

const PLUGIN_DATA_KEY = 'nanocharts-state';

figma.showUI(__html__, {
  width: 900,
  height: 640,
  themeColors: true,
});

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
          figma.ui.postMessage({
            type: 'SELECTION_SAVED_CHART',
            hasSavedChart: true,
            nodeName: node.name,
            state: parsedState,
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

// 초기 실행 시 현재 선택된 노드 검사
notifySelectionState();

figma.ui.onmessage = (msg: {
  type: string;
  svg?: string;
  chartTitle?: string;
  replaceSelected?: boolean;
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
      figma.notify('✨ NanoCharts 벡터 레이어가 피그마에 삽입되었습니다!');
      notifySelectionState();
    } catch (err: any) {
      figma.notify(`❌ SVG 삽입 오류: ${err?.message || String(err)}`, { error: true });
    }
  } else if (msg.type === 'CLOSE_PLUGIN') {
    figma.closePlugin();
  }
};
