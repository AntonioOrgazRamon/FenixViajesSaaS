import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { api } from '../../../lib/axios';

export function GoogleAuthCallbackPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (!code) {
        navigate('/login', {
          replace: true,
          state: { message: 'No se pudo completar el acceso con Google. Inténtalo de nuevo.' },
        });
        return;
      }
      try {
        const { data } = await api.post<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
          '/auth/google/exchange',
          { code },
        );
        setTokens(data.data.accessToken, data.data.refreshToken);
        navigate('/', { replace: true });
      } catch {
        navigate('/login', {
          replace: true,
          state: { message: 'No se pudo completar el acceso con Google. Inténtalo de nuevo.' },
        });
      }
    })();
  }, [navigate, setTokens]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] text-zinc-300">
      <p className="text-sm">Completando acceso con Google…</p>
    </div>
  );
}
