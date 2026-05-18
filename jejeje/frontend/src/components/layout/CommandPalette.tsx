import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Building2,
  LayoutDashboard,
  Radar,
  Search,
  Settings,
  Sparkles,
  Target,
  User,
  Users,
  Workflow,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import type { AppRole } from '../../store/authStore';

export type CommandPaletteOpenContext = {
  openPalette: () => void;
};

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Target;
  to: string;
  roles?: AppRole[];
};

const ALL_COMMANDS: Cmd[] = [
  {
    id: 'leads',
    label: 'Leads',
    hint: 'Pipeline comercial',
    icon: Target,
    to: '/leads',
    roles: ['COMPANY_ADMIN', 'COMPANY_USER'],
  },
  {
    id: 'motor',
    label: 'Motor de recomendación',
    hint: 'Matches y explicabilidad',
    icon: Radar,
    to: '/app/motor',
    roles: ['COMPANY_ADMIN', 'COMPANY_USER'],
  },
  { id: 'home', label: 'Inicio operativo', hint: 'Bandeja del vendedor', icon: LayoutDashboard, to: '/app/home', roles: ['COMPANY_USER'] },
  {
    id: 'dash',
    label: 'Panel empresa',
    hint: 'Resumen administrativo',
    icon: Building2,
    to: '/app/dashboard',
    roles: ['COMPANY_ADMIN'],
  },
  { id: 'travel', label: 'Catálogo viajes', hint: 'PDF e ingesta', icon: Workflow, to: '/app/travel', roles: ['COMPANY_ADMIN'] },
  {
    id: 'travel-super',
    label: 'Catálogo (PDF)',
    hint: 'Superadmin',
    icon: Workflow,
    to: '/superadmin/travel',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'ia',
    label: 'IA & observabilidad',
    hint: 'Costes, salud, presupuesto',
    icon: Activity,
    to: '/app/ia',
    roles: ['COMPANY_ADMIN'],
  },
  {
    id: 'users',
    label: 'Usuarios',
    hint: 'Equipo',
    icon: Users,
    to: '/app/users',
    roles: ['COMPANY_ADMIN', 'COMPANY_USER'],
  },
  { id: 'profile', label: 'Perfil y cuenta', hint: 'Ajustes personales', icon: User, to: '/profile' },
  { id: 'super-dash', label: 'Superadmin · dashboard', icon: Sparkles, to: '/superadmin/dashboard', roles: ['SUPER_ADMIN'] },
  { id: 'super-tenants', label: 'Superadmin · empresas', icon: Building2, to: '/superadmin/tenants', roles: ['SUPER_ADMIN'] },
];

export function CommandPalette({ role }: { role: AppRole | undefined }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const cmds = useMemo(() => {
    const r = role ?? 'COMPANY_USER';
    return ALL_COMMANDS.filter((c) => !c.roles || c.roles.includes(r));
  }, [role]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return cmds;
    return cmds.filter(
      (c) =>
        c.label.toLowerCase().includes(t) ||
        (c.hint && c.hint.toLowerCase().includes(t)) ||
        c.id.includes(t),
    );
  }, [cmds, q]);

  const openPalette = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setIdx(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    (window as unknown as { __openCommandPalette?: () => void }).__openCommandPalette = openPalette;
    return () => {
      delete (window as unknown as { __openCommandPalette?: () => void }).__openCommandPalette;
    };
  }, [openPalette]);

  const run = (c: Cmd) => {
    navigate(c.to);
    setOpen(false);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[min(18vh,8rem)] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/75 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Paleta de comandos"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={cn(
              'relative w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl',
              'border-white/[0.08] bg-zinc-900/95 text-zinc-100 shadow-black/50',
            )}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIdx((i) => Math.min(filtered.length - 1, i + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              }
              if (e.key === 'Enter' && filtered[idx]) {
                e.preventDefault();
                run(filtered[idx]);
              }
            }}
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIdx(0);
                }}
                placeholder="Buscar o navegar…"
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              <kbd className="hidden shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline">
                Esc
              </kbd>
            </div>
            <div className="max-h-[min(50vh,22rem)] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-zinc-500">Sin coincidencias.</p>
              )}
              {filtered.map((c, i) => {
                const Icon = c.icon;
                const active = i === idx;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => run(c)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      active ? 'bg-cyan-500/12 text-zinc-50' : 'text-zinc-400 hover:bg-white/[0.04]',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-cyan-300' : 'text-zinc-500')} strokeWidth={1.75} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-zinc-100">{c.label}</span>
                      {c.hint ? <span className="block text-xs text-zinc-500">{c.hint}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 text-[11px] text-zinc-600">
              <span className="flex items-center gap-1">
                <Settings className="h-3 w-3 opacity-60" />
                Navegación rápida
              </span>
              <span>
                <kbd className="rounded border border-white/10 px-1 font-mono">↵</kbd> abrir
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
