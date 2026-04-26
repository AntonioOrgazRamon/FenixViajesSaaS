import type { Dispatch, SetStateAction } from 'react';
import { AppWindow, Check, Circle, Info, LayoutGrid, Paintbrush, Type } from 'lucide-react';
import { UserAvatarView } from '../../../lib/userAvatarView';
import { cn } from '../../../lib/cn';
import type { AuthUser, UserAvatar } from '../../../store/authStore';
import { PRESET_BACKGROUNDS, SUGGESTED_COMBOS, TEXT_PRESETS, type DefaultDraft } from '../defaultAvatarUtils';

const field =
  'w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] outline-none transition focus:border-amber-400/50 focus:ring-2 focus:ring-amber-500/20 dark:border-white/12 dark:bg-black/25 dark:text-zinc-100';

const label = 'text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500';

const SHAPE_OPTIONS: { value: DefaultDraft['shape']; title: string; Icon: typeof Circle }[] = [
  { value: 'circle', title: 'Círculo', Icon: Circle },
  { value: 'rounded', title: 'Redondeado', Icon: AppWindow },
  { value: 'square', title: 'Cuadrado', Icon: LayoutGrid },
];

type Props = {
  user: AuthUser;
  draft: DefaultDraft;
  setDraft: Dispatch<SetStateAction<DefaultDraft>>;
  preview: UserAvatar;
  onSave: () => void;
  isPending: boolean;
  errorMessage: string | null;
  successMessage: string | null;
};

