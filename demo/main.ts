import { BarChart, LineChart, PieChart } from '../src';
import type {
  DataItem,
  BarChartOptions,
  LineChartOptions,
  PieChartOptions,
  BarSeriesDataset,
  LineSeriesDataset,
  BarGroupMode,
  LabelPosition,
  LineCurveType,
  EasingType,
  LegendPosition,
  LegendOptions,
} from '../src';

type ChartMode = 'bar' | 'line' | 'pie';
type SeriesMode = 'single' | 'grouped' | 'stacked' | 'percent';
type ThemeType = 'indigo-purple' | 'cyber-cyan' | 'conditional' | 'warm-orange';

// 1. 더미 데이터 생성기
function generateData(count: number): DataItem[] {
  const categories = ['Frontend', 'Backend', 'AI/ML', 'Cloud', 'Design'];
  const data: DataItem[] = [];

  for (let i = 0; i < count; i++) {
    const cat = categories[i % categories.length];
    const label = count <= 30 ? `${cat} #${i + 1}` : `#${i + 1}`;
    const base = Math.sin(i * 0.12) * 32 + 52;
    const noise = Math.random() * 18 - 9;
    const value = Math.max(8, Math.round(base + noise));

    data.push({
      id: i,
      label,
      value,
      category: cat,
    });
  }
  return data;
}

function generateMultiBarSeries(count: number): { xLabels: string[]; series: BarSeriesDataset[] } {
  const xLabels: string[] = [];
  const s1: number[] = [];
  const s2: number[] = [];
  const s3: number[] = [];

  for (let i = 0; i < count; i++) {
    xLabels.push(count <= 24 ? `${i + 1}일` : `#${i + 1}`);
    s1.push(Math.max(12, Math.round(Math.sin(i * 0.25) * 25 + 48 + (Math.random() * 10 - 5))));
    s2.push(Math.max(10, Math.round(Math.cos(i * 0.22) * 20 + 36 + (Math.random() * 10 - 5))));
    s3.push(Math.max(8, Math.round(Math.sin(i * 0.18 + 1.2) * 18 + 28 + (Math.random() * 8 - 4))));
  }

  return {
    xLabels,
    series: [
      {
        name: 'Frontend',
        data: s1,
        color: { type: 'linear', from: '#6366F1', to: '#4F46E5', direction: 'vertical' },
      },
      {
        name: 'Backend',
        data: s2,
        color: { type: 'linear', from: '#10B981', to: '#059669', direction: 'vertical' },
      },
      {
        name: 'AI / Cloud',
        data: s3,
        color: { type: 'linear', from: '#F59E0B', to: '#D97706', direction: 'vertical' },
      },
    ],
  };
}

function generateMultiLineSeries(count: number): { xLabels: string[]; series: LineSeriesDataset[] } {
  const xLabels: string[] = [];
  const s1: number[] = [];
  const s2: number[] = [];
  const s3: number[] = [];

  for (let i = 0; i < count; i++) {
    xLabels.push(count <= 24 ? `${i + 1}일` : `#${i + 1}`);
    s1.push(Math.max(15, Math.round(Math.sin(i * 0.2) * 28 + 55 + (Math.random() * 8 - 4))));
    s2.push(Math.max(12, Math.round(Math.cos(i * 0.18) * 22 + 42 + (Math.random() * 8 - 4))));
    s3.push(Math.max(10, Math.round(Math.sin(i * 0.15 + 1.5) * 18 + 30 + (Math.random() * 6 - 3))));
  }

  return {
    xLabels,
    series: [
      { name: '모바일 트래픽', data: s1, color: '#6366F1' },
      { name: '데스크톱 트래픽', data: s2, color: '#22D3EE' },
      { name: 'API 호출량', data: s3, color: '#F43F5E', dash: [6, 4] },
    ],
  };
}

function generatePieData(): DataItem[] {
  return [
    { label: 'Frontend', value: 38 },
    { label: 'Backend', value: 27 },
    { label: 'AI / Data', value: 18 },
    { label: 'Cloud / DevOps', value: 11 },
    { label: 'Design System', value: 6 },
  ];
}

