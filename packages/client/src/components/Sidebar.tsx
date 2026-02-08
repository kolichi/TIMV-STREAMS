import { NavLink } from 'react-router-dom';
import { Home, Search, Library, Upload, Settings, Music2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import clsx from 'clsx';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { isAuthenticated, user } = useAuthStore();

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/library', icon: Library, label: 'Library', auth: true },
    { to: '/upload', icon: Upload, label: 'Upload', auth: true, artist: true },
  ];

  return (
    <aside
      className={clsx(
        'w-64 bg-surface-900/50 border-r border-surface-800 flex flex-col',
        className
      )}
    >
      {/* Logo */}
      <div className="p-6">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Music2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold gradient-text">Izwei Music</span>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            // Skip if requires auth and not authenticated
            if (item.auth && !isAuthenticated) return null;
            // Skip if requires artist and not artist
            if (item.artist && !user?.isArtist) return null;

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      isActive
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-surface-800">
        {isAuthenticated && user ? (
          <NavLink
            to="/settings"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-800 transition-colors"
          >
            {user.avatarUrl ? (
              <img
                src={`/uploads/${user.avatarUrl}`}
                alt={user.displayName || user.username}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {(user.displayName || user.username)[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {user.displayName || user.username}
              </p>
              <p className="text-xs text-surface-400 truncate">
                {user.isArtist ? 'Artist' : 'Listener'}
              </p>
            </div>
            <Settings className="w-5 h-5 text-surface-400" />
          </NavLink>
        ) : (
          <div className="space-y-2">
            <NavLink
              to="/login"
              className="block w-full py-2 px-4 text-center rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors font-medium"
            >
              Log In
            </NavLink>
            <NavLink
              to="/register"
              className="block w-full py-2 px-4 text-center rounded-lg border border-surface-600 hover:bg-surface-800 transition-colors font-medium"
            >
              Sign Up
            </NavLink>
          </div>
        )}
      </div>
    </aside>
  );
}
