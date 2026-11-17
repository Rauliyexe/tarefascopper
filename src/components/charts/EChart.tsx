import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, RadarChart, GaugeChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  TitleComponent,
  ToolboxComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

// Registro dos módulos do Apache ECharts utilizados no CopperOS
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

interface EChartProps {
  option: EChartsCoreOption;
  /** Altura do gráfico já contando a faixa do eixo X. */
  height?: number;
  /** Descrição do gráfico para leitores de tela — o canvas em si não é acessível. */
  ariaLabel: string;
  className?: string;
}

/**
 * Casca fina em volta do Apache ECharts: cria a instância, aplica a opção,
 * acompanha o redimensionamento do container e destrói no unmount.
 *
 * A tabela de dados do ChartCard é o caminho acessível — o canvas é apenas a
 * representação visual.
 */
export const EChart: React.FC<EChartProps> = ({ option, height = 260, ariaLabel, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = echarts.init(container, undefined, { renderer: 'canvas' });
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // `true` descarta a opção anterior — necessário porque a troca de tema
  // reescreve cores, rótulos e séries de uma vez.
  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={containerRef} style={{ height }} className={className} role="img" aria-label={ariaLabel} />;
};