// 2. Bar 테마 프리셋
function getBarThemeOptions(theme: ThemeType, radius: number, widthRatio: number) {
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

// 3. Line 테마 프리셋
function getLineThemeOptions(theme: ThemeType, curve: LineCurveType) {
  switch (theme) {
    case 'indigo-purple':
      return {
        line: {
          color: { type: 'linear' as const, from: '#818CF8', to: '#C084FC', direction: 'horizontal' as const },
          width: 2.5,
          curve,
        },
        area: {
          visible: true,
          fill: {
            type: 'linear' as const,
            from: 'rgba(99, 102, 241, 0.45)',
            to: 'rgba(147, 51, 234, 0.0)',
            direction: 'vertical' as const,
          },
        },
        points: {
          visible: true,
          radius: 4,
          hoverRadius: 6,
          borderColor: '#818CF8',
        },
      };

    case 'cyber-cyan':
      return {
        line: {
          color: '#22D3EE',
          width: 2.5,
          curve,
        },
        area: {
          visible: true,
          fill: {
            type: 'linear' as const,
            from: 'rgba(6, 182, 212, 0.42)',
            to: 'rgba(2, 132, 199, 0.0)',
            direction: 'vertical' as const,
          },
        },
        points: {
          visible: true,
          radius: 4,
          hoverRadius: 6,
          borderColor: '#22D3EE',
        },
      };

    case 'conditional':
      return {
        line: {
          color: '#10B981',
          width: 2.5,
          curve,
        },
        area: {
          visible: true,
          fill: {
            type: 'linear' as const,
            from: 'rgba(16, 185, 129, 0.38)',
            to: 'rgba(16, 185, 129, 0.0)',
            direction: 'vertical' as const,
          },
        },
        points: {
          visible: true,
          radius: 4.5,
          hoverRadius: 6.5,
          borderColor: (item: DataItem) => {
            if (item.value >= 70) return '#10B981';
            if (item.value < 35) return '#EF4444';
            return '#6366F1';
          },
        },
      };

    case 'warm-orange':
      return {
        line: {
          color: { type: 'linear' as const, from: '#FB923C', to: '#F43F5E', direction: 'horizontal' as const },
          width: 2.5,
          curve,
        },
        area: {
          visible: true,
          fill: {
            type: 'linear' as const,
            from: 'rgba(249, 115, 22, 0.42)',
            to: 'rgba(225, 29, 72, 0.0)',
            direction: 'vertical' as const,
          },
        },
        points: {
          visible: true,
          radius: 4,
          hoverRadius: 6,
          borderColor: '#FB923C',
        },
      };
  }
}

// 4. 상태 변수
let currentMode: ChartMode = 'bar';
let currentSeriesMode: SeriesMode = 'single';
let currentCount = 20;
let currentTheme: ThemeType = 'indigo-purple';
let currentLabelPos: LabelPosition = 'top-outside';
let currentRadius = 6;
let currentWidthRatio = 0.65;
let currentCurve: LineCurveType = 'smooth';
let currentHoleRatio = 0.6;
let currentEasing: EasingType = 'easeOutQuart';
let currentLegendPos: LegendPosition | 'none' = 'top';

function getLegendConfig(): LegendOptions {
  if (currentLegendPos === 'none') {
    return { visible: false };
  }
  return {
    visible: true,
    position: currentLegendPos,
    align: currentLegendPos === 'top' || currentLegendPos === 'bottom' ? 'center' : 'center',
    markerShape: currentMode === 'pie' ? 'circle' : 'rounded',
    interactive: true,
  };
}

let currentData = generateData(currentCount);
let currentMultiBar = generateMultiBarSeries(currentCount);
let currentMultiLine = generateMultiLineSeries(currentCount);

let barChart: BarChart | null = null;
let lineChart: LineChart | null = null;
let pieChart: PieChart | null = null;

const renderTimeEl = document.getElementById('render-time-text')!;
const totalCountEl = document.getElementById('total-count-text')!;
const wrapperEl = document.getElementById('chart-wrapper')!;

function measureRender(callback: () => void) {
  const t0 = performance.now();
  callback();
  const t1 = performance.now();
  renderTimeEl.innerText = `${(t1 - t0).toFixed(2)}ms`;
}

function destroyActiveChart() {
  if (barChart) {
    barChart.destroy();
    barChart = null;
  }
  if (lineChart) {
    lineChart.destroy();
    lineChart = null;
  }
  if (pieChart) {
    pieChart.destroy();
    pieChart = null;
  }
  wrapperEl.innerHTML = '';
}

function updateControlsVisibility() {
  const isBar = currentMode === 'bar';
  const isLine = currentMode === 'line';
  const isPie = currentMode === 'pie';

  document.getElementById('series-mode-control')!.style.display = isPie ? 'none' : '';
  document.getElementById('data-size-control')!.style.display = isPie ? 'none' : '';
  document.getElementById('theme-control')!.style.display = isPie ? 'none' : '';
  document.getElementById('line-curve-control')!.style.display = isLine ? '' : 'none';
  document.getElementById('pie-hole-control')!.style.display = isPie ? '' : 'none';
  document.getElementById('label-pos-control')!.style.display = isPie ? 'none' : '';
  document.getElementById('bar-radius-control')!.style.display = isBar ? '' : 'none';
  document.getElementById('bar-ratio-control')!.style.display = isBar ? '' : 'none';
  document.getElementById('reset-zoom-btn')!.style.display = isPie ? 'none' : '';
}

function mountChart() {
  destroyActiveChart();
  updateControlsVisibility();

  const animConfig = {
    enabled: true,
    duration: 680,
    easing: currentEasing,
  };

  const isMulti = currentSeriesMode !== 'single';

  if (currentMode === 'bar') {
    const barMode: BarGroupMode =
      currentSeriesMode === 'stacked'
        ? 'stacked'
        : currentSeriesMode === 'percent'
          ? 'percent'
          : 'grouped';

    const options: BarChartOptions = {
      data: isMulti ? undefined : currentData,
      series: isMulti ? currentMultiBar.series : undefined,
      xLabels: isMulti ? currentMultiBar.xLabels : undefined,
      padding: { top: 36, right: 20, bottom: 40, left: 45 },
      bar: {
        ...getBarThemeOptions(currentTheme, currentRadius, currentWidthRatio),
        mode: barMode,
      },
      legend: getLegendConfig(),
      animation: animConfig,
      labels: {
        visible: currentLabelPos !== 'none',
        position: currentLabelPos,
        font: '600 11px Pretendard, sans-serif',
        color: '#94A3B8',
        formatter: barMode === 'percent' ? undefined : (val) => `${val}`,
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
        formatter: (v) => (barMode === 'percent' ? `${v}%` : `${v}`),
      },
      zoom: { enabled: true, minPoints: 5 },
      pan: { enabled: true },
    };

    measureRender(() => {
      barChart = new BarChart('#chart-wrapper', options);
    });
    totalCountEl.innerText = isMulti ? `${currentCount} × ${currentMultiBar.series.length}` : `${currentData.length}`;
  } else if (currentMode === 'line') {
    const lineTheme = getLineThemeOptions(currentTheme, currentCurve);
    const isStackedLine = currentSeriesMode === 'stacked' || currentSeriesMode === 'percent';

    const options: LineChartOptions = {
      data: isMulti ? undefined : currentData,
      series: isMulti ? currentMultiLine.series : undefined,
      xLabels: isMulti ? currentMultiLine.xLabels : undefined,
      stacked: isMulti && isStackedLine,
      padding: { top: 36, right: 20, bottom: 40, left: 45 },
      line: lineTheme.line,
      area: lineTheme.area,
      points: lineTheme.points,
      legend: getLegendConfig(),
      animation: animConfig,
      labels: {
        visible: currentLabelPos !== 'none',
        position: currentLabelPos,
        font: '600 11px Pretendard, sans-serif',
        color: '#94A3B8',
        formatter: (val) => `${val}`,
      },
      crosshair: {
        enabled: true,
        vertical: true,
        horizontal: true,
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
      zoom: { enabled: true, minPoints: 5 },
      pan: { enabled: true },
    };

    measureRender(() => {
      lineChart = new LineChart('#chart-wrapper', options);
    });
    totalCountEl.innerText = isMulti ? `${currentCount} × ${currentMultiLine.series.length}` : `${currentData.length}`;
  } else {
    const pieData = generatePieData();
    const options: PieChartOptions = {
      data: pieData,
      legend: getLegendConfig(),
      animation: animConfig,
      pie: {
        innerRadiusRatio: currentHoleRatio,
        padAngle: 0.025,
        hoverExplode: 10,
      },
      center:
        currentHoleRatio >= 0.35
          ? {
              title: (_d, total) => `${total}%`,
              subtitle: '전체 리소스 비중',
            }
          : undefined,
      labels: {
        visible: true,
        position: 'outside',
      },
    };

    measureRender(() => {
      pieChart = new PieChart('#chart-wrapper', options);
    });
    totalCountEl.innerText = `${pieData.length}`;
  }
}

// 초기 마운트
mountChart();

// 5. UI 이벤트 바인딩

// 차트 타입 버튼
const chartTypeGroup = document.getElementById('chart-type-group')!;
chartTypeGroup.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    chartTypeGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = (btn.dataset.type as ChartMode) || 'bar';
    mountChart();
  });
});

