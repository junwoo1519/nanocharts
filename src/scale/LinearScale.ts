import { Scale } from './Scale';

export class LinearScale implements Scale<number, number> {
  private _domain: [number, number] = [0, 1];
  private _range: [number, number] = [0, 1];

  constructor(domain?: [number, number], range?: [number, number]) {
    if (domain) this._domain = domain;
    if (range) this._range = range;
  }

  domain(): number[];
  domain(newDomain: [number, number]): this;
  domain(newDomain?: [number, number]): number[] | this {
    if (!newDomain) return [...this._domain];
    this._domain = [newDomain[0], newDomain[1]];
    return this;
  }

  range(): number[];
  range(newRange: [number, number]): this;
  range(newRange?: [number, number]): number[] | this {
    if (!newRange) return [...this._range];
    this._range = [newRange[0], newRange[1]];
    return this;
  }

  scale(value: number): number {
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    if (d1 === d0) return r0;
    const t = (value - d0) / (d1 - d0);
    return r0 + t * (r1 - r0);
  }

  invert(pixel: number): number {
    const [d0, d1] = this._domain;
    const [r0, r1] = this._range;
    if (r1 === r0) return d0;
    const t = (pixel - r0) / (r1 - r0);
    return d0 + t * (d1 - d0);
  }

  /**
   * 깔끔한 눈금(Ticks) 값 배열 생성
   */
  ticks(count = 5): number[] {
    const [d0, d1] = this._domain;
    if (d0 === d1) return [d0];

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
   * 도메인을 깔끔한 단위로 라운딩 (0 기준 또는 min/max 기준)
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
