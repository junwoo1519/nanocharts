export class BandScale {
  private _domainCount: number = 0;
  private _range: [number, number] = [0, 1];
  private _paddingInner: number = 0.2; // 바 사이의 간격 비율 (0 ~ 1)
  private _paddingOuter: number = 0.1; // 좌우 끝의 여백 비율 (0 ~ 1)

  // 뷰포트 윈도우 (줌/팬 가상화용)
  private _viewStart: number = 0;
  private _viewEnd: number = 0;

  constructor(domainCount: number = 0, range: [number, number] = [0, 1]) {
    this.setDomainCount(domainCount);
    this._range = range;
  }

  setDomainCount(count: number): this {
    this._domainCount = Math.max(0, count);
    this._viewStart = 0;
    this._viewEnd = Math.max(0, count - 1);
    return this;
  }

  setViewport(start: number, end: number): this {
    this._viewStart = Math.max(0, Math.min(start, this._domainCount - 1));
    this._viewEnd = Math.max(this._viewStart, Math.min(end, this._domainCount - 1));
    return this;
  }

  getViewport(): [number, number] {
    return [this._viewStart, this._viewEnd];
  }

  getVisibleCount(): number {
    if (this._domainCount === 0) return 0;
    return this._viewEnd - this._viewStart + 1;
  }

  range(): [number, number];
  range(newRange: [number, number]): this;
  range(newRange?: [number, number]): [number, number] | this {
    if (!newRange) return [...this._range];
    this._range = [newRange[0], newRange[1]];
    return this;
  }

  padding(inner: number, outer?: number): this {
    this._paddingInner = Math.max(0, Math.min(1, inner));
    this._paddingOuter = Math.max(0, Math.min(1, outer !== undefined ? outer : inner));
    return this;
  }

  /**
   * 한 슬롯의 전체 너비 (바 너비 + 우측 간격)
   */
  step(): number {
    const count = this.getVisibleCount();
    if (count === 0) return 0;
    const width = this._range[1] - this._range[0];
    const totalSteps = count - this._paddingInner + 2 * this._paddingOuter;
    return totalSteps > 0 ? width / totalSteps : 0;
  }

  /**
   * 실제 바(Bar)의 순수 픽셀 너비
   */
  bandwidth(): number {
    const stepVal = this.step();
    return Math.max(1, stepVal * (1 - this._paddingInner));
  }

  /**
   * 특정 데이터 인덱스의 X 시작 픽셀 좌표
   */
  scale(index: number): number {
    const stepVal = this.step();
    const relativeIndex = index - this._viewStart;
    return this._range[0] + (this._paddingOuter + relativeIndex) * stepVal;
  }

  /**
   * 마우스 X 픽셀 좌표로부터 데이터 인덱스를 O(1)로 역산
   */
  invert(pixel: number): number {
    const stepVal = this.step();
    if (stepVal === 0) return -1;
    const offset = pixel - this._range[0] - this._paddingOuter * stepVal;
    const relativeIndex = Math.floor(offset / stepVal);
    const index = this._viewStart + relativeIndex;
    if (index < 0 || index >= this._domainCount) return -1;
    return index;
  }
}
