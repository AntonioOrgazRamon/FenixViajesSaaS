import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles, Workflow, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore, type AuthUser } from '../../../store/authStore';
import { writeStoredThemePreference } from '../../../lib/theme';
import { api } from '../../../lib/axios';
import { getApiErrorMessage } from '../../../lib/errors';

const loginSchema = z.object({
  email: z.string().email('Introduce un correo válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

type LoginPayload = {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  };
};

const fontSans = '"Plus Jakarta Sans", system-ui, sans-serif';
const fontDisplay = '"Syne", system-ui, sans-serif';
const fontMono = '"JetBrains Mono", ui-monospace, monospace';

const NAKEDCODE_URL = 'https://nakedcode.es';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

function NakedCodeBrandLink({
  variant = 'inline',
  className,
}: {
  variant?: 'inline' | 'footer';
  className?: string;
}) {
  return (
    <a
      href={NAKEDCODE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'group/nc relative inline cursor-pointer rounded-sm outline-none transition-[color,letter-spacing,filter] duration-300 ease-out',
        'hover:tracking-[0.04em] focus-visible:ring-2 focus-visible:ring-amber-400/55 focus-visible:ring-offset-2',
        variant === 'inline' &&
          'font-semibold text-zinc-200 hover:text-amber-50 hover:drop-shadow-[0_0_18px_rgba(251,191,36,0.28)] focus-visible:ring-offset-[#09090b]',
        variant === 'footer' &&
          'font-semibold text-zinc-500 hover:text-amber-200/95 hover:drop-shadow-[0_0_14px_rgba(251,191,36,0.22)] focus-visible:ring-offset-[#09090b]',
        className,
      )}
      style={{ fontFamily: fontDisplay }}
      aria-label="NakedCode — sitio web (abre en una pestaña nueva)"
    >
      <span className="relative z-10">NakedCode</span>
      <span
        className="pointer-events-none absolute -bottom-0.5 left-0 h-[2px] w-full origin-left scale-x-0 rounded-full bg-gradient-to-r from-amber-400/20 via-amber-400 to-amber-500/30 transition-transform duration-300 ease-out group-hover/nc:scale-x-100"
        aria-hidden
      />
    </a>
  );
}

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const orbARef = useRef<HTMLDivElement>(null);
  const orbBRef = useRef<HTMLDivElement>(null);
  const orbCRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const accentLineRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    const msg = (location.state as { message?: string } | null)?.message;
    if (msg) {
      setFlash(msg);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    const root = rootRef.current;
    const left = leftRef.current;
    const card = cardRef.current;
    const logo = logoRef.current;
    const accentLine = accentLineRef.current;
    const orbs = [orbARef.current, orbBRef.current, orbCRef.current].filter(Boolean) as HTMLElement[];
    const grid = gridRef.current;
    const grain = grainRef.current;

    if (!root || !card) return;

    const reveal = gsap.utils.toArray<HTMLElement>(root.querySelectorAll('[data-login-reveal]'));

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        const surfaces = [left, card, grid, grain, accentLine, logo, ...orbs, ...reveal].filter(Boolean);
        gsap.set(surfaces, { clearProps: 'all' });
        gsap.set(card, { opacity: 1, y: 0 });
        gsap.set(reveal, { opacity: 1, y: 0 });
        if (logo) gsap.set(logo, { opacity: 1, scale: 1, rotate: 0 });
        gsap.set(orbs, { opacity: 0.4, scale: 1 });
        if (grid) gsap.set(grid, { opacity: 0.1 });
        if (grain) gsap.set(grain, { opacity: 0.04 });
        if (accentLine) gsap.set(accentLine, { scaleX: 1, opacity: 1 });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.set(card, { opacity: 0, y: 32, rotateX: 2 });
        gsap.set(reveal, { opacity: 0, y: 20 });
        gsap.set(orbs, { opacity: 0, scale: 0.75 });
        if (grid) gsap.set(grid, { opacity: 0 });
        if (grain) gsap.set(grain, { opacity: 0 });
        if (accentLine) gsap.set(accentLine, { scaleX: 0, transformOrigin: 'left center' });
        if (logo) gsap.set(logo, { opacity: 0, scale: 0.92, rotate: -4 });

        const intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
        intro.to(orbs, { opacity: 0.5, scale: 1, duration: 1.15, stagger: { each: 0.11, from: 'random' } }, 0);
        if (grid) intro.to(grid, { opacity: 0.11, duration: 1 }, 0.12);
        if (grain) intro.to(grain, { opacity: 0.055, duration: 1.2 }, 0.1);
        if (logo) intro.to(logo, { opacity: 1, scale: 1, rotate: 0, duration: 0.65, ease: 'back.out(1.4)' }, 0.18);
        intro.to(card, { opacity: 1, y: 0, rotateX: 0, duration: 0.85 }, 0.22);
        if (accentLine) intro.to(accentLine, { scaleX: 1, opacity: 1, duration: 0.9, ease: 'power2.inOut' }, 0.35);
        intro.to(reveal, { opacity: 1, y: 0, duration: 0.5, stagger: 0.065, ease: 'power3.out' }, 0.38);

        orbs.forEach((orb, i) => {
          gsap.to(orb, {
            y: i % 2 === 0 ? '+=26' : '-=20',
            x: i === 1 ? '+=18' : '-=12',
            duration: 6.2 + i * 0.7,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });
        });

        gsap.to(left, {
          backgroundPosition: '100% 40%',
          duration: 22,
          ease: 'none',
          repeat: -1,
          yoyo: true,
        });
      });

      return () => mm.revert();
    }, root);

    return () => ctx.revert();
  }, []);

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null);
      const { data: body } = await api.post<LoginPayload>('/auth/login', {
        email: data.email,
        password: data.password,
        deviceName: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });

      const payload = body.data;
      setAuth(payload.user, payload.accessToken, payload.refreshToken);
      if (payload.user.theme) writeStoredThemePreference(payload.user.theme);

      if (payload.user.role === 'SUPER_ADMIN') {
        navigate('/superadmin/dashboard');
      } else if (payload.user.role === 'COMPANY_ADMIN') {
        navigate('/app/dashboard');
      } else {
        navigate('/app/home');
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const loginWithGoogle = () => {
    window.location.assign(`${API_BASE_URL}/auth/google/start`);
  };

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen w-full overflow-x-hidden bg-[#09090b] text-zinc-100 antialiased selection:bg-amber-400/30 selection:text-white"
      style={{ fontFamily: fontSans }}
    >
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Brand panel */}
        <div
          ref={leftRef}
          className="relative flex min-h-[44vh] flex-1 flex-col justify-between overflow-hidden px-7 py-9 sm:px-10 lg:min-h-screen lg:min-w-0 lg:flex-1 lg:px-12 lg:py-12"
          style={{
            background: 'linear-gradient(165deg, #0c0c0e 0%, #111113 42%, #18181b 100%)',
            backgroundSize: '180% 180%',
          }}
        >
          <div
            ref={grainRef}
            className="pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
            aria-hidden
          />

          <div
            ref={gridRef}
            className="pointer-events-none absolute inset-0 opacity-[0.11]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 100%)',
            }}
            aria-hidden
          />

          <div
            ref={orbARef}
            className="pointer-events-none absolute -left-20 top-[18%] h-[min(22rem,50vw)] w-[min(22rem,50vw)] rounded-full bg-amber-500/[0.12] blur-[100px]"
            aria-hidden
          />
          <div
            ref={orbBRef}
            className="pointer-events-none absolute -right-16 top-[6%] h-72 w-72 rounded-full bg-zinc-400/[0.07] blur-[90px]"
            aria-hidden
          />
          <div
            ref={orbCRef}
            className="pointer-events-none absolute bottom-[-12%] left-[20%] h-64 w-80 rounded-full bg-amber-600/[0.08] blur-[85px]"
            aria-hidden
          />

          {/* Corner brackets */}
          <div className="pointer-events-none absolute left-6 top-6 h-10 w-10 border-l border-t border-white/[0.08]" aria-hidden />
          <div className="pointer-events-none absolute bottom-6 right-6 h-10 w-10 border-b border-r border-white/[0.08]" aria-hidden />

          <header className="relative z-10 flex items-start justify-between gap-4">
            <div data-login-reveal className="flex items-center gap-4">
              <div
                ref={logoRef}
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.1] bg-gradient-to-br from-zinc-800/80 to-zinc-950/90 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_20px_50px_-12px_rgba(0,0,0,0.65)]"
              >
                <span
                  className="text-[0.65rem] font-bold leading-none tracking-tight text-amber-300/95"
                  style={{ fontFamily: fontMono }}
                  aria-hidden
                >
                  {'</>'}
                </span>
                <span className="sr-only">NakedCode</span>
              </div>
              <div>
                <p
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-zinc-500"
                  style={{ fontFamily: fontMono }}
                >
                  Software por
                </p>
                <p className="mt-0.5 text-2xl font-extrabold tracking-[-0.02em] text-white" style={{ fontFamily: fontDisplay }}>
                  NakedCode
                </p>
              </div>
            </div>
            <div
              data-login-reveal
              className="hidden rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-zinc-500 sm:block"
              style={{ fontFamily: fontMono }}
            >
              v1 · MVP
            </div>
          </header>

          <div className="relative z-10 my-10 w-full space-y-7 lg:my-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-3 py-1 text-xs font-medium text-amber-200/90">
              <Zap className="h-3.5 w-3.5 text-amber-400/90" strokeWidth={2} aria-hidden />
              Automatización de procesos con IA
            </div>
            <h1
              data-login-reveal
              className="text-balance text-[1.65rem] font-bold leading-[1.15] tracking-[-0.03em] text-white sm:text-4xl lg:text-[2.5rem]"
              style={{ fontFamily: fontDisplay }}
            >
              Acceso al panel. La IA acelera el trabajo; tú marcas las reglas.
            </h1>
            <p data-login-reveal className="w-full text-pretty text-[0.95rem] leading-relaxed text-zinc-400">
              Software para <span className="text-zinc-300">automatizar procesos con inteligencia artificial</span>: flujos
              inteligentes, multiempresa, roles y auditoría cuando haga falta. Diseñado y construido por{' '}
              <NakedCodeBrandLink variant="inline" /> para equipos que quieren claridad sobre qué hace la IA y cómo.
            </p>
            <div data-login-reveal className="flex flex-wrap gap-2">
              {[
                { icon: Sparkles, label: 'IA aplicada a procesos reales' },
                { icon: Workflow, label: 'Orquestación y trazabilidad' },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-400"
                >
                  <Icon className="h-3.5 w-3.5 text-amber-400/80" strokeWidth={2} aria-hidden />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <footer data-login-reveal className="relative z-10 flex flex-col gap-1 border-t border-white/[0.06] pt-6 text-xs text-zinc-600 lg:border-0 lg:pt-0">
            <span>
              © {new Date().getFullYear()} <NakedCodeBrandLink variant="footer" />
              {'. Todos los derechos reservados.'}
            </span>
            <span className="text-zinc-600" style={{ fontFamily: fontMono }}>
              nakedcode · engineering & product
            </span>
          </footer>
        </div>

        {/* Form */}
        <div className="relative flex min-w-0 flex-1 flex-col items-stretch justify-center px-4 py-12 sm:px-8 lg:px-16 lg:py-16">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.07),transparent)]"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-gradient-to-b from-transparent via-white/[0.07] to-transparent lg:block" aria-hidden />

          <div ref={cardRef} className="relative z-10 w-full perspective-[1200px]">
            <div
              ref={accentLineRef}
              className="absolute -top-px left-8 right-8 h-px rounded-full bg-gradient-to-r from-transparent via-amber-400/50 to-transparent opacity-90"
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.07] bg-zinc-900/40 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_32px_64px_-16px_rgba(0,0,0,0.75)] backdrop-blur-2xl sm:p-10">
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-amber-500/[0.06] blur-3xl"
                aria-hidden
              />

              <div data-login-reveal className="relative mb-9 space-y-3">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-zinc-500" style={{ fontFamily: fontMono }}>
                  Autenticación
                </p>
                <h2
                  className="text-[1.65rem] font-bold tracking-[-0.03em] text-white sm:text-3xl"
                  style={{ fontFamily: fontDisplay }}
                >
                  Iniciar sesión
                </h2>
                <p className="text-sm leading-relaxed text-zinc-500">
                  Entra a tus automatizaciones y flujos con IA. Si no tienes acceso, pide credenciales a tu administrador
                  o a soporte de tu empresa.
                </p>
              </div>

              <form className="relative space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
                <div data-login-reveal className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-zinc-400">
                    Correo electrónico
                  </label>
                  <div className="group relative">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-600 transition-colors duration-200 group-focus-within:text-amber-400/90"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      {...register('email')}
                      className="w-full rounded-xl border border-white/[0.08] bg-black/40 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-zinc-600 focus:border-amber-500/35 focus:bg-black/55 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.12)]"
                      placeholder="nombre@empresa.com"
                    />
                  </div>
                  {errors.email && <p className="text-sm text-red-400/90">{errors.email.message}</p>}
                </div>

                <div data-login-reveal className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-zinc-400">
                    Contraseña
                  </label>
                  <div className="group relative">
                    <Lock
                      className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-600 transition-colors duration-200 group-focus-within:text-amber-400/90"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      {...register('password')}
                      className="w-full rounded-xl border border-white/[0.08] bg-black/40 py-3.5 pl-12 pr-12 text-sm text-white outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-zinc-600 focus:border-amber-500/35 focus:bg-black/55 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.12)]"
                      placeholder="Tu contraseña"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400/50"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-red-400/90">{errors.password.message}</p>}
                </div>

                {flash && (
                  <div
                    data-login-reveal
                    role="status"
                    className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.12] px-4 py-3 text-center text-sm text-emerald-100/95"
                  >
                    {flash}
                  </div>
                )}

                {error && (
                  <div
                    data-login-reveal
                    role="alert"
                    className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-center text-sm text-red-200/95"
                  >
                    {error}
                  </div>
                )}

                <div data-login-reveal className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="cursor-pointer text-sm font-medium text-amber-400/90 underline-offset-4 transition-colors duration-200 hover:text-amber-300 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400/60"
                  >
                    ¿Has olvidado tu contraseña?
                  </Link>
                </div>

                <div data-login-reveal>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-b from-amber-400 to-amber-600 py-3.5 text-sm font-bold text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_12px_40px_-8px_rgba(245,158,11,0.45)] transition-[transform,filter,box-shadow] duration-200 hover:brightness-[1.03] hover:shadow-[0_1px_0_rgba(255,255,255,0.28)_inset,0_16px_48px_-8px_rgba(245,158,11,0.5)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Entrando…' : 'Entrar al panel'}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                  </button>
                </div>

                <div data-login-reveal>
                  <button
                    type="button"
                    onClick={loginWithGoogle}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] py-3.5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.06]"
                  >
                    Continuar con Google
                  </button>
                </div>

                <p
                  data-login-reveal
                  className="pt-1 text-center text-[0.7rem] leading-relaxed text-zinc-600"
                  style={{ fontFamily: fontMono }}
                >
                  Producto desarrollado por <span className="text-zinc-500">NakedCode</span>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
