"use client";

import React from 'react';
import { AiThinkingOrb, OrbPhase } from '../ui/ai-thinking-orb';

export { AiThinkingOrb } from '../ui/ai-thinking-orb';
export type { OrbPhase } from '../ui/ai-thinking-orb';

/** Cores corporativas oficiais do CopperOS: Âmbar Cobre, Esmeralda, Neon Mint e Cyan Elétrico */
export const COPPER_PLASMA_COLORS = [
  '#F59E0B', // Âmbar Cobre Refinado
  '#10B981', // Esmeralda Copper
  '#00FF88', // Verde Neon Luminous
  '#00F0FF', // Cyan Tecnológico
  '#EA580C', // Cobre Forja Quente
];

export interface PlasmaRingProps {
  /** Se a IA está falando no momento — altera dinâmica, amplitude de ondas e rotação vocal */
  isSpeaking?: boolean;
  /** Fase do assistente de voz */
  phase?: OrbPhase;
  /** Paleta de cores (compatibilidade) */
  colors?: string[];
  /** Densidade da malha de partículas */
  density?: number;
  /** Velocidade base */
  speed?: number;
  /** Altura base da onda */
  waveHeight?: number;
  /** Opacidade do centro */
  centerOpacity?: number;
  /** Escala da câmera */
  scale?: number;
  /** Sensibilidade ao arrastar */
  dragSensitivity?: number;
  /** Permitir interação por mouse/touch */
  interactive?: boolean;
  /** Largura personalizada (ex: 200, "100%") */
  width?: number | string;
  /** Altura personalizada */
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * PlasmaRing / AiThinkingOrb do CopperOS
 * Implementação fiel do componente 21st.dev (anark17r/ai-thiking-orb-and-input)
 * com 16 anéis de partículas esféricas 3D, ondas de raciocínio, rotação em vórtice
 * e paleta de cores corporativa Cobre & Esmeralda.
 */
export const PlasmaRing: React.FC<PlasmaRingProps> = ({
  isSpeaking = false,
  phase = 'standby',
  speed = 1,
  interactive = true,
  width = '100%',
  height = '100%',
  className = '',
  style,
}) => {
  // Normaliza velocidade se fornecida na escala legada (ex: 70 a 160)
  const normalizedSpeed = speed > 10 ? speed / 90 : speed;

  return (
    <div
      style={{
        width,
        height,
        ...style,
      }}
      className={`relative flex items-center justify-center ${className}`}
    >
      <AiThinkingOrb
        phase={phase}
        isSpeaking={isSpeaking}
        size="100%"
        speed={normalizedSpeed}
        interactive={interactive}
      />
    </div>
  );
};

export default PlasmaRing;
