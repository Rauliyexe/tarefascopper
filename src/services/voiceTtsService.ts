/**
 * Serviço de Síntese de Voz de Alta Fidelidade (TTS Neural) do CopperOS.
 *
 * Suporta múltiplos provedores:
 *  1. Microsoft Edge Neural TTS (100% Grátis, sem limites, ultra-realista pt-BR)
 *  2. ElevenLabs (Opcional - suporte a API Key gratuita / customizada)
 *  3. Web Speech API (Fallback nativo resiliente offline)
 */

export type VoiceProvider = 'edge-neural' | 'elevenlabs' | 'web-speech';

export interface NeuralVoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
  provider: VoiceProvider;
  description: string;
}

export const VOICE_ALIAS_MAP: Record<string, string> = {
  'pt-BR-ThalitaNeural': 'pt-BR-ThalitaMultilingualNeural',
  'pt-BR-DonatoNeural': 'en-US-AndrewMultilingualNeural',
  'pt-BR-FabioNeural': 'en-US-BrianMultilingualNeural',
  'pt-BR-ElzaNeural': 'en-US-AvaMultilingualNeural',
};

export const PRESET_VOICES: NeuralVoiceOption[] = [
  {
    id: 'pt-BR-AntonioNeural',
    name: 'Antônio Neural (Executivo Masculino)',
    gender: 'male',
    provider: 'edge-neural',
    description: 'Voz masculina madura, sóbria, acolhedora e executiva. Voz oficial do assistente do André.',
  },
  {
    id: 'pt-BR-FranciscaNeural',
    name: 'Francisca Neural (Profissional Feminina)',
    gender: 'female',
    provider: 'edge-neural',
    description: 'Voz feminina articulada, elegante e clara para operações, relatórios e despacho executivo.',
  },
  {
    id: 'pt-BR-ThalitaMultilingualNeural',
    name: 'Thalita Neural (Dinâmica & Ágil)',
    gender: 'female',
    provider: 'edge-neural',
    description: 'Tom jovem, positivo e veloz para alertas rápidos, KPIs e notificações em tempo real.',
  },
  {
    id: 'en-US-AndrewMultilingualNeural',
    name: 'Andrew Neural (Locutor Executivo)',
    gender: 'male',
    provider: 'edge-neural',
    description: 'Tom grave, encorpado e imponente, ideal para apresentações e relatórios de diretoria.',
  },
  {
    id: 'en-US-BrianMultilingualNeural',
    name: 'Brian Neural (Natural de Estúdio)',
    gender: 'male',
    provider: 'edge-neural',
    description: 'Tom moderno e natural com alta clareza executiva e dicção impecável.',
  },
  {
    id: 'en-US-AvaMultilingualNeural',
    name: 'Ava Neural (Calorosa & Sofisticada)',
    gender: 'female',
    provider: 'edge-neural',
    description: 'Tom caloroso, expressivo, suave e acolhedor para acompanhamento contínuo.',
  },
  {
    id: 'elevenlabs-custom',
    name: 'ElevenLabs AI (Hiper-realista)',
    gender: 'male',
    provider: 'elevenlabs',
    description: 'Motor ElevenLabs usando chave gratuita pessoal (10.000 caracteres/mês).',
  },
];

export interface VoiceSettings {
  provider: VoiceProvider;
  voiceId: string;
  rate: number; // 0.8 a 1.3
  pitch: number; // -5 a +5
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
}

const STORAGE_KEYS = {
  PROVIDER: 'copper_voice_provider',
  VOICE_ID: 'copper_voice_id',
  RATE: 'copper_voice_rate',
  PITCH: 'copper_voice_pitch',
  ELEVEN_KEY: 'copper_elevenlabs_key',
  ELEVEN_VOICE: 'copper_elevenlabs_voice',
};

class VoiceTtsService {
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private finishTimer: ReturnType<typeof setTimeout> | null = null;
  private isCurrentlySpeaking = false;
  private abortController: AbortController | null = null;
  private currentOnEnd: (() => void) | null = null;
  private listeners: Set<(speaking: boolean) => void> = new Set();
  private clientBlobCache: Map<string, Blob> = new Map();
  private edgeProxyAvailable = false;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array | null = null;

