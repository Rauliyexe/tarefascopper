import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  KeyRound,
  ShieldCheck,
  Sun,
  Moon,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  FlaskConical,
  Scale,
  Users,
} from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import { soundEngine } from '../../services/soundEngine';
import { authApi } from '../../services/authApi';
import { User } from '../../types';

/**
 * Canvas interativo da constelação metalúrgica / rede neural esmeralda
 * (lado esquerdo da tela de autenticação CopperOS).
 */
const ConstellationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth || 800);
    let height = (canvas.height = canvas.offsetHeight || 900);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || 800;
      height = canvas.height = canvas.offsetHeight || 900;
    };

    window.addEventListener('resize', handleResize);

    interface NodePoint {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
    }

    const NODE_COUNT = 58;
    const MAX_DIST = 145;
    const nodes: NodePoint[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      radius: 1.5 + Math.random() * 2,
      alpha: 0.35 + Math.random() * 0.55,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Fundo radial sutil esmeralda escuro
      const grad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.48,
        20,
        width * 0.5,
        height * 0.48,
        Math.max(width, height) * 0.65
      );
      grad.addColorStop(0, 'rgba(6, 48, 34, 0.42)');
      grad.addColorStop(0.6, 'rgba(3, 18, 13, 0.88)');
      grad.addColorStop(1, 'rgba(2, 8, 6, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Atualiza posições
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }

      // Desenha conexões entre nós próximos
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const opacity = (1 - dist / MAX_DIST) * 0.28;
            ctx.strokeStyle = `rgba(16, 185, 129, ${opacity.toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Desenha os pontos luminosos
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52, 211, 153, ${n.alpha})`;
        ctx.fill();

        // Halo nos pontos maiores
        if (n.radius > 2.4) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * 2.6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

