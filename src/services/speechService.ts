/**
 * Motor de Voz Contínuo do CopperOS (Web Speech API, pt-BR).
 *
 * Um único reconhecedor contínuo fica sempre ativo e alterna entre dois modos:
 *  - "wake":    aguarda a palavra de ativação ("Ei Copper", "Ok Copper", "Copper"...)
 *  - "command": captura o comando falado logo em seguida
 *
 * Usar um só reconhecedor evita o atraso de parar/reiniciar o microfone entre
 * a palavra de ativação e o comando — então "Ei Copper, abre os fornos" funciona
 * numa frase só. O reconhecedor é reiniciado automaticamente quando o navegador
 * encerra a sessão (silêncio, limite de tempo, troca de aba).
 *
 * Observação: no Chrome/Edge o reconhecimento é processado pelos servidores do
 * fornecedor do navegador — o áudio sai da máquina enquanto o microfone está ativo.
 */

export type VoiceMode = 'wake' | 'command';

export type VoiceErrorKind = 'unsupported' | 'permission' | 'other';

export interface VoiceHandlers {
  /** Palavra de ativação detectada (ou ativação manual). Pode receber comando dito na mesma frase. */
  onWake?: (immediateCommand?: string) => void;
  /** Texto parcial do comando enquanto o usuário fala. */
  onInterim?: (text: string) => void;
  /** Comando final pronto para ser processado. */
  onCommand?: (text: string) => void;
  /** Janela de comando expirou sem fala. */
  onTimeout?: () => void;
  /** Mudança no estado do microfone (rodando ou não). */
  onRunningChange?: (running: boolean) => void;
  onError?: (kind: VoiceErrorKind, message: string) => void;
}

/** Variações comuns de transcrição de "Copper" e saudações em pt-BR. */
const WAKE_WORD_REGEX =
  /(?:\b(?:ei|ey|hey|ok|okay|oi|ol[aá]|e\s+a[ií]|fala|al[oô]|ou)[\s,]+)?\b(copper|cooper|coper|kopper|koper|couper|capper|cupper|côper|kôper|copel)\b[\s,.!?]*/i;

export function containsWakeWord(text: string): boolean {
  return WAKE_WORD_REGEX.test(text);
}

/** Retorna o que foi dito depois da palavra de ativação (ou '' se nada). */
export function textAfterWakeWord(text: string): string {
  const match = WAKE_WORD_REGEX.exec(text);
  if (!match) return text.trim();
  return text.slice(match.index + match[0].length).trim();
}

const DEFAULT_COMMAND_WINDOW_MS = 14000;
const RESTART_DELAY_MS = 250;
const WAKE_DEBOUNCE_MS = 650;
const INTERIM_COMMIT_MS = 1500;

class VoiceEngine {
  private rec: any = null;
  private enabled = false;
  private mode: VoiceMode = 'wake';
  private suppressed = false;
  private handlers: VoiceHandlers = {};
  private commandTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private interimCommitTimer: ReturnType<typeof setTimeout> | null = null;
  private lastInterimText = '';
  private lastInterimIndex = -1;

