import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Player } from './Player';
import { MobileNav } from './MobileNav';

export function Layout() {
  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-surface-900 to-surface-950">
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar className="hidden lg:flex" />
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-28">
          <Outlet />
        </main>
      </div>
      
      {/* Player */}
      <Player />
      
      {/* Mobile Navigation */}
      <MobileNav className="lg:hidden" />
    </div>
  );
}
<tr></tr>