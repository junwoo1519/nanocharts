/**
 * @fileoverview 연속형 수치 스케일 (Linear Scale)
 * 
 * 데이터의 수치 도메인([min, max])과 캔버스의 픽셀 범위([rangeMin, rangeMax])를
 * 상호 선형 매핑하며, 사람이 읽기 편한 깔끔한 눈금(Nice Ticks)을 자동 생성합니다.
 */

import { Scale } from './Scale';

export class LinearScale implements Scale<number, number> {
  /** 데이터 도메인 [최솟값, 최댓값] */
  private _domain: [number, number] = [0, 1];
  /** 캔버스 픽셀 범위 [시작픽셀, 끝픽셀] */
  private _range: [number, number] = [0, 1];

  constructor(domain?: [number, number], range?: [number, number]) {
    if (domain) this._domain = domain;
    if (range) this._range = range;
  }

  /**
   * 도메인 조회 또는 재설정
   */
  domain(): number[];
  domain(newDomain: [number, number]): this;
  domain(newDomain?: [number, number]): number[] | this {
    if (!newDomain) return [...this._domain];
    this._domain = [newDomain[0], newDomain[1]];
    return this;
  }

  /**
   * 픽셀 범위 조회 또는 재설정
   */
  range(): number[];
  range(newRange: [number, number]): this;
  range(newRange?: [number, number]): number[] | this {
    if (!newRange) return [...this._range];
    this._range = [newRange[0], newRange[1]];
    return this;
  }

  /**
   * 데이터 값(value)을 픽셀 좌표(px)로 선형 변환
   * formula: px = r0 + ((val - d0) / (d1 - d0)) * (r1 - r0)
   */
  scale(value: number): number {
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    if (d1 === d0) return r0;
    const t = (value - d0) / (d1 - d0);
    return r0 + t * (r1 - r0);
  }

  /**
   * 픽셀 좌표(px)로부터 원래의 데이터 값(value)을 역산
   */
  invert(pixel: number): number {
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    if (r1 === r0) return d0;
    const t = (pixel - r0) / (r1 - r0);
    return d0 + t * (d1 - d0);
  }

  /**
   * 인간 공학적으로 읽기 편한 깔끔한 눈금(Ticks) 값 배열을 생성합니다.
   * 1, 2, 5 배수(10진법 지수) 기반 알고리즘을 사용합니다.
   * 
   * @param count 대략적으로 원하는 눈금의 개수 (기본값: 5)
   * @returns 눈금 숫자 배열 (예: [0, 20, 40, 60, 80, 100])
   */
  ticks(count = 5): number[] {
    const [d0, d1] = this._domain;
    if (d0 === d1) return [d0];

    const span = d1 - d0;
    const rawStep = span / Math.max(count, 1);
    const power = Math.floor(Math.log10(rawStep));
    const base = Math.pow(10, power);
    const fraction = rawStep / base;

    // 1, 2, 5, 10 단위로 눈금 간격 보정
    let step: number;
    if (fraction <= 1) step = 1 * base;
    else if (fraction <= 2) step = 2 * base;
    else if (fraction <= 5) step = 5 * base;
    else step = 10 * base;

    const start = Math.ceil(d0 / step) * step;
    const ticks: number[] = [];
    
    // 부동소수점 오차 방지
    const precision = Math.max(0, -power);
    for (let val = start; val <= d1 + step * 0.001; val += step) {
      ticks.push(Number(val.toFixed(precision)));
    }
    return ticks;
  }

  /**
   * 도메인의 최솟값과 최댓값을 눈금 단위에 맞춰 깔끔하게 확장합니다.
   * (예: [3, 97] -> [0, 100])
   */
  nice(count = 5): this {
    const [d0, d1] = this._domain;
    if (d0 === d1) return this;

    const span = d1 - d0;
    const rawStep = span / Math.max(count, 1);
    const power = Math.floor(Math.log10(rawStep));
    const base = Math.pow(10, power);
    const fraction = rawStep / base;

    let step: number;
    if (fraction <= 1) step = 1 * base;
    else if (fraction <= 2) step = 2 * base;
    else if (fraction <= 5) step = 5 * base;
    else step = 10 * base;

    const niceMin = Math.floor(d0 / step) * step;
    const niceMax = Math.ceil(d1 / step) * step;
    this._domain = [niceMin, niceMax];
    return this;
  }
}