  // Índices de resultados da sessão atual do reconhecedor
  private lastResultCount = 0;
  private ignoreBelowIndex = 0;
  private commandStartIndex = 0;
  private wakeResultIndex = -1;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.ensureRunning();
      });
    }
  }

  get isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  get isRunning(): boolean {
    return this.rec !== null;
  }

  get currentMode(): VoiceMode {
    return this.mode;
  }

  setHandlers(handlers: VoiceHandlers): void {
    this.handlers = handlers;
  }

  /** Solicita explicitamente permissão de microfone ao navegador */
  async requestPermission(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        return true;
      } catch (err) {
        console.warn('Microphone permission request failed:', err);
        return false;
      }
    }
    return true;
  }

  /** Liga o microfone contínuo (modo de espera pela palavra de ativação). */
  start(): boolean {
    if (!this.isSupported) {
      this.handlers.onError?.('unsupported', 'Reconhecimento de voz indisponível. Use Google Chrome ou Microsoft Edge.');
      return false;
    }
    this.enabled = true;
    this.ensureRunning();
    return true;
  }

  /** Desliga totalmente o microfone. */
  stop(): void {
    this.enabled = false;
    this.mode = 'wake';
    this.clearCommandTimer();
    this.clearWakeDebounceTimer();
    this.clearInterimCommitTimer();
    if (this.rec) {
      const rec = this.rec;
      this.rec = null;
      try { rec.abort(); } catch { /* noop */ }
      this.handlers.onRunningChange?.(false);
    }
  }

  /** Entra em modo de comando sem precisar da palavra de ativação (botão, Alt+V, follow-up). */
  activate(windowMs = DEFAULT_COMMAND_WINDOW_MS): boolean {
    if (!this.start()) return false;
    this.clearWakeDebounceTimer();
    this.clearInterimCommitTimer();
    this.mode = 'command';
    this.wakeResultIndex = -1;
    this.lastInterimText = '';
    this.lastInterimIndex = -1;
    this.commandStartIndex = this.lastResultCount;
    this.startCommandTimer(windowMs);
    this.ensureRunning();
    return true;
  }

  /** Volta ao modo de espera pela palavra de ativação. */
  standby(): void {
    this.mode = 'wake';
    this.clearCommandTimer();
    this.clearWakeDebounceTimer();
    this.clearInterimCommitTimer();
  }

  /** Ignora o áudio captado enquanto o assistente fala (evita ouvir a si mesmo). */
  setSuppressed(value: boolean): void {
    this.suppressed = value;
    this.clearWakeDebounceTimer();
    this.clearInterimCommitTimer();
    if (value) {
      // Quando o assistente está falando, pausa o reconhecedor para não captar o próprio TTS
      this.clearCommandTimer();
      if (this.rec) {
        const rec = this.rec;
        this.rec = null;
        try { rec.abort(); } catch { /* noop */ }
      }
    } else {
      // Reinicia uma sessão limpa de reconhecimento assim que o TTS termina
      this.lastResultCount = 0;
      this.ignoreBelowIndex = 0;
      this.commandStartIndex = 0;
      this.wakeResultIndex = -1;
      this.lastInterimText = '';
      this.lastInterimIndex = -1;
      if (this.enabled) {
        this.ensureRunning();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────

  private ensureRunning(): void {
    if (!this.enabled || this.suppressed || this.rec || !this.isSupported) return;

    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechAPI();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    // Nova sessão: os índices de resultados recomeçam do zero
    this.lastResultCount = 0;
    this.ignoreBelowIndex = 0;
    this.commandStartIndex = 0;
    this.wakeResultIndex = -1;
    this.lastInterimText = '';
    this.lastInterimIndex = -1;

    rec.onresult = (event: any) => this.handleResult(event);

    rec.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.enabled = false;
        this.handlers.onError?.('permission', 'Permissão de microfone negada. Libere o microfone para este site no navegador.');
      }
      // 'no-speech', 'aborted', 'network': o onend reinicia automaticamente
    };

    rec.onend = () => {
      if (this.rec === rec) this.rec = null;
      // Se havia texto parcial pendente no modo comando quando a sessão fechou, envia como comando
      if (this.mode === 'command' && !this.suppressed && this.lastInterimText.trim().length > 1) {
        const pending = this.lastInterimText.trim();
        this.lastInterimText = '';
        this.lastInterimIndex = -1;
        this.clearInterimCommitTimer();
        this.clearCommandTimer();
        this.mode = 'wake';
        this.handlers.onCommand?.(pending);
      }
      if (this.enabled && !this.suppressed) {
        setTimeout(() => this.ensureRunning(), RESTART_DELAY_MS);
      } else if (!this.enabled) {
        this.handlers.onRunningChange?.(false);
      }
    };

    try {
      rec.start();
      this.rec = rec;
      this.handlers.onRunningChange?.(true);
    } catch {
      // start() lança se já houver sessão ativa; tenta de novo em seguida
      setTimeout(() => this.ensureRunning(), RESTART_DELAY_MS * 4);
    }
  }

  private handleResult(event: any): void {
    this.lastResultCount = event.results.length;
    if (this.suppressed) return;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (i < this.ignoreBelowIndex) continue;

      const result = event.results[i];
      const transcript: string = result[0].transcript;
      const isFinal: boolean = result.isFinal;

      if (this.mode === 'wake') {
        if (!containsWakeWord(transcript)) continue;

        const immediate = textAfterWakeWord(transcript).trim();

        if (isFinal) {
          this.clearWakeDebounceTimer();
          this.ignoreBelowIndex = i + 1;
          this.wakeResultIndex = -1;
          if (immediate) {
            this.clearCommandTimer();
            this.mode = 'wake';
            this.handlers.onWake?.(immediate);
          } else {
            this.mode = 'command';
            this.commandStartIndex = i + 1;
            this.handlers.onWake?.('');
          }
          return;
        }

        // Resultado parcial contendo "Ei Copper": aguarda breve pausa para saber se há comando na mesma frase
        this.clearWakeDebounceTimer();
        this.wakeDebounceTimer = setTimeout(() => {
          this.wakeDebounceTimer = null;
          if (this.mode !== 'wake' || this.suppressed) return;
          this.ignoreBelowIndex = i + 1;
          this.wakeResultIndex = -1;
          if (immediate) {
            this.clearCommandTimer();
            this.mode = 'wake';
            this.handlers.onWake?.(immediate);
          } else {
            this.mode = 'command';
            this.commandStartIndex = i + 1;
            this.handlers.onWake?.('');
          }
        }, WAKE_DEBOUNCE_MS);
        continue;
      }

      if (this.mode === 'command') {
        if (i < this.commandStartIndex) continue;

        const text = (i === this.wakeResultIndex ? textAfterWakeWord(transcript) : transcript).trim();
        if (!text) continue;

        if (isFinal) {
          this.clearInterimCommitTimer();
          this.clearCommandTimer();
          this.lastInterimText = '';
          this.lastInterimIndex = -1;
          this.mode = 'wake';
          this.ignoreBelowIndex = i + 1;
          this.wakeResultIndex = -1;
          this.handlers.onCommand?.(text);
          return;
        }

        this.lastInterimText = text;
        this.lastInterimIndex = i;
        this.startCommandTimer(DEFAULT_COMMAND_WINDOW_MS); // usuário ainda falando
        this.handlers.onInterim?.(text);

        // No modo contínuo, o navegador pode demorar para marcar isFinal=true;
        // se o usuário ficar em silêncio por 1.5s após falar, despacha o comando automaticamente.
        this.clearInterimCommitTimer();
        this.interimCommitTimer = setTimeout(() => {
          this.interimCommitTimer = null;
          if (this.mode === 'command' && !this.suppressed && this.lastInterimText.trim().length > 1) {
            const committed = this.lastInterimText.trim();
            const committedIdx = this.lastInterimIndex;
            this.lastInterimText = '';
            this.lastInterimIndex = -1;
            this.clearCommandTimer();
            this.mode = 'wake';
            this.ignoreBelowIndex = Math.max(this.ignoreBelowIndex, committedIdx + 1);
            this.wakeResultIndex = -1;
            this.handlers.onCommand?.(committed);
          }
        }, INTERIM_COMMIT_MS);
      }
    }
  }

  private startCommandTimer(ms: number): void {
    this.clearCommandTimer();
    this.commandTimer = setTimeout(() => {
      this.commandTimer = null;
      if (this.mode === 'command') {
        this.mode = 'wake';
        this.handlers.onTimeout?.();
      }
    }, ms);
  }

  private clearCommandTimer(): void {
    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }
  }

  private clearWakeDebounceTimer(): void {
    if (this.wakeDebounceTimer) {
      clearTimeout(this.wakeDebounceTimer);
      this.wakeDebounceTimer = null;
    }
  }

  private clearInterimCommitTimer(): void {
    if (this.interimCommitTimer) {
      clearTimeout(this.interimCommitTimer);
      this.interimCommitTimer = null;
    }
  }
}

export const voiceEngine = new VoiceEngine();
