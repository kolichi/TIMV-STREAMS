import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Music2, Mail, Lock, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { config } from '../lib/config';

// Facebook icon component
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

// Google icon component
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Check for OAuth error in URL
  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError) {
      const errorMessages: Record<string, string> = {
        facebook_denied: 'Facebook login was cancelled',
        facebook_token: 'Failed to authenticate with Facebook',
        facebook_error: 'Facebook login failed',
        google_denied: 'Google login was cancelled',
        google_error: 'Google login failed',
      };
      setError(errorMessages[urlError] || 'Authentication failed');
    }
  }, [searchParams]);

  // Fetch auth providers status
  const { data: providers } = useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => authApi.getProviders().then(res => res.data),
  });

  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      authApi.login(data).then((res) => res.data),
    onSuccess: (data) => {
      login(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Login failed');
    },
  });

  const magicLinkMutation = useMutation({
    mutationFn: (email: string) => authApi.magicLink(email).then((res) => res.data),
    onSuccess: () => {
      setMagicLinkSent(true);
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Failed to send magic link');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (magicLinkMode) {
      magicLinkMutation.mutate(email);
    } else {
      loginMutation.mutate({ email, password });
    }
  };

  const handleOAuthLogin = (provider: 'facebook' | 'google') => {
    window.location.href = `${config.apiUrl}/auth/${provider}`;
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-surface-900 to-surface-950">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Check your email!</h1>
          <p className="text-surface-400 mb-6">
            We've sent a magic link to <strong className="text-white">{email}</strong>. 
            Click the link in the email to sign in.
          </p>
          <button
            onClick={() => {
              setMagicLinkSent(false);
              setEmail('');
            }}
            className="text-primary-400 hover:underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-surface-900 to-surface-950">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Music2 className="w-7 h-7 text-white" />
          </div>
          <span className="text-3xl font-bold gradient-text">Izwei Music</span>
        </Link>

        {/* Form */}
        <div className="bg-surface-800/50 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-center mb-6">Welcome back</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            {providers?.facebook && (
              <button
                onClick={() => handleOAuthLogin('facebook')}
                className="w-full py-3 px-4 bg-[#1877F2] hover:bg-[#166FE5] rounded-lg font-medium flex items-center justify-center gap-3 transition-colors"
              >
                <FacebookIcon />
                Continue with Facebook
              </button>
            )}
            
            {providers?.google && (
              <button
                onClick={() => handleOAuthLogin('google')}
                className="w-full py-3 px-4 bg-white text-gray-800 hover:bg-gray-100 rounded-lg font-medium flex items-center justify-center gap-3 transition-colors"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-surface-800 text-surface-400">or continue with email</span>
            </div>
          </div>

          {/* Toggle Magic Link / Password */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMagicLinkMode(false)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                !magicLinkMode 
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50' 
                  : 'bg-surface-700 text-surface-400 hover:text-white'
              }`}
            >
              <Lock className="w-4 h-4 inline mr-2" />
              Password
            </button>
            {providers?.magicLink && (
              <button
                type="button"
                onClick={() => setMagicLinkMode(true)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  magicLinkMode 
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50' 
                    : 'bg-surface-700 text-surface-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4 inline mr-2" />
                Magic Link
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            {!magicLinkMode && (
              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending || magicLinkMutation.isPending}
              className="w-full py-3 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {(loginMutation.isPending || magicLinkMutation.isPending) ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {magicLinkMode ? 'Sending link...' : 'Signing in...'}
                </>
              ) : (
                magicLinkMode ? 'Send Magic Link' : 'Sign In'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-surface-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-primary-400 hover:underline font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
