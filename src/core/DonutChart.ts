/**
 * @fileoverview 도넛 차트 전용 메인 클래스 (DonutChart)
 *
 * `PieChart`를 기반으로 도넛 차트에 최적화된 기본값(`innerRadiusRatio: 0.6`, 중앙 요약 텍스트 등)과
 * 전용 옵션 인터페이스(`DonutChartOptions`, `donut`)를 제공하는 독립 차트 클래스입니다.
 */

import type { DonutChartOptions, PieChartOptions, PieStyleOptions } from '../types';
import { PieChart } from './PieChart';
import type { PieChartEventMap } from './PieChart';

/**
 * DonutChart 이벤트 맵 (IDE 자동완성 및 페이로드 타입 추론용)
 */
export type DonutChartEventMap = PieChartEventMap;

const DEFAULT_DONUT_INNER_RADIUS_RATIO = 0.6;

/**
 * `DonutChartOptions`를 내부 `PieChartOptions`로 정규화합니다.
 * - `donut` 옵션이 우선 적용되며, `innerRadiusRatio` 미지정 또는 0 이하일 경우 기본값 `0.6`을 적용합니다.
 */
function normalizeDonutOptions(options: DonutChartOptions): PieChartOptions {
  const mergedStyle: PieStyleOptions = {
    ...options.pie,
    ...options.donut,
  };
  const rawRatio = mergedStyle.innerRadiusRatio;
  mergedStyle.innerRadiusRatio =
    typeof rawRatio === 'number' && Number.isFinite(rawRatio) && rawRatio > 0
      ? rawRatio
      : DEFAULT_DONUT_INNER_RADIUS_RATIO;

  const { donut: _donut, ...rest } = options;
  return {
    ...rest,
    pie: mergedStyle,
  };
}

/**
 * 도넛 차트(DonutChart) 클래스
 *
 * 내부 구멍이 있는 도넛 차트 렌더링, 중앙 요약 텍스트, 평행 픽셀 간격(`sliceGap`),
 * 잔여 트랙(`maxValue` / `trackColor`), 극좌표 히트 테스팅, Lerp 호버 팝아웃, Figma SVG 추출을 지원합니다.
 */
export class DonutChart extends PieChart {
  private lastInnerRadiusRatio: number;

  constructor(container: string | HTMLElement, options: DonutChartOptions) {
    const normalized = normalizeDonutOptions(options);
    super(container, normalized);
    this.lastInnerRadiusRatio =
      normalized.pie?.innerRadiusRatio ?? DEFAULT_DONUT_INNER_RADIUS_RATIO;
  }

  /**
   * 도넛 차트의 데이터·스타일·범례·여백 옵션을 동적으로 갱신합니다.
   */
  public override update(options: Partial<DonutChartOptions>): void {
    const { donut, pie, ...rest } = options;
    const nextUpdate: Partial<PieChartOptions> = { ...rest };

    if (donut || pie) {
      const merged: PieStyleOptions = { ...pie, ...donut };
      if (merged.innerRadiusRatio !== undefined) {
        merged.innerRadiusRatio =
          Number.isFinite(merged.innerRadiusRatio) && merged.innerRadiusRatio > 0
            ? merged.innerRadiusRatio
            : this.lastInnerRadiusRatio;
        this.lastInnerRadiusRatio = merged.innerRadiusRatio;
      }
      nextUpdate.pie = merged;
    }

    super.update(nextUpdate);
  }
}