// 시리즈 구성 모드 셀렉트 (Single / Grouped / Stacked / Percent)
const seriesModeSelect = document.getElementById('series-mode-select') as HTMLSelectElement;
seriesModeSelect.addEventListener('change', () => {
  currentSeriesMode = seriesModeSelect.value as SeriesMode;
  mountChart();
});

// 데이터 규모 버튼
const dataSizeGroup = document.getElementById('data-size-group')!;
dataSizeGroup.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    dataSizeGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    currentCount = parseInt(btn.dataset.size || '20', 10);
    currentData = generateData(currentCount);
    currentMultiBar = generateMultiBarSeries(currentCount);
    currentMultiLine = generateMultiLineSeries(currentCount);
    const isMulti = currentSeriesMode !== 'single';
    totalCountEl.innerText = isMulti ? `${currentCount} × 3` : `${currentCount}`;

    const shouldShowLabels = currentCount <= 50;
    if (!shouldShowLabels && currentLabelPos !== 'none') {
      (document.getElementById('label-pos-select') as HTMLSelectElement).value = 'none';
      currentLabelPos = 'none';
    }

    measureRender(() => {
      if (barChart) {
        barChart.update({
          data: isMulti ? undefined : currentData,
          series: isMulti ? currentMultiBar.series : undefined,
          xLabels: isMulti ? currentMultiBar.xLabels : undefined,
          labels: { visible: currentLabelPos !== 'none', position: currentLabelPos },
        });
      } else if (lineChart) {
        lineChart.update({
          data: isMulti ? undefined : currentData,
          series: isMulti ? currentMultiLine.series : undefined,
          xLabels: isMulti ? currentMultiLine.xLabels : undefined,
          labels: { visible: currentLabelPos !== 'none', position: currentLabelPos },
        });
      }
    });
  });
});

