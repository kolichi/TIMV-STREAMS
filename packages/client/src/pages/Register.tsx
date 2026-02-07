import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Music2, Mail, Lock, User, Eye, EyeOff, Loader2, Mic } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import clsx from 'clsx';

export function Register() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isArtist, setIsArtist] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const registerMutation = useMutation({
    mutationFn: (data: {
      email: string;
      username: string;
      password: string;
      displayName?: string;
      isArtist?: boolean;
    }) => authApi.register(data).then((res) => res.data),
    onSuccess: (data) => {
      login(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Registration failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }
    
    registerMutation.mutate({
      email,
      username,
      password,
      displayName: displayName || undefined,
      isArtist,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-surface-900 to-surface-950">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Music2 className="w-7 h-7 text-white" />
          </div>
          <span className="text-3xl font-bold gradient-text">Stream</span>
        </Link>

        {/* Form */}
        <div className="bg-surface-800/50 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-center mb-6">Create account</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

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

            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  className="w-full pl-10 pr-4 py-3 bg-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="username"
                  pattern="^[a-zA-Z0-9_]+$"
                  minLength={3}
                  maxLength={30}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Display Name <span className="text-surface-400">(optional)</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Your Name"
                  maxLength={100}
                />
              </div>
            </div>

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
                  minLength={8}
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
              <p className="text-xs text-surface-400 mt-1">At least 8 characters</p>
            </div>

            {/* Account Type */}
            <div>
              <label className="block text-sm font-medium mb-3">Account Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsArtist(false)}
                  className={clsx(
                    'p-4 rounded-xl border-2 text-left transition-colors',
                    !isArtist
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-surface-600 hover:border-surface-500'
                  )}
                >
                  <User className="w-6 h-6 mb-2" />
                  <p className="font-medium">Listener</p>
                  <p className="text-xs text-surface-400">
                    Discover and enjoy music
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setIsArtist(true)}
                  className={clsx(
                    'p-4 rounded-xl border-2 text-left transition-colors',
                    isArtist
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-surface-600 hover:border-surface-500'
                  )}
                >
                  <Mic className="w-6 h-6 mb-2" />
                  <p className="font-medium">Artist</p>
                  <p className="text-xs text-surface-400">
                    Upload and share music
                  </p>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full py-3 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-surface-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-primary-400 hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
