import { useMemo } from 'react';
import { useCopperOS } from '../../context/CopperOSContext';

/**
 * Paleta dos gráficos.
 *
 * Cada cor foi validada contra as superfícies reais dos cards (branco no claro,
 * #0E1A14 no escuro) nos seis testes de acessibilidade de dados: faixa de
 * luminosidade, piso de croma, separação sob protanopia/deuteranopia
 * (ΔE OKLab ≥ 8), piso de visão normal (ΔE ≥ 15) e contraste ≥ 3:1.
 *
 * Regras que sustentam a paleta:
 * - `series1` (verde da marca) é a cor única das barras nominais — comparação
 *   por tamanho, sem gastar o canal de cor com o que a barra já mostra.
 * - `series1` + `series2` só aparecem juntas quando as séries SÃO o assunto.
 * - `ordinal` é uma rampa de um só matiz, para escalas ordenadas.
 * - `divPositive`/`divNegative` são polos quente/frio de uma divergente, com
 *   cinza neutro no zero.
 *
 * Ao trocar qualquer valor, rode de novo o validador da skill `dataviz`.
 */
export interface ChartPalette {
  surface: string;
  series1: string;
  series2: string;
  ordinal: [string, string, string];
  divPositive: string;
  divNegative: string;
  divMid: string;
  grid: string;
  axis: string;
  muted: string;
  ink: string;
  inkSecondary: string;
  tooltipBg: string;
  tooltipBorder: string;
}

const LIGHT: ChartPalette = {
  surface: '#FFFFFF',
  series1: '#059669',
  series2: '#2a78d6',
  ordinal: ['#10b981', '#059669', '#065f46'],
  divPositive: '#2a78d6',
  divNegative: '#d03b3b',
  divMid: '#f0efec',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  ink: '#111827',
  inkSecondary: '#4B5563',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#E5E7EB',
};

const DARK: ChartPalette = {
  surface: '#0E1A14',
  // Verde da marca vale nos dois modos (mesmo passo aprovado nas duas faixas).
  series1: '#059669',
  series2: '#3987e5',
  ordinal: ['#6ee7b7', '#10b981', '#059669'],
  divPositive: '#3987e5',
  divNegative: '#e66767',
  divMid: '#383835',
  grid: '#2c2c2a',
  axis: '#383835',
  muted: '#898781',
  ink: '#F9FAFB',
  inkSecondary: '#9CA3AF',
  tooltipBg: '#0E1A14',
  tooltipBorder: '#162D20',
};

export function useChartPalette(): ChartPalette {
  const { isDarkMode } = useCopperOS();
  return useMemo(() => (isDarkMode ? DARK : LIGHT), [isDarkMode]);
}

/** Eixos e grade recessivos: hairline sólida, um passo fora da superfície. */
export function axisDefaults(palette: ChartPalette) {
  return {
    axisLine: { show: true, lineStyle: { color: palette.axis, width: 1 } },
    axisTick: { show: false },
    axisLabel: { color: palette.muted, fontSize: 10, fontFamily: 'Inter, system-ui, sans-serif' },
    splitLine: { show: false },
  };
}

export function valueAxisDefaults(palette: ChartPalette) {
  return {
    ...axisDefaults(palette),
    axisLine: { show: false },
    splitLine: { show: true, lineStyle: { color: palette.grid, width: 1, type: 'solid' as const } },
  };
}

/** Rótulo de valor sobre a série — mesma tipografia em barras, linhas e áreas. */
export function valueLabelDefaults(palette: ChartPalette) {
  return {
    show: true,
    color: palette.ink,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'Inter, system-ui, sans-serif',
  };
}

export function tooltipDefaults(palette: ChartPalette) {
  return {
    backgroundColor: palette.tooltipBg,
    borderColor: palette.tooltipBorder,
    borderWidth: 1,
    padding: [8, 12] as [number, number],
    textStyle: { color: palette.ink, fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' },
    extraCssText: 'border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.12);',
  };
}

/** Legenda com o mesmo símbolo da marca: retângulo para barras, linha para linhas. */
export function legendDefaults(palette: ChartPalette, icon: 'rect' | 'line' = 'rect') {
  return {
    show: true,
    icon,
    itemWidth: icon === 'line' ? 16 : 10,
    itemHeight: icon === 'line' ? 2 : 10,
    itemGap: 16,
    textStyle: { color: palette.inkSecondary, fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' },
  };
}