  /**
   * Registra um listener para mudanças no estado de reprodução
   */
  subscribe(listener: (speaking: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.isCurrentlySpeaking);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setSpeakingState(speaking: boolean) {
    this.isCurrentlySpeaking = speaking;
    this.listeners.forEach(cb => {
      try {
        cb(speaking);
      } catch {}
    });
  }

  /**
   * Obtém as configurações salvas de síntese de voz
   */
  getSettings(): VoiceSettings {
    if (typeof window === 'undefined') {
      return {
        provider: 'web-speech',
        voiceId: 'pt-BR-AntonioNeural',
        rate: 1.05,
        pitch: 0,
      };
    }

    try {
      const savedProvider = localStorage.getItem(STORAGE_KEYS.PROVIDER) as VoiceProvider | null;
      const provider: VoiceProvider =
        savedProvider === 'elevenlabs'
          ? 'elevenlabs'
          : savedProvider === 'edge-neural' && this.edgeProxyAvailable
          ? 'edge-neural'
          : 'web-speech';
      let voiceId = localStorage.getItem(STORAGE_KEYS.VOICE_ID) || 'pt-BR-AntonioNeural';
      if (VOICE_ALIAS_MAP[voiceId]) {
        voiceId = VOICE_ALIAS_MAP[voiceId];
      }
      const rate = parseFloat(localStorage.getItem(STORAGE_KEYS.RATE) || '1.05');
      const pitch = parseFloat(localStorage.getItem(STORAGE_KEYS.PITCH) || '0');
      const elevenLabsApiKey = localStorage.getItem(STORAGE_KEYS.ELEVEN_KEY) || '';
      const elevenLabsVoiceId = localStorage.getItem(STORAGE_KEYS.ELEVEN_VOICE) || 'pNInz6obpgDQGcFmaJgB';

      return {
        provider,
        voiceId,
        rate: isNaN(rate) ? 1.05 : rate,
        pitch: isNaN(pitch) ? 0 : pitch,
        elevenLabsApiKey,
        elevenLabsVoiceId,
      };
    } catch {
      return {
        provider: 'web-speech',
        voiceId: 'pt-BR-AntonioNeural',
        rate: 1.05,
        pitch: 0,
      };
    }
  }

  /**
   * Salva novas configurações de voz
   */
  saveSettings(settings: Partial<VoiceSettings>): void {
    if (typeof window === 'undefined') return;

    try {
      if (settings.provider) localStorage.setItem(STORAGE_KEYS.PROVIDER, settings.provider);
      if (settings.voiceId) {
        const canonical = VOICE_ALIAS_MAP[settings.voiceId] || settings.voiceId;
        localStorage.setItem(STORAGE_KEYS.VOICE_ID, canonical);
      }
      if (settings.rate !== undefined) localStorage.setItem(STORAGE_KEYS.RATE, String(settings.rate));
      if (settings.pitch !== undefined) localStorage.setItem(STORAGE_KEYS.PITCH, String(settings.pitch));
      if (settings.elevenLabsApiKey !== undefined) localStorage.setItem(STORAGE_KEYS.ELEVEN_KEY, settings.elevenLabsApiKey);
      if (settings.elevenLabsVoiceId !== undefined) localStorage.setItem(STORAGE_KEYS.ELEVEN_VOICE, settings.elevenLabsVoiceId);
      
      // Pré-aquece as saudações para a nova voz selecionada
      this.prewarmGreetings();
    } catch (e) {
      console.warn('Erro ao salvar configurações de voz:', e);
    }
  }

  /**
   * Pré-aquece a saudação do período atual no cache do cliente para execução imediata em 0ms
   */
  prewarmGreetings(): void {
    if (typeof window === 'undefined') return;
    const settings = this.getSettings();
    if (settings.provider !== 'edge-neural') return;

    // Seleciona a saudação correspondente ao período do dia atual
    const h = new Date().getHours();
    const currentGreeting =
      h < 5
        ? 'Boa noite, André! Pronto para operar. O que você precisa?'
        : h < 12
        ? 'Bom dia, André! Pronto para operar. O que você precisa?'
        : h < 18
        ? 'Boa tarde, André! Pronto para operar. O que você precisa?'
        : 'Boa noite, André! Pronto para operar. O que você precisa?';

    setTimeout(async () => {
      try {
        const targetVoice = VOICE_ALIAS_MAP[settings.voiceId] || settings.voiceId;
        const ratePercent = Math.round((settings.rate - 1.0) * 100);
        const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
        const pitchStr = settings.pitch >= 0 ? `+${settings.pitch}Hz` : `${settings.pitch}Hz`;
        const cacheKey = `${targetVoice}|${rateStr}|${pitchStr}|${currentGreeting}`;

        if (this.clientBlobCache.has(cacheKey)) return;

        const res = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: currentGreeting,
            voice: targetVoice,
            rate: rateStr,
            pitch: pitchStr,
          }),
        });

        if (res.ok) {
          const b = await res.blob();
          this.clientBlobCache.set(cacheKey, b);
        }
      } catch {
        // Silencioso se offline ou em caso de instabilidade
      }
    }, 2000);
  }

  /**
   * Fala um texto usando o motor ativo com fallback automático
   */
  async speak(text: string, onEnd?: () => void): Promise<void> {
    this.stop();

    const clean = text
      .replace(/[*_#`$]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!clean) {
      onEnd?.();
      return;
    }

    const settings = this.getSettings();
    this.setSpeakingState(true);

    // 1. Tenta ElevenLabs se configurado
    if (settings.provider === 'elevenlabs' && settings.elevenLabsApiKey) {
      try {
        const success = await this.speakWithElevenLabs(clean, settings, onEnd);
        if (success) return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.warn('[TTS] ElevenLabs falhou, usando Edge Neural como fallback:', e);
      }
    }

    // 2. Motor padrão: Microsoft Edge Neural TTS (100% Grátis)
    if (settings.provider === 'edge-neural' || settings.provider === 'elevenlabs') {
      try {
        const success = await this.speakWithEdgeNeural(clean, settings, onEnd);
        if (success) return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.warn('[TTS] Edge Neural falhou, usando Web Speech API local como fallback:', e);
      }
    }

    // 3. Fallback Resiliente: Web Speech API Local
    this.speakWithWebSpeech(clean, settings, onEnd);
  }

  /**
   * Síntese com Microsoft Edge Neural TTS via backend proxy
   */
  private async speakWithEdgeNeural(
    text: string,
    settings: VoiceSettings,
    onEnd?: () => void
  ): Promise<boolean> {
    const ratePercent = Math.round((settings.rate - 1.0) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
    const pitchStr = settings.pitch >= 0 ? `+${settings.pitch}Hz` : `${settings.pitch}Hz`;
    const targetVoice = VOICE_ALIAS_MAP[settings.voiceId] || settings.voiceId;
    const cacheKey = `${targetVoice}|${rateStr}|${pitchStr}|${text}`;

    // Cache no cliente: reprodução instantânea em 0ms
    if (this.clientBlobCache.has(cacheKey)) {
      const blob = this.clientBlobCache.get(cacheKey)!;
      return this.playAudioBlob(blob, onEnd);
    }

    this.abortController = new AbortController();

    const response = await fetch('/api/voice/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: targetVoice,
        rate: rateStr,
        pitch: pitchStr,
      }),
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Edge TTS HTTP error: ${response.status}`);
    }

    const blob = await response.blob();
    if (this.clientBlobCache.size > 200) {
      const first = this.clientBlobCache.keys().next().value;
      if (first) this.clientBlobCache.delete(first);
    }
    this.clientBlobCache.set(cacheKey, blob);
    return this.playAudioBlob(blob, onEnd);
  }

  /**
   * Síntese com ElevenLabs API (quando chave fornecida)
   */
  private async speakWithElevenLabs(
    text: string,
    settings: VoiceSettings,
    onEnd?: () => void
  ): Promise<boolean> {
    this.abortController = new AbortController();
    const voiceId = settings.elevenLabsVoiceId || 'pNInz6obpgDQGcFmaJgB'; // Adam

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': settings.elevenLabsApiKey || '',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs error: ${response.status}`);
    }

    const blob = await response.blob();
    return this.playAudioBlob(blob, onEnd);
  }

  /**
   * Toca um Blob de áudio MP3 no navegador com eventos de término
   */
  private playAudioBlob(blob: Blob, onEnd?: () => void): boolean {
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }

    const audioUrl = URL.createObjectURL(blob);
    this.currentAudioUrl = audioUrl;

    const audio = new Audio(audioUrl);
    this.currentAudio = audio;
    this.currentOnEnd = onEnd || null;

    try {
      if (typeof window !== 'undefined') {
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxClass) {
          if (!this.audioCtx) {
            this.audioCtx = new AudioCtxClass();
          }
          if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
          }
          const source = this.audioCtx.createMediaElementSource(audio);
          const analyser = this.audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.75;
          source.connect(analyser);
          analyser.connect(this.audioCtx.destination);
          this.analyser = analyser;
          this.freqData = new Uint8Array(analyser.frequencyBinCount);
        }
      }
    } catch {
      // Falha graciosa se Web Audio não puder ser associado
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.setSpeakingState(false);
      this.currentAudio = null;
      this.analyser = null;
      if (this.currentAudioUrl) {
        URL.revokeObjectURL(this.currentAudioUrl);
        this.currentAudioUrl = null;
      }
      const cb = this.currentOnEnd;
      this.currentOnEnd = null;
      cb?.();
    };

    audio.onended = finish;
    audio.onerror = finish;

    audio.play().catch(err => {
      console.warn('Erro ao tocar áudio neural:', err);
      finish();
    });

    return true;
  }

  /**
   * Fallback com Web Speech API nativa garantindo correspondência de voz, gênero e disparo confiável de onEnd
   */
  private speakWithWebSpeech(text: string, settings: VoiceSettings, onEnd?: () => void): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.setSpeakingState(false);
      onEnd?.();
      return;
    }

    try {
      if (this.finishTimer) {
        clearTimeout(this.finishTimer);
        this.finishTimer = null;
      }

      this.currentOnEnd = onEnd || null;

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (this.finishTimer) {
          clearTimeout(this.finishTimer);
          this.finishTimer = null;
        }
        this.currentUtterance = null;
        this.setSpeakingState(false);
        const cb = this.currentOnEnd;
        this.currentOnEnd = null;
        cb?.();
      };

      const startUtterance = () => {
        if (finished) return;
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          this.currentUtterance = utterance; // Evita coleta de lixo (GC bug do Chromium)
          utterance.lang = 'pt-BR';
          utterance.rate = settings.rate || 1.05;

          const isFemale = /francisca|thalita|elza|ava|emma|leticia|maria|female|mulher/i.test(settings.voiceId);
          utterance.pitch = isFemale
            ? Math.min(2.0, Math.max(0.8, 1.15 + (settings.pitch || 0) / 20))
            : Math.min(2.0, Math.max(0.5, 1.0 + (settings.pitch || 0) / 20));

          const allVoices = window.speechSynthesis.getVoices();
          const ptVoices = allVoices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('pt'));

          const targetNamePart = settings.voiceId
            .replace('pt-BR-', '')
            .replace('en-US-', '')
            .replace('Multilingual', '')
            .replace('Neural', '')
            .toLowerCase();

          let matchedVoice = ptVoices.find(v => v.name.toLowerCase().includes(targetNamePart));

          if (!matchedVoice) {
            if (isFemale) {
              matchedVoice = ptVoices.find(v =>
                /female|feminino|mulher|maria|francisca|thalita|elza|heloisa|luciana|vitoria|leticia|ava/i.test(v.name)
              );
            } else {
              matchedVoice = ptVoices.find(v =>
                /male|masculino|homem|antonio|daniel|fabio|donato|felipe|andrew|brian/i.test(v.name)
              );
            }
          }

          if (!matchedVoice) {
            matchedVoice = ptVoices.find(v => v.lang.includes('BR')) || ptVoices[0] || allVoices[0];
          }

          if (matchedVoice) {
            utterance.voice = matchedVoice;
          }

          utterance.onend = () => finish();
          utterance.onerror = () => finish();

          // Salvaguarda caso o navegador bloqueie ou não dispare onend
          const estimatedMs = Math.min(9000, Math.max(2200, text.split(/\s+/).length * 380));
          this.finishTimer = setTimeout(finish, estimatedMs);

          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utterance);
        } catch {
          finish();
        }
      };

      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
        setTimeout(startUtterance, 60);
      } else {
        startUtterance();
      }
    } catch {
      this.setSpeakingState(false);
      const cb = this.currentOnEnd;
      this.currentOnEnd = null;
      cb?.();
    }
  }

  /**
   * Toca uma amostra para uma voz específica selecionada
   */
  async playVoiceSample(voiceId: string, onEnd?: () => void): Promise<void> {
    const canonicalId = VOICE_ALIAS_MAP[voiceId] || voiceId;
    const current = this.getSettings();
    const tempSettings = { ...current, voiceId: canonicalId };
    const voiceMeta = PRESET_VOICES.find(v => v.id === canonicalId || v.id === voiceId);
    const rawName = voiceMeta ? voiceMeta.name.split('(')[0].trim() : 'Copper';
    const sampleText = `Olá André! Esta é a voz ${rawName}. O sistema CopperOS está pronto para comandos executivos.`;
    
    this.stop();
    this.setSpeakingState(true);
    
    if (tempSettings.provider === 'edge-neural' || tempSettings.provider === 'elevenlabs') {
      try {
        const success = await this.speakWithEdgeNeural(sampleText, tempSettings, onEnd);
        if (success) return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.warn('[TTS] Edge Neural falhou para amostra, usando Web Speech API:', e);
      }
    }
    
    this.speakWithWebSpeech(sampleText, tempSettings, onEnd);
  }

  /**
   * Toca uma frase de amostra para demonstrar a voz configurada
   */
  async playSample(sampleText?: string): Promise<void> {
    const phrase =
      sampleText ||
      'Olá André, o sistema CopperOS está operando normalmente com telemetria e controle de carga em tempo real.';
    await this.speak(phrase);
  }

  /**
   * Interrompe fala imediatamente
   */
  stop(): void {
    if (this.finishTimer) {
      clearTimeout(this.finishTimer);
      this.finishTimer = null;
    }
    this.currentUtterance = null;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }

    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    this.currentOnEnd = null;
    this.setSpeakingState(false);
  }

  /**
   * Retorna se está falando no momento
   */
  isSpeaking(): boolean {
    return this.isCurrentlySpeaking;
  }

  /**
   * Retorna o nível de amplitude/frequência vocal em tempo real (0 a 1)
   */
  getCurrentAudioLevel(): number {
    if (!this.isCurrentlySpeaking) return 0;
    if (this.analyser && this.freqData) {
      try {
        this.analyser.getByteFrequencyData(this.freqData);
        let sum = 0;
        for (let i = 0; i < this.freqData.length; i++) {
          sum += this.freqData[i];
        }
        const avg = sum / (this.freqData.length * 255);
        return Math.min(1, avg * 2.8);
      } catch {
        // fallback
      }
    }
    // Modulação procedural de fala humana natural (~4 a 7Hz)
    const t = performance.now() / 1000;
    const v = Math.sin(t * 14) * 0.35 + Math.sin(t * 22) * 0.25 + Math.sin(t * 6) * 0.4 + 0.5;
    return Math.max(0.15, Math.min(1, v));
  }

  /**
   * Retorna os dados espectrais brutos de frequência (bins FFT)
   */
  getFrequencyData(): Uint8Array | null {
    if (!this.isCurrentlySpeaking) return null;
    if (this.analyser && this.freqData) {
      try {
        this.analyser.getByteFrequencyData(this.freqData);
        return this.freqData;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Retorna os níveis espectrais decompostos em Graves (Bass), Médios (Mid) e Agudos (Treble)
   */
  getMultiBandLevels(): { bass: number; mid: number; treble: number; level: number } {
    const level = this.getCurrentAudioLevel();
    if (!this.isCurrentlySpeaking) {
      return { bass: 0, mid: 0, treble: 0, level: 0 };
    }

    if (this.analyser && this.freqData) {
      try {
        const binCount = this.freqData.length;
        const bThird = Math.floor(binCount / 3);
        let bSum = 0;
        let mSum = 0;
        let tSum = 0;
        for (let i = 0; i < bThird; i++) bSum += this.freqData[i];
        for (let i = bThird; i < bThird * 2; i++) mSum += this.freqData[i];
        for (let i = bThird * 2; i < binCount; i++) tSum += this.freqData[i];

        return {
          bass: Math.min(1, (bSum / (bThird * 255)) * 2.5),
          mid: Math.min(1, (mSum / (bThird * 255)) * 2.5),
          treble: Math.min(1, (tSum / (Math.max(1, binCount - bThird * 2) * 255)) * 2.5),
          level,
        };
      } catch {}
    }

    // Fallback procedural de frequências para simulação de fala rica
    const t = performance.now() / 1000;
    const bass = Math.max(0.1, Math.min(1, (Math.sin(t * 8) * 0.4 + Math.cos(t * 5) * 0.4 + 0.5) * level));
    const mid = Math.max(0.1, Math.min(1, (Math.sin(t * 15 + 1.2) * 0.45 + Math.cos(t * 9) * 0.35 + 0.5) * level));
    const treble = Math.max(0.1, Math.min(1, (Math.sin(t * 24 + 2.5) * 0.5 + 0.5) * level));

    return { bass, mid, treble, level };
  }
}

export const voiceTtsService = new VoiceTtsService();
