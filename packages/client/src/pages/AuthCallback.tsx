import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Music2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { authApi } from '../lib/api';

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setError(errorParam);
      return;
    }

    if (accessToken && refreshToken) {
      // Fetch user data with the new tokens
      const fetchUser = async () => {
        try {
          // Temporarily set tokens to make the API call
          useAuthStore.getState().setTokens(accessToken, refreshToken);
          
          const { data: user } = await authApi.me();
          login(user, accessToken, refreshToken);
          
          setStatus('success');
          
          // Redirect to home after a brief success message
          setTimeout(() => {
            navigate('/');
          }, 1500);
        } catch (err: any) {
          setStatus('error');
          setError(err.response?.data?.error || 'Failed to complete authentication');
          useAuthStore.getState().logout();
        }
      };

      fetchUser();
    } else {
      setStatus('error');
      setError('Invalid authentication response');
    }
  }, [searchParams, login, navigate]);

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
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-primary-500 animate-spin" />
              <h1 className="text-xl font-bold mb-2">Signing you in...</h1>
              <p className="text-surface-400">Please wait while we complete your authentication.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h1 className="text-xl font-bold mb-2">Welcome!</h1>
              <p className="text-surface-400">You've been signed in successfully. Redirecting...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <h1 className="text-xl font-bold mb-2">Authentication Failed</h1>
              <p className="text-surface-400 mb-4">{error || 'Something went wrong. Please try again.'}</p>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg font-medium transition-colors"
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
