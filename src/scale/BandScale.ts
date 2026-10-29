/**
 * @fileoverview 바 차트 X축용 밴드 스케일 (Band Scale)
 * 
 * 이산형(Categorical) 데이터의 인덱스를 캔버스의 연속적인 픽셀 좌표로 변환합니다.
 * 바와 바 사이의 간격(paddingInner), 양쪽 끝 여백(paddingOuter)을 계산하며,
 * 대용량 데이터 시각화를 위한 뷰포트 가상화(시작 인덱스 ~ 끝 인덱스) 및
 * 마우스 위치로부터 O(1) 초고속 인덱스 역산(invert)을 지원합니다.
 */

export class BandScale {
  /** 전체 데이터 개수 */
  private _domainCount: number = 0;
  /** 캔버스 X축 픽셀 범위 [시작X, 끝X] */
  private _range: [number, number] = [0, 1];
  /** 바 사이의 간격 비율 (0 ~ 1, 기본값: 0.2) */
  private _paddingInner: number = 0.2;
  /** 좌우 양 끝의 여백 비율 (0 ~ 1, 기본값: 0.1) */
  private _paddingOuter: number = 0.1;

  /** 현재 화면에 표시 중인 뷰포트 시작 데이터 인덱스 (줌/팬 가상화용) */
  private _viewStart: number = 0;
  /** 현재 화면에 표시 중인 뷰포트 종료 데이터 인덱스 */
  private _viewEnd: number = 0;

  constructor(domainCount: number = 0, range: [number, number] = [0, 1]) {
    this.setDomainCount(domainCount);
    this._range = range;
  }

  /**
   * 전체 데이터 개수 설정
   */
  setDomainCount(count: number): this {
    this._domainCount = Math.max(0, count);
    this._viewStart = 0;
    this._viewEnd = Math.max(0, count - 1);
    return this;
  }

  /**
   * 화면에 표시할 뷰포트 윈도우 인덱스 범위 설정 (줌 & 팬 시 호출)
   */
  setViewport(start: number, end: number): this {
    this._viewStart = Math.max(0, Math.min(start, this._domainCount - 1));
    this._viewEnd = Math.max(this._viewStart, Math.min(end, this._domainCount - 1));
    return this;
  }

  /**
   * 현재 뷰포트 범위 반환 [start, end]
   */
  getViewport(): [number, number] {
    return [this._viewStart, this._viewEnd];
  }

  /**
   * 현재 화면에 표시 중인 데이터 항목의 총 개수
   */
  getVisibleCount(): number {
    if (this._domainCount === 0) return 0;
    return this._viewEnd - this._viewStart + 1;
  }

  /**
   * 픽셀 범위 반환 또는 설정
   */
  range(): [number, number];
  range(newRange: [number, number]): this;
  range(newRange?: [number, number]): [number, number] | this {
    if (!newRange) return [...this._range];
    this._range = [newRange[0], newRange[1]];
    return this;
  }

  /**
   * 바 간격(paddingInner) 및 양끝 여백(paddingOuter) 비율 설정
   */
  padding(inner: number, outer?: number): this {
    this._paddingInner = Math.max(0, Math.min(1, inner));
    this._paddingOuter = Math.max(0, Math.min(1, outer !== undefined ? outer : inner));
    return this;
  }

  /**
   * 단일 슬롯의 전체 픽셀 너비 (바 너비 + 우측 간격)
   */
  step(): number {
    const count = this.getVisibleCount();
    if (count === 0) return 0;
    const width = this._range[1] - this._range[0];
    const totalSteps = count - this._paddingInner + 2 * this._paddingOuter;
    return totalSteps > 0 ? width / totalSteps : 0;
  }

  /**
   * 실제 바(Bar) 1개의 순수 픽셀 너비 (최소 1px 보장)
   */
  bandwidth(): number {
    const stepVal = this.step();
    return Math.max(1, stepVal * (1 - this._paddingInner));
  }

  /**
   * 특정 데이터 인덱스에 해당하는 바의 시작 X 픽셀 좌표 계산
   * 
   * @param index 원본 데이터 배열의 인덱스
   * @returns 캔버스 상의 X 좌표 (px)
   */
  scale(index: number): number {
    const stepVal = this.step();
    const relativeIndex = index - this._viewStart;
    return this._range[0] + (this._paddingOuter + relativeIndex) * stepVal;
  }

  /**
   * 마우스 X 픽셀 좌표로부터 데이터 인덱스를 O(1)로 역산
   * 
   * 전체 데이터를 순회하지 않고 수학적 나눗셈으로 즉각 인덱스를 계산하므로,
   * 10만 개의 데이터 포인트에서도 0.01ms 내에 호버 대상을 찾아냅니다.
   * 
   * @param pixel 마우스 커서의 X 좌표 (px)
   * @returns 데이터 인덱스 (영역 밖이면 -1)
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
