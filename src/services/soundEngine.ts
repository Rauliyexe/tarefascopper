/**
 * CopperOS UI Sound Synthesis Engine — MODO ZEN & ETÉREO
 * 
 * Motor acústico de micro-interações calmas, orgânicas e meditativas.
 * Substitui osciladores estridentes por ondas senoidais puras (sine),
 * intervalos harmônicos pentatônicos, taças de cristal tibetanas,
 * toques de madeira aveludada e filtros passa-baixa mornos.
 * Zero ruído perturbador, zero latência e volume master repousante.
 */

export type SoundType = 
  | 'click' 
  | 'pop' 
  | 'switch' 
  | 'tab'
  | 'success' 
  | 'error' 
  | 'swoosh' 
  | 'barcodeScan'
  | 'wake'
  | 'thinking'
  | 'standby';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.08; // Nível zen, aveludado e ultra-discreto (zero fadiga auditiva)
  private keepAliveSource: AudioBufferSourceNode | null = null;
  private keepAliveGain: GainNode | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('copperos_sound_enabled');
      this.isMuted = saved !== null ? saved === 'false' : false;
    }
  }

  /**
   * Obtém ou inicializa o AudioContext com retomada segura
   */
  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('copperos_sound_enabled', String(!muted));
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Tab Zen — Micro-toque etéreo e aveludado para troca de abas e submódulos.
   * Onda senoidal pura, sem estalos mecânicos, sem quedas bruscas de afinação.
   * Sensação leve e suave como uma pluma, confortável para alternar dezenas de vezes.
   */
  public playTab(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Frequência suave de conforto acústico (F#4 ~370Hz / Sol 392Hz)
    const baseFreq = 392;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);

    // Filtro passa-baixa arredonda completamente o timbre
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, t);

    // Envelope ultra-suave: fade-in delicado de 4ms e decaimento doce de 35ms
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(this.masterVolume * 0.35, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.045);
  }

  /**
   * Click Zen — Toque suave e leve em superfície nobre
   */
  public playClick(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(349.2, t); // F4 aveludado e relaxante

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(580, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(this.masterVolume * 0.32, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.042);
  }

  public playPop(): void {
    this.playClick();
  }

  /**
   * Switch Zen — Toque de transição repousante (utiliza a mesma maciez da troca de abas)
   */
  public playSwitch(): void {
    this.playTab();
  }

  /**
   * Success Zen — Acorde Celestial de Taça de Cristal / Sino Tibetano
   * Harmonia pentatônica em Ré Maior (D4, A4, D5, F#5) com cauda longa e etérea
   */
  public playSuccess(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // Frequências pentatônicas meditativas e calmas
    const notes = [
      { freq: 293.66, delay: 0.00, dur: 0.85, vol: 0.35 }, // D4 (raiz aconchegante)
      { freq: 440.00, delay: 0.05, dur: 0.95, vol: 0.30 }, // A4 (quinta harmônica)
      { freq: 587.33, delay: 0.10, dur: 1.05, vol: 0.28 }, // D5 (oitava cristalina)
      { freq: 739.99, delay: 0.16, dur: 1.15, vol: 0.24 }, // F#5 (terça luminosa e serena)
    ];

    notes.forEach(({ freq, delay, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);

      // Filtro passa-baixa morno simula a ressonância de taça tibetana
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t + delay);

      const noteGain = this.masterVolume * vol;
      
      // Ataque aveludado (fade-in gradual de 25ms para simular o batedor de feltro)
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.linearRampToValueAtTime(noteGain, t + delay + 0.025);
      // Decaimento exponencial longo e meditativo
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t + delay);
      osc.stop(t + delay + dur + 0.05);
    });
  }

  /**
   * Error / Warning Zen — Toque Profundo e Acolhedor de Marimba Baixa
   * Sem bipes ásperos nem distorções — apenas uma nota grave que chama a atenção com gentileza
   */
  public playError(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // Duas notas graves aveludadas (164Hz - Mi 3 e 220Hz - Lá 3)
    const tones = [
      { freq: 164.8, delay: 0.00, dur: 0.25, vol: 0.40 },
      { freq: 220.0, delay: 0.03, dur: 0.30, vol: 0.28 },
    ];

    tones.forEach(({ freq, delay, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t + delay + dur);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, t + delay); // Corta totalmente qualquer agressividade

      gain.gain.setValueAtTime(0.001, t + delay);
      gain.gain.linearRampToValueAtTime(this.masterVolume * vol, t + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t + delay);
      osc.stop(t + delay + dur + 0.05);
    });
  }

  /**
   * Swoosh Zen — Brisa Etérea e Aveludada
   * Sensação leve e sutil para transições de tela ou abertura de painéis
   */
  public playSwoosh(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(392, t + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(this.masterVolume * 0.20, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.095);
  }

  /**
   * BarcodeScan Zen — Sino Suave de Recepção de Vidro
   * Substitui o bipe estridente de 2450Hz por uma nota limpa e harmônica (880Hz - Lá 5)
   */
  public playBarcodeScan(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t); // Nota Lá 5 límpida e harmônica
    osc.frequency.exponentialRampToValueAtTime(860, t + 0.09);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(this.masterVolume * 0.35, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.095);
  }

  /**
   * Wake Chime — Acorde sutil ascendente (C5 -> E5) para fones de ouvido.
   * Avisa o usuário que o assistente acordou e está ouvindo perfeitamente.
   */
  public playWake(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, t); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, t + 0.09); // E5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, t + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(783.99, t + 0.12); // G5

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(this.masterVolume * 0.4, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(t);
    osc1.stop(t + 0.19);
    osc2.start(t + 0.04);
    osc2.stop(t + 0.19);
  }

  /**
   * Thinking Chime — Confirmação delicada de que o comando terminou e está sendo processado.
   */
  public playThinking(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t); // A4
    osc.frequency.exponentialRampToValueAtTime(523.25, t + 0.07); // C5

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(this.masterVolume * 0.28, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  /**
   * Standby Chime — Acorde descendente suave quando o assistente volta para repouso.
   */
  public playStandby(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, t); // D5
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.1); // A4

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(this.masterVolume * 0.22, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  /**
   * Bluetooth Keep-Alive: Mantém a rota de áudio com o fone de ouvido ativa,
   * evitando que fones Bluetooth TWS entrem em suspensão e cortem a primeira sílaba.
   */
  public startBluetoothKeepAlive(): void {
    const ctx = this.getContext();
    if (!ctx || this.keepAliveSource) return;

    try {
      // Buffer de 1 segundo de silêncio
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.00001, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      this.keepAliveSource = source;
      this.keepAliveGain = gain;
    } catch {
      // Ignora silenciosamente em caso de bloqueio inicial do browser
    }
  }

  public stopBluetoothKeepAlive(): void {
    if (this.keepAliveSource) {
      try {
        this.keepAliveSource.stop();
        this.keepAliveSource.disconnect();
      } catch {
        // noop
      }
      this.keepAliveSource = null;
    }
    if (this.keepAliveGain) {
      try {
        this.keepAliveGain.disconnect();
      } catch {
        // noop
      }
      this.keepAliveGain = null;
    }
  }

  /**
   * Despachador genérico de som
   */
  public play(type: SoundType): void {
    switch (type) {
      case 'click':
      case 'pop':
        this.playClick();
        break;
      case 'switch':
      case 'tab':
        this.playTab();
        break;
      case 'success':
        this.playSuccess();
        break;
      case 'error':
        this.playError();
        break;
      case 'swoosh':
        this.playSwoosh();
        break;
      case 'barcodeScan':
        this.playBarcodeScan();
        break;
      case 'wake':
        this.playWake();
        break;
      case 'thinking':
        this.playThinking();
        break;
      case 'standby':
        this.playStandby();
        break;
    }
  }
}

export const soundEngine = new SoundEngine();
export default soundEngine;