// 테마 셀렉트
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
themeSelect.addEventListener('change', () => {
  currentTheme = themeSelect.value as ThemeType;
  measureRender(() => {
    if (barChart) {
      barChart.update({
        bar: getBarThemeOptions(currentTheme, currentRadius, currentWidthRatio),
      });
    } else if (lineChart) {
      const lineTheme = getLineThemeOptions(currentTheme, currentCurve);
      lineChart.update({
        line: lineTheme.line,
        area: lineTheme.area,
        points: lineTheme.points,
      });
    }
  });
});

// 라인 곡선 보간 셀렉트
const curveSelect = document.getElementById('curve-select') as HTMLSelectElement;
curveSelect.addEventListener('change', () => {
  currentCurve = curveSelect.value as LineCurveType;
  measureRender(() => {
    if (lineChart) {
      lineChart.update({
        line: { curve: currentCurve },
      });
    }
  });
});

// 도넛 내부 반지름 슬라이더
const holeRange = document.getElementById('hole-range') as HTMLInputElement;
const holeVal = document.getElementById('hole-val')!;
holeRange.addEventListener('input', () => {
  const percent = parseInt(holeRange.value, 10);
  currentHoleRatio = percent / 100;
  holeVal.innerText = `${percent}%`;
  measureRender(() => {
    if (pieChart) {
      pieChart.update({
        pie: { innerRadiusRatio: currentHoleRatio },
        center:
          currentHoleRatio >= 0.35
            ? {
                title: (_d, total) => `${total}%`,
                subtitle: '전체 리소스 비중',
              }
            : { title: '', subtitle: '' },
      });
    }
  });
});

