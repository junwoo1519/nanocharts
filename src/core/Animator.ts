/**
 * @fileoverview 초경량 60fps 애니메이션 엔진 (Animator)
 * 
 * 외부 의존성 없이 `requestAnimationFrame`과 내장 이징(Easing) 함수를 활용하여
 * 차트 시리즈 레이어의 성장(Grow), 와이프(Wipe), 회전(Sweep) 애니메이션을 구동합니다.
 */

import type { AnimationOptions, EasingType } from '../types';

/**
 * 표준 이징(가감속) 수학 함수 모음
 * 입력 `t`는 0.0(시작) ~ 1.0(완료) 사이의 정규화된 진행률입니다.
 */
export const EASINGS: Record<EasingType, (t: number) => number> = {
  linear: (t: number) => t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export class Animator {
  private rafId: number | null = null;

  /**
   * 사용자 애니메이션 설정(`boolean | AnimationOptions | undefined`)을 표준 객체로 정규화합니다.
   */
  public static resolveOptions(
    input?: boolean | AnimationOptions
  ): Required<Omit<AnimationOptions, 'onComplete'>> & { onComplete?: () => void } {
    if (input === false) {
      return {
        enabled: false,
        duration: 0,
        easing: 'easeOutQuart',
      };
    }
    if (input === true || input === undefined) {
      return {
        enabled: true,
        duration: 650,
        easing: 'easeOutQuart',
      };
    }
    return {
      enabled: input.enabled ?? true,
      duration: Math.max(0, input.duration ?? 650),
      easing: input.easing ?? 'easeOutQuart',
      onComplete: input.onComplete,
    };
  }

  /**
   * 0에서 1까지 진행되는 애니메이션 루프를 시작합니다.
   * 기존에 실행 중이던 애니메이션이 있으면 즉시 취소하고 새로 시작합니다.
   * 
   * @param options 애니메이션 설정
   * @param onFrame 매 프레임마다 이징이 적용된 진행률(`progress`)을 전달받는 렌더링 콜백
   */
  public start(
    options: boolean | AnimationOptions | undefined,
    onFrame: (progress: number) => void
  ): void {
    this.cancel();

    const resolved = Animator.resolveOptions(options);
    if (!resolved.enabled || resolved.duration <= 0) {
      onFrame(1);
      resolved.onComplete?.();
      return;
    }

    const easingFn =
      typeof resolved.easing === 'function'
        ? resolved.easing
        : EASINGS[resolved.easing] || EASINGS.easeOutQuart;

    const startTime = performance.now();
    const duration = resolved.duration;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const rawT = Math.min(1, Math.max(0, elapsed / duration));
      const easedProgress = easingFn(rawT);

      onFrame(easedProgress);

      if (rawT < 1) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
        resolved.onComplete?.();
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * 현재 진행 중인 애니메이션이 있는지 여부를 반환합니다.
   */
  public isAnimating(): boolean {
    return this.rafId !== null;
  }

  /**
   * 실행 중인 애니메이션 루프를 즉시 중단합니다.
   */
  public cancel(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
