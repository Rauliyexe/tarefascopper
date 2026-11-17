import React, { useEffect, useRef, useState, useCallback } from 'react';
import { voiceTtsService } from '../../services/voiceTtsService';

export type OrbPhase = 'off' | 'standby' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface AiThinkingOrbProps {
  phase?: OrbPhase;
  isSpeaking?: boolean;
  size?: number | string;
  speed?: number;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * AiThinkingOrb / PlasmaRing - Minimalist Green LED Frequency Ring
 * 
 * Design Minimalista CopperOS:
 * - Interior 100% transparente (sem poluição, sem domo opaco, sem pontinhos).
 * - Círculo de fora de LED verde neon (linha verde da marca CopperOS: #10B981, #00FF88, #34D399).
 * - A própria linha verde do círculo ondula com a frequência da voz em tempo real.
 * - Em repouso: anel de LED verde calmo, perfeitamente circular e minimalista.
 * - Na fala: ondas de frequência sonoras com cristas e vales viajam pelo perímetro do anel de LED.
 */
export const AiThinkingOrb: React.FC<AiThinkingOrbProps> = ({
  phase = 'standby',
  isSpeaking = false,
  size = 220,
  speed = 1,
  interactive = true,
  className = '',
  onClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [liveAudioLevel, setLiveAudioLevel] = useState(0);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rotManualRef = useRef({ x: 0, y: 0 });

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let timeAcc = 0;

    let smoothLevel = 0;
    let smoothBass = 0;
    let smoothMid = 0;
    let smoothTreble = 0;

    const baseDim = 260;
    const center = baseDim / 2;
    const baseRadius = 92; // Raio base do anel de LED com margem para oscilações

    const resize = () => {
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(baseDim * dpr);
      canvas.height = Math.round(baseDim * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = (now: number) => {
      const dt = Math.min(0.06, (now - lastTime) / 1000);
      lastTime = now;
      timeAcc += dt * (speedRef.current || 1);

      const p = phaseRef.current;
      const speaking = isSpeakingRef.current;

      // ─────────────────────────────────────────────────────────────
      // 1. CAPTURA DE NÍVEL E FREQUÊNCIA DA VOZ EM TEMPO REAL
      // ─────────────────────────────────────────────────────────────
      let targetLevel = 0;
      let targetBass = 0;
      let targetMid = 0;
      let targetTreble = 0;

      if (speaking || p === 'speaking') {
        const bands = voiceTtsService.getMultiBandLevels();
        targetLevel = bands.level;
        targetBass = bands.bass;
        targetMid = bands.mid;
        targetTreble = bands.treble;
      } else if (p === 'thinking') {
        // Rotação harmônica acelerada de processamento
        targetLevel = 0.38 + Math.sin(timeAcc * 5.0) * 0.15;
        targetBass = 0.45 + Math.sin(timeAcc * 3.5) * 0.2;
        targetMid = 0.55 + Math.cos(timeAcc * 6.5) * 0.25;
        targetTreble = 0.35;
      } else if (p === 'listening') {
        // Leve respiração atenta em repouso
        targetLevel = 0.08 + Math.sin(timeAcc * 2.2) * 0.04;
        targetBass = 0.1;
        targetMid = 0.08;
        targetTreble = 0.05;
      } else {
        // standby / off: repouso minimalista estável
        targetLevel = 0.03 + Math.sin(timeAcc * 1.4) * 0.02;
        targetBass = 0.04;
        targetMid = 0.03;
        targetTreble = 0.02;
      }

      // Interpolação responsiva para resposta maleável e fluida
      const lerpSpeed = Math.min(1, dt * 9.0);
      smoothLevel += (targetLevel - smoothLevel) * lerpSpeed;
      smoothBass += (targetBass - smoothBass) * lerpSpeed;
      smoothMid += (targetMid - smoothMid) * lerpSpeed;
      smoothTreble += (targetTreble - smoothTreble) * lerpSpeed;
      setLiveAudioLevel(smoothLevel);

      // Amortecimento do arraste manual com inércia
      rotManualRef.current.x *= 0.92;
      rotManualRef.current.y *= 0.92;

      // ─────────────────────────────────────────────────────────────
      // 2. RENDERIZAÇÃO DO ANEL DE LED VERDE MALEÁVEL (INTERIOR TRANSPARENTE)
      // ─────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, baseDim, baseDim);

      const tiltX = rotManualRef.current.x * 12;
      const tiltY = rotManualRef.current.y * 12;

      ctx.save();
      ctx.translate(center + tiltX, center + tiltY);

      // 360 amostras ao longo da circunferência para máxima maleabilidade curva
      const numPoints = 360;

      // Amplitude VISÍVEL e MALEÁVEL:
      // - Em repouso: ondulação líquida viva de ~2.5px (mostra que é maleável)
      // - Na fala: ondas amplas e expressivas de 10px a 22px visíveis no anel
      const waveAmplitude = (speaking || p === 'speaking')
        ? (5.0 + smoothLevel * 18.0)
        : p === 'thinking'
        ? (6.0 + smoothLevel * 12.0)
        : (2.2 + smoothLevel * 3.5);

      // Velocidade de propagação dinâmica que acelera com a cadência da voz
      const waveTravelSpeed = timeAcc * (speaking || p === 'speaking' ? 2.5 + smoothLevel * 1.5 : p === 'thinking' ? 3.2 : 1.4);

      // Função geradora de raio maleável com harmônicos elásticos
      const computeRadius = (theta: number, phaseOffset: number = 0, ampMult: number = 1.0) => {
        // Harmônicos elásticos de baixa ordem para manter a suavidade, mas com grande amplitude:
        // Lóbulo 1 (flexão elástica 2θ):
        const h1 = Math.sin(2 * theta - waveTravelSpeed * 0.9 + phaseOffset) * 0.58 * (0.5 + smoothBass * 0.85);
        // Lóbulo 2 (ondulação maleável 3θ):
        const h2 = Math.sin(3 * theta + waveTravelSpeed * 0.75 + 1.2 + phaseOffset) * 0.44 * (0.5 + smoothMid * 0.85);
        // Lóbulo 3 (crista intermediária 4θ):
        const h3 = Math.cos(4 * theta - waveTravelSpeed * 1.1 + 2.5 + phaseOffset) * 0.28 * (0.4 + smoothTreble * 0.7);

        const totalWave = (h1 + h2 + h3) * ampMult;
        return baseRadius + totalWave * waveAmplitude;
      };

      // ─────────────────────────────────────────────────────────────
      // ECO ELÁSTICO SECUNDÁRIO (Sensação de membrana/fluido maleável)
      // ─────────────────────────────────────────────────────────────
      if (speaking || p === 'speaking' || p === 'thinking' || smoothLevel > 0.08) {
        ctx.beginPath();
        const echoStartR = computeRadius(0, 0.45, 0.75);
        const echoMidX = (Math.cos(0) * echoStartR + Math.cos(((numPoints - 1) / numPoints) * Math.PI * 2) * computeRadius(((numPoints - 1) / numPoints) * Math.PI * 2, 0.45, 0.75)) / 2;
        const echoMidY = (Math.sin(0) * echoStartR + Math.sin(((numPoints - 1) / numPoints) * Math.PI * 2) * computeRadius(((numPoints - 1) / numPoints) * Math.PI * 2, 0.45, 0.75)) / 2;
        ctx.moveTo(echoMidX, echoMidY);

        for (let i = 0; i < numPoints; i++) {
          const theta = (i / numPoints) * Math.PI * 2;
          const nextTheta = ((i + 1) / numPoints) * Math.PI * 2;
          const r1 = computeRadius(theta, 0.45, 0.75);
          const r2 = computeRadius(nextTheta, 0.45, 0.75);

          const x1 = Math.cos(theta) * r1;
          const y1 = Math.sin(theta) * r1 * (1.0 + rotManualRef.current.y * 0.05);
          const x2 = Math.cos(nextTheta) * r2;
          const y2 = Math.sin(nextTheta) * r2 * (1.0 + rotManualRef.current.y * 0.05);

          ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
        }
        ctx.closePath();

        ctx.save();
        ctx.strokeStyle = p === 'thinking' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(52, 211, 153, 0.35)';
        ctx.lineWidth = 1.4;
        ctx.shadowColor = p === 'thinking' ? '#F59E0B' : '#10B981';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
      }

      // ─────────────────────────────────────────────────────────────
      // ANEL DE LED VERDE PRINCIPAL (Visível, nítido e maleável)
      // ─────────────────────────────────────────────────────────────
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        const r = computeRadius(theta, 0, 1.0);
        const px = Math.cos(theta) * r;
        const py = Math.sin(theta) * r * (1.0 + rotManualRef.current.y * 0.05);
        points.push({ x: px, y: py });
      }

      ctx.beginPath();
      const startMidX = (points[0].x + points[numPoints - 1].x) / 2;
      const startMidY = (points[0].y + points[numPoints - 1].y) / 2;
      ctx.moveTo(startMidX, startMidY);

      for (let i = 0; i < numPoints; i++) {
        const nextIdx = (i + 1) % numPoints;
        const midX = (points[i].x + points[nextIdx].x) / 2;
        const midY = (points[i].y + points[nextIdx].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }
      ctx.closePath();

      const isThink = p === 'thinking';
      const ledGlowColor = isThink ? '#F59E0B' : '#10B981';
      const ledCoreColor = isThink ? '#FDE047' : '#34D399';
      const ledBrightAccent = isThink ? '#FFFBEB' : '#ECFDF5';

      // 1. Camada de Glow Neon Externa do LED (visibilidade ampla)
      ctx.save();
      ctx.strokeStyle = isThink
        ? `rgba(245, 158, 11, ${0.5 + smoothLevel * 0.4})`
        : `rgba(16, 185, 129, ${0.5 + smoothLevel * 0.45})`;
      ctx.lineWidth = 4.2 + smoothLevel * 2.2;
      ctx.shadowColor = ledGlowColor;
      ctx.shadowBlur = 14 + smoothLevel * 14;
      ctx.stroke();
      ctx.restore();

      // 2. Linha Principal de LED (Nítida, vibrante e bem definida)
      ctx.save();
      ctx.strokeStyle = ledCoreColor;
      ctx.lineWidth = 2.4 + smoothLevel * 0.8;
      ctx.shadowColor = isThink ? '#FBBF24' : '#00FF88';
      ctx.shadowBlur = 6 + smoothLevel * 8;
      ctx.stroke();
      ctx.restore();

      // 3. Filamento Central de Luz (Dá brilho de alta fidelidade ao LED)
      ctx.save();
      ctx.strokeStyle = ledBrightAccent;
      ctx.lineWidth = 1.1;
      ctx.globalAlpha = 0.6 + smoothLevel * 0.35;
      ctx.shadowColor = ledBrightAccent;
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.restore();

      ctx.restore(); // Restaura transformações

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Interatividade suave com o mouse / toque (inclinação leve)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!interactive) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, [interactive]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    rotManualRef.current.x += dx * 0.03;
    rotManualRef.current.y = Math.max(-0.8, Math.min(0.8, rotManualRef.current.y + dy * 0.03));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
        background: 'transparent',
      }}
      className={`relative select-none flex items-center justify-center bg-transparent ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
    >
      {/* 
        CANVAS DO ANEL DE LED VERDE:
        - 100% transparente no interior.
        - Linha verde de LED exterior ondulando com a frequência do som.
      */}
      <canvas
        ref={canvasRef}
        className="w-full h-full relative z-10 pointer-events-none bg-transparent"
        style={{
          filter: `drop-shadow(0 0 ${6 + liveAudioLevel * 10}px rgba(16, 185, 129, ${0.4 + liveAudioLevel * 0.35}))`,
        }}
        aria-hidden="true"
      />
    </div>
  );
};

export default AiThinkingOrb;
