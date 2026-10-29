import { BarChart } from '../src';
import type { DataItem, BarChartOptions, LabelPosition } from '../src/types';

// 1. 더미 데이터 생성기
function generateData(count: number): DataItem[] {
  const categories = ['Frontend', 'Backend', 'DevOps', 'Mobile', 'AI/ML', 'Cloud', 'Data', 'Security', 'QA', 'Design'];
  const data: DataItem[] = [];

  for (let i = 0; i < count; i++) {
    const cat = categories[i % categories.length];
    const label = count <= 30 ? `${cat} #${i + 1}` : `#${i + 1}`;
    // 부드러운 사인 곡선 + 랜덤 노이즈
    const base = Math.sin(i * 0.1) * 35 + 50;
    const noise = Math.random() * 20 - 10;
    const value = Math.max(5, Math.round(base + noise));

    data.push({
      id: i,
      label,
      value,
    });
  }
  return data;
}

// 2. 테마 프리셋 정의
type ThemeType = 'indigo-purple' | 'cyber-cyan' | 'conditional' | 'warm-orange';

function getThemeOptions(theme: ThemeType, radius: number, widthRatio: number) {
  const borderRadius = [radius, radius, 0, 0];

  switch (theme) {
    case 'indigo-purple':
      return {
        widthRatio,
        borderRadius,
        fill: {
          type: 'linear' as const,
          from: '#6366F1',
          to: '#9333EA',
          direction: 'vertical' as const,
        },
        border: undefined,
        hover: {
          fill: {
            type: 'linear' as const,
            from: '#818CF8',
            to: '#A855F7',
            direction: 'vertical' as const,
          },
        },
      };

    case 'cyber-cyan':
      return {
        widthRatio,
        borderRadius,
        fill: {
          type: 'linear' as const,
          from: '#06B6D4',
          to: '#0284C7',
          direction: 'vertical' as const,
        },
        border: {
          color: '#22D3EE',
          width: 1.5,
        },
        hover: {
          fill: '#38BDF8',
          border: { color: '#E0F2FE', width: 2 },
        },
      };

    case 'conditional':
      return {
        widthRatio,
        borderRadius,
        // 조건부 색상: 70 이상이면 에메랄드 그린, 35 미만이면 레드, 중간은 슬레이트 블루
        fill: (item: DataItem) => {
          if (item.value >= 70) return '#10B981';
          if (item.value < 35) return '#EF4444';
          return '#6366F1';
        },
        border: undefined,
      };

    case 'warm-orange':
      return {
        widthRatio,
        borderRadius,
        fill: {
          type: 'linear' as const,
          from: '#F97316',
          to: '#E11D48',
          direction: 'vertical' as const,
        },
        border: undefined,
      };
  }
}

// 3. 상태 관리 및 차트 초기화
let currentCount = 20;
let currentTheme: ThemeType = 'indigo-purple';
let currentLabelPos: LabelPosition = 'top-outside';
let currentRadius = 6;
let currentWidthRatio = 0.65;

const data = generateData(currentCount);

const chartOptions: BarChartOptions = {
  data,
  padding: {
    top: 36,
    right: 20,
    bottom: 40,
    left: 45,
  },
  bar: getThemeOptions(currentTheme, currentRadius, currentWidthRatio),
  labels: {
    visible: true,
    position: currentLabelPos,
    font: '600 11px Pretendard, sans-serif',
    color: '#94A3B8',
    formatter: (val) => `${val}`,
  },
  grid: {
    y: { visible: true, color: '#1E293B', lineWidth: 1, lineDash: [3, 3] },
  },
  xAxis: {
    font: '11px Pretendard, sans-serif',
    labelColor: '#64748B',
    color: '#1E293B',
  },
  yAxis: {
    font: '11px Pretendard, sans-serif',
    labelColor: '#64748B',
    formatter: (v) => `${v}`,
  },
  zoom: {
    enabled: true,
    minPoints: 5,
  },
  pan: {
    enabled: true,
  },
};

const renderTimeEl = document.getElementById('render-time-text')!;
const totalCountEl = document.getElementById('total-count-text')!;

// 렌더링 시간 측정 래퍼
function measureRender(callback: () => void) {
  const t0 = performance.now();
  callback();
  const t1 = performance.now();
  const diff = (t1 - t0).toFixed(2);
  renderTimeEl.innerText = `${diff}ms`;
}

// 차트 인스턴스 생성
let chart: BarChart;
measureRender(() => {
  chart = new BarChart('#chart-wrapper', chartOptions);
});
totalCountEl.innerText = `${currentCount}`;

// 4. UI 컨트롤러 바인딩

// 데이터 규모 버튼
const dataSizeGroup = document.getElementById('data-size-group')!;
dataSizeGroup.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    dataSizeGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    currentCount = parseInt(btn.dataset.size || '20', 10);
    const newData = generateData(currentCount);
    totalCountEl.innerText = `${currentCount}`;

    // 500개 이상 대용량일 경우 기본 라벨은 숨기거나 top-outside로 설정
    const shouldShowLabels = currentCount <= 50;
    if (!shouldShowLabels && currentLabelPos !== 'none') {
      (document.getElementById('label-pos-select') as HTMLSelectElement).value = 'none';
      currentLabelPos = 'none';
    }

    measureRender(() => {
      chart.update({
        data: newData,
        labels: {
          visible: currentLabelPos !== 'none',
          position: currentLabelPos,
        },
      });
      chart.resetZoom();
    });
  });
});

// 테마 셀렉트
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
themeSelect.addEventListener('change', () => {
  currentTheme = themeSelect.value as ThemeType;
  measureRender(() => {
    chart.update({
      bar: getThemeOptions(currentTheme, currentRadius, currentWidthRatio),
    });
  });
});

// 라벨 위치 셀렉트
const labelPosSelect = document.getElementById('label-pos-select') as HTMLSelectElement;
labelPosSelect.addEventListener('change', () => {
  currentLabelPos = labelPosSelect.value as LabelPosition;
  measureRender(() => {
    chart.update({
      labels: {
        visible: currentLabelPos !== 'none',
        position: currentLabelPos,
      },
    });
  });
});

// 모서리 둥글기 슬라이더
const radiusRange = document.getElementById('radius-range') as HTMLInputElement;
const radiusVal = document.getElementById('radius-val')!;
radiusRange.addEventListener('input', () => {
  currentRadius = parseInt(radiusRange.value, 10);
  radiusVal.innerText = `${currentRadius}px`;
  measureRender(() => {
    chart.update({
      bar: getThemeOptions(currentTheme, currentRadius, currentWidthRatio),
    });
  });
});

// 바 너비 비율 슬라이더
const ratioRange = document.getElementById('ratio-range') as HTMLInputElement;
const ratioVal = document.getElementById('ratio-val')!;
ratioRange.addEventListener('input', () => {
  const percent = parseInt(ratioRange.value, 10);
  currentWidthRatio = percent / 100;
  ratioVal.innerText = `${percent}%`;
  measureRender(() => {
    chart.update({
      bar: getThemeOptions(currentTheme, currentRadius, currentWidthRatio),
    });
  });
});

// 줌 리셋 버튼
const resetZoomBtn = document.getElementById('reset-zoom-btn')!;
resetZoomBtn.addEventListener('click', () => {
  chart.resetZoom();
});
