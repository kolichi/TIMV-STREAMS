import { NavLink } from 'react-router-dom';
import { Home, Search, Library, Upload } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import clsx from 'clsx';

interface MobileNavProps {
  className?: string;
}

export function MobileNav({ className }: MobileNavProps) {
  const { isAuthenticated, user } = useAuthStore();

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/library', icon: Library, label: 'Library', auth: true },
    { to: '/upload', icon: Upload, label: 'Upload', auth: true, artist: true },
  ];

  return (
    <nav
      className={clsx(
        'fixed bottom-0 left-0 right-0 bg-surface-900/95 backdrop-blur-lg border-t border-surface-800 z-40',
        className
      )}
    >
      <ul className="flex items-center justify-around py-2 px-4">
        {navItems.map((item) => {
          if (item.auth && !isAuthenticated) return null;
          if (item.artist && !user?.isArtist) return null;

          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'text-primary-400'
                      : 'text-surface-400 hover:text-white'
                  )
                }
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
