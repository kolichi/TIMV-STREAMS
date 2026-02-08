import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Music2, Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';
import { config } from '../lib/config';

export function AuthVerify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'verifying' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setError('Invalid or missing verification token');
      return;
    }

    // Redirect to backend to verify the magic link
    // The backend will then redirect back to /auth/callback with tokens
    setStatus('verifying');
    window.location.href = `${config.apiUrl}/auth/magic-link/verify?token=${token}`;
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-surface-900 to-surface-950">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Music2 className="w-7 h-7 text-white" />
          </div>
          <span className="text-3xl font-bold gradient-text">Izwei Music</span>
        </div>

        <div className="bg-surface-800/50 rounded-2xl p-8">
          {(status === 'loading' || status === 'verifying') && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <Loader2 className="w-8 h-8 mx-auto mb-4 text-primary-500 animate-spin" />
              <h1 className="text-xl font-bold mb-2">Verifying your email...</h1>
              <p className="text-surface-400">Please wait while we sign you in.</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <h1 className="text-xl font-bold mb-2">Verification Failed</h1>
              <p className="text-surface-400 mb-4">{error}</p>
              <p className="text-surface-500 text-sm mb-4">
                The link may have expired or already been used.
              </p>
              <Link
                to="/login"
                className="inline-block px-6 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg font-medium transition-colors"
              >
                Request a new link
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
