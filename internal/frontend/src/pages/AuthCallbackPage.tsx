import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../api/apiClient';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');

    if (!code) {
      navigate('/login', { replace: true });
      return;
    }

    // Exchange the one-time SSO code for fresh access + refresh tokens
    fetch('/api/auth/sso/exchange/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data?.detail ?? 'SSO exchange failed');
        tokens.set(data.access, data.refresh);
        // Clear the code from URL so it can't be replayed
        window.history.replaceState(null, '', window.location.pathname);
        navigate('/org/dashboard', { replace: true });
      })
      .catch(err => {
        setError(err.message);
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-red-500">{error} — redirecting to login…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Signing you in…</p>
    </div>
  );
}