// 라벨 위치 셀렉트
const labelPosSelect = document.getElementById('label-pos-select') as HTMLSelectElement;
labelPosSelect.addEventListener('change', () => {
  currentLabelPos = labelPosSelect.value as LabelPosition;
  measureRender(() => {
    const labelCfg = {
      visible: currentLabelPos !== 'none',
      position: currentLabelPos,
    };
    if (barChart) barChart.update({ labels: labelCfg });
    if (lineChart) lineChart.update({ labels: labelCfg });
  });
});

// 모서리 둥글기 슬라이더
const radiusRange = document.getElementById('radius-range') as HTMLInputElement;
const radiusVal = document.getElementById('radius-val')!;
radiusRange.addEventListener('input', () => {
  currentRadius = parseInt(radiusRange.value, 10);
  radiusVal.innerText = `${currentRadius}px`;
  measureRender(() => {
    if (barChart) {
      barChart.update({
        bar: getBarThemeOptions(currentTheme, currentRadius, currentWidthRatio),
      });
    }
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
    if (barChart) {
      barChart.update({
        bar: getBarThemeOptions(currentTheme, currentRadius, currentWidthRatio),
      });
    }
  });
});

// 애니메이션 이징 셀렉트
const easingSelect = document.getElementById('easing-select') as HTMLSelectElement;
easingSelect.addEventListener('change', () => {
  currentEasing = easingSelect.value as EasingType;
  const animConfig = { enabled: true, duration: 680, easing: currentEasing };
  if (barChart) {
    barChart.update({ animation: animConfig });
    barChart.replayAnimation();
  }
  if (lineChart) {
    lineChart.update({ animation: animConfig });
    lineChart.replayAnimation();
  }
  if (pieChart) {
    pieChart.update({ animation: animConfig });
    pieChart.replayAnimation();
  }
});

// 애니메이션 다시 재생 버튼
document.getElementById('replay-anim-btn')!.addEventListener('click', () => {
  if (barChart) barChart.replayAnimation();
  if (lineChart) lineChart.replayAnimation();
  if (pieChart) pieChart.replayAnimation();
});

// 범례 위치 셀렉트
const legendPosSelect = document.getElementById('legend-pos-select') as HTMLSelectElement;
legendPosSelect.addEventListener('change', () => {
  currentLegendPos = legendPosSelect.value as LegendPosition | 'none';
  const legendCfg = getLegendConfig();
  measureRender(() => {
    if (barChart) barChart.update({ legend: legendCfg });
    if (lineChart) lineChart.update({ legend: legendCfg });
    if (pieChart) pieChart.update({ legend: legendCfg });
  });
});

// 줌 리셋 버튼
document.getElementById('reset-zoom-btn')!.addEventListener('click', () => {
  measureRender(() => {
    if (barChart) barChart.resetZoom();
    if (lineChart) lineChart.resetZoom();
  });
});

// Figma 호환 순수 벡터(SVG) 클립보드 복사 버튼
const copySvgBtn = document.getElementById('copy-svg-btn')!;
copySvgBtn.addEventListener('click', async () => {
  let svg = '';
  const exportOpts = { backgroundColor: '#151C2C', backgroundRadius: 16 };
  if (barChart) svg = barChart.toSVG(exportOpts);
  else if (lineChart) svg = lineChart.toSVG(exportOpts);
  else if (pieChart) svg = pieChart.toSVG(exportOpts);

  if (!svg) return;

  try {
    await navigator.clipboard.writeText(svg);
    const origText = copySvgBtn.innerText;
    copySvgBtn.innerText = '✅ 복사됨! (Figma에 Ctrl+V)';
    setTimeout(() => {
      copySvgBtn.innerText = origText;
    }, 2200);
  } catch {
    // 클립보드 권한 실패 시 파일 다운로드 폴백
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nanocharts-${currentMode}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }
});