export function DefaultAvatarEditor({
  user,
  draft,
  setDraft,
  preview,
  onSave,
  isPending,
  errorMessage,
  successMessage,
}: Props) {
  const update = (p: Partial<DefaultDraft>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-50/40 dark:border-white/[0.08] dark:bg-zinc-900/30',
        'shadow-sm',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 px-3 py-2 dark:border-white/[0.06]">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <Paintbrush className="h-3.5 w-3.5" aria-hidden />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Avatar por defecto</h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
              Sin foto se ve así; con foto, solo guardas el estilo de reserva. Quitar imagen en «Foto de perfil».
            </p>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="grid gap-3 md:grid-cols-12 md:items-start">
          {/* Vista previa única — estrecha */}
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-200/90 bg-white/60 px-2 py-3 dark:border-white/10 dark:bg-zinc-950/40 md:col-span-2">
            <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-400">Vista previa</p>
            <div
              className="flex items-center justify-center rounded-lg p-2 [background-size:8px_8px] [background-image:radial-gradient(circle,rgba(0,0,0,0.06)_1px,transparent_1px)] dark:[background-image:radial-gradient(circle,rgba(255,255,255,0.06)_1px,transparent_1px)]"
            >
              <UserAvatarView user={{ ...user, email: user.email, avatar: preview }} size="lg" />
            </div>
            <p className="text-center text-[9px] text-zinc-500" aria-live="polite">
              <span className="font-mono text-zinc-600 dark:text-zinc-400">{preview.initials}</span>
            </p>
          </div>

          {/* Iniciales + forma en una fila en md+ */}
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 md:col-span-5">
            <div>
              <div className="mb-0.5 flex items-center gap-1">
                <Type className="h-3 w-3 text-zinc-400" aria-hidden />
                <span className={label}>Iniciales</span>
              </div>
              <input
                className={field}
                maxLength={3}
                value={draft.initials}
                onChange={(e) =>
                  update({
                    initials: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 3),
                  })
                }
                placeholder="Auto"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="mt-1 line-clamp-2 text-[9px] text-zinc-500 dark:text-zinc-500 sm:line-clamp-1">
                <Info className="mb-0.5 mr-0.5 inline h-3 w-3 text-zinc-400 sm:hidden" />
                1–3 · vacío = iniciales del nombre o email
              </p>
            </div>
            <div>
              <span className={label}>Forma</span>
              <div className="mt-1.5 flex gap-1.5">
                {SHAPE_OPTIONS.map(({ value, title, Icon }) => {
                  const active = draft.shape === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => update({ shape: value })}
                      className={cn(
                        'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg border py-1.5 text-center transition',
                        active
                          ? 'border-amber-500/60 bg-amber-500/10 text-amber-900 dark:border-amber-500/35 dark:text-amber-100'
                          : 'border-zinc-200/80 bg-white hover:border-zinc-300 dark:border-white/10 dark:bg-zinc-900/20',
                      )}
                      aria-pressed={active}
                      title={title}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center text-zinc-500',
                          value === 'circle' && 'rounded-full',
                          value === 'rounded' && 'rounded-md',
                          value === 'square' && 'rounded-sm',
                          'border border-dashed',
                          active && 'border-amber-500/50 text-amber-800 dark:text-amber-200',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate text-[9px] font-medium leading-tight text-zinc-700 dark:text-zinc-300">{title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Combinaciones — 2 filas en móvil, 1 en xl */}
          <div className="md:col-span-5">
            <span className={label}>Rápido</span>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-3 md:grid-cols-6">
              {SUGGESTED_COMBOS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => update({ backgroundColor: c.backgroundColor, textColor: c.textColor })}
                  className="inline-flex min-h-0 items-center justify-center gap-1 rounded-md border border-zinc-200/80 bg-white py-1.5 text-[9px] font-medium text-zinc-700 transition hover:border-amber-400/40 dark:border-white/10 dark:bg-zinc-900/30 dark:text-zinc-300"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: c.backgroundColor }} />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Colores en dos columnas */}
        <div className="mt-3 grid gap-3 border-t border-zinc-200/60 pt-3 sm:grid-cols-2 dark:border-white/[0.06]">
          <div>
            <span className={label}>Fondo</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <div className="relative h-8 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-300 dark:border-white/20">
                <input
                  type="color"
                  className="absolute inset-0 h-full w-full min-w-0 cursor-pointer p-0 opacity-0"
                  value={draft.backgroundColor}
                  onChange={(e) => update({ backgroundColor: e.target.value })}
                  aria-label="Fondo"
                />
                <div className="pointer-events-none h-full w-full" style={{ backgroundColor: draft.backgroundColor }} />
              </div>
              {PRESET_BACKGROUNDS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  onClick={() => update({ backgroundColor: p.value })}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition',
                    draft.backgroundColor.toLowerCase() === p.value.toLowerCase()
                      ? 'border-amber-500 ring-1 ring-amber-500/30'
                      : 'border-white/20 ring-1 ring-black/5 dark:border-zinc-600',
                  )}
                  style={{ background: p.value }}
                />
              ))}
            </div>
            <p className="mt-0.5 font-mono text-[9px] text-zinc-500">{draft.backgroundColor}</p>
          </div>
          <div>
            <span className={label}>Texto</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <div className="relative h-8 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-300 dark:border-white/20">
                <input
                  type="color"
                  className="absolute inset-0 h-full w-full cursor-pointer p-0 opacity-0"
                  value={draft.textColor}
                  onChange={(e) => update({ textColor: e.target.value })}
                  aria-label="Texto"
                />
                <div className="pointer-events-none h-full w-full" style={{ backgroundColor: draft.textColor }} />
              </div>
              {TEXT_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => update({ textColor: p.value })}
                  className={cn(
                    'rounded-md border px-2 py-1 text-[9px] font-medium transition',
                    draft.textColor.toLowerCase() === p.value.toLowerCase()
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                      : 'border-zinc-200/80 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-zinc-900/30 dark:text-zinc-400',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-0.5 font-mono text-[9px] text-zinc-500">{draft.textColor}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className={cn(
              'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-amber-400 to-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm transition',
              'hover:from-amber-300 hover:to-amber-400 sm:w-auto',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {isPending ? (
              'Guardando…'
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden />
                Guardar avatar por defecto
              </>
            )}
          </button>
          <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end sm:text-right">
            {errorMessage && <p className="text-xs text-red-500 dark:text-red-400">{errorMessage}</p>}
            {successMessage && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400/90">{successMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