export const LoginScreen: React.FC = () => {
  const [, setSearchParams] = useSearchParams();
  const {
    availableUsers,
    switchUser,
    loginSession,
    setIsCompanySelectorOpen,
    isDarkMode,
    toggleTheme,
    bootstrapError,
  } = useCopperOS();

  const [selectedUserId, setSelectedUserId] = useState<string>(availableUsers[0]?.id || 'usr-ceo');
  const [email, setEmail] = useState<string>(availableUsers[0]?.email || 'ceo@coppergroup.com.br');
  const [password, setPassword] = useState<string>('copperos2026');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    if (availableUsers.length > 0 && (!selectedUserId || !availableUsers.some(u => u.id === selectedUserId))) {
      setSelectedUserId(availableUsers[0].id);
      setEmail(availableUsers[0].email);
    }
  }, [availableUsers, selectedUserId]);

  const handleSelectQuickUser = (u: User) => {
    soundEngine.playSwitch();
    setSelectedUserId(u.id);
    setEmail(u.email);
    setPassword('copperos2026');
    setErrorNotice(null);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorNotice('Informe seu e-mail corporativo para acessar a plataforma.');
      return;
    }

    setIsLoading(true);
    setErrorNotice(null);
    soundEngine.playClick();

    try {
      const matchedUser =
        availableUsers.find(u => u.email.toLowerCase() === cleanEmail) ||
        availableUsers.find(u => u.id === selectedUserId) ||
        availableUsers[0];

      const authRes = await authApi.login({
        email: cleanEmail,
        userId: matchedUser?.id,
        password,
      });

      soundEngine.playSuccess();
      const targetUser = authRes.user || matchedUser;
      if (authRes.user) {
        switchUser(authRes.user.id);
        loginSession(authRes.token, authRes.user);
      } else if (matchedUser) {
        switchUser(matchedUser.id);
        loginSession(authRes.token, matchedUser);
      }

      const defaultTab =
        targetUser?.role === 'CEO' || targetUser?.role === 'MANAGER'
          ? 'Briefing 5 Min'
          : 'Minhas tarefas';
      setSearchParams({ tab: defaultTab });
      setIsCompanySelectorOpen(true);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Não foi possível validar suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return { label: 'Administrador (TI)', icon: ShieldCheck, color: 'text-purple-500' };
      case 'CEO':
        return { label: 'Diretoria / CEO', icon: Briefcase, color: 'text-amber-500' };
      case 'MANAGER':
        return { label: 'Gestor', icon: FlaskConical, color: 'text-emerald-500' };
      default:
        return { label: 'Operador', icon: Scale, color: 'text-blue-500' };
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-white dark:bg-night-950 font-sans select-none">
      {/* ── LADO ESQUERDO: CONSTELAÇÃO METALÚRGICA & IDENTIDADE COPPEROS ── */}
      <div className="relative hidden lg:flex flex-col items-center justify-center overflow-hidden bg-[#030b08] p-12">
        <ConstellationCanvas />

        {/* Brilho central atrás do ícone */}
        <div className="absolute w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-md">
          {/* Ícone Oficial CopperOS com ponto luminoso */}
          <div className="relative w-16 h-16 rounded-2xl bg-[#071a12]/90 border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.28)] flex items-center justify-center">
            <div className="w-5 h-5 rounded-[5px] border-2 border-emerald-400/90" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399] ring-4 ring-[#030b08]" />
          </div>

          <h1 className="mt-6 text-3xl font-extrabold text-white tracking-tight">
            CopperOS
          </h1>

          <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400">
            SISTEMA OPERACIONAL DA EMPRESA
          </p>

          <p className="mt-4 text-xs sm:text-[13px] text-gray-300/80 leading-relaxed max-w-sm font-normal">
            Gestão integrada de operações industriais, rastreabilidade metalúrgica e controle corporativo unificado.
          </p>
        </div>
      </div>

      {/* ── LADO DIREITO: AUTENTICAÇÃO CORPORATIVA ── */}
      <div className="flex flex-col justify-between min-h-screen bg-white dark:bg-night-950 text-gray-900 dark:text-gray-100 p-6 sm:p-10 transition-colors duration-200">
        {/* Barra Superior Direita (Tema e Logo Mobile) */}
        <div className="flex items-center justify-between lg:justify-end">
          <div className="flex lg:hidden items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-xl bg-[#071a12] border border-emerald-500/30 flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-[3px] border-2 border-emerald-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <span className="font-extrabold text-sm text-gray-900 dark:text-white">CopperOS</span>
          </div>

          <button
            type="button"
            onClick={() => {
              toggleTheme();
              soundEngine.playClick();
            }}
            className="w-9 h-9 rounded-full border border-gray-200 dark:border-night-800 bg-gray-50/60 dark:bg-night-900 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-emerald-500 hover:text-emerald-600 transition-colors cursor-pointer"
            title={isDarkMode ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Bloco Central de Login */}
        <div className="w-full max-w-[390px] mx-auto my-auto py-8 space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Autenticação Corporativa
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Informe seu e-mail corporativo e senha de acesso
            </p>
          </div>

          {(errorNotice || bootstrapError) && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorNotice || bootstrapError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Campo E-mail Corporativo */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                E-mail Corporativo
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="admin@copperos.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#f8fafc] dark:bg-night-900 border border-gray-200 dark:border-night-800 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-night-900 transition-all"
              />
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300">
                <KeyRound className="w-3 h-3 text-gray-400" />
                <span>Senha</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-[#f8fafc] dark:bg-night-900 border border-gray-200 dark:border-night-800 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-night-900 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão Acessar Plataforma */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#10b981] hover:bg-[#059669] active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isLoading ? 'Autenticando...' : 'Acessar Plataforma'}</span>
            </button>
          </form>

          {/* Seletor Rápido de Credenciais para Testes Piloto */}
          <div className="pt-4 border-t border-gray-100 dark:border-night-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Users className="w-3 h-3 text-emerald-500" />
                <span>Acesso Rápido — Perfis do Piloto</span>
              </span>
              <span className="text-[10px] text-gray-400">1 clique para preencher</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {availableUsers.map(u => {
                const isSelected = email.toLowerCase() === u.email.toLowerCase();
                const badge = getRoleBadge(u.role);
                const BadgeIcon = badge.icon;

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectQuickUser(u)}
                    className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${isSelected
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500/50 shadow-2xs'
                      : 'bg-gray-50/60 dark:bg-night-900/60 border-gray-200/70 dark:border-night-800 hover:border-emerald-500/30'
                      }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">
                        {u.name}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
                        <BadgeIcon className={`w-2.5 h-2.5 shrink-0 ${badge.color}`} />
                        <span className="truncate">{badge.label}</span>
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <footer className="text-center text-[11px] text-gray-400 dark:text-gray-500">
          © 2026 TI Copper Group. Uso interno autorizado.
        </footer>
      </div>
    </div>
  );
};
