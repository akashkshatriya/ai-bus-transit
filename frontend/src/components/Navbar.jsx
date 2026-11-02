import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { BusLogo, AssistantIcon } from './Icons';

export const Navbar = () => {
  const { user, role, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-beige bg-surface/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 sm:space-x-3 group shrink-0">
          <BusLogo size={36} className="sm:w-10 sm:h-10 w-8 h-8 shadow-soft group-hover:scale-105 transition-transform shrink-0" />
          <div className="hidden xs:block">
            <span className="font-heading font-extrabold text-sm sm:text-lg text-olive-deep whitespace-nowrap">
              BusTracker ML
            </span>
            <span className="hidden sm:block text-[10px] text-ink-soft font-mono tracking-wider">LIVE ETA PREDICTIONS</span>
          </div>
          {/* Compact logo text for very narrow screens */}
          <span className="xs:hidden font-heading font-extrabold text-sm text-olive-deep whitespace-nowrap">
            BusTracker
          </span>
        </Link>

        {/* Nav items */}
        <nav className="flex items-center gap-1 sm:gap-2 min-w-0">
          <Link
            to="/chat"
            className={`px-2.5 sm:px-3 py-1.5 rounded-btn text-xs font-semibold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${
              isActive('/chat')
                ? 'bg-sage-light text-olive-deep border border-primary'
                : 'text-ink-soft hover:text-olive-deep hover:bg-btn-secondary'
            }`}
          >
            <AssistantIcon size={16} />
            <span className="hidden sm:inline">AI Assistant</span>
            <span className="sm:hidden">Chat</span>
          </Link>

          {!isAuthenticated ? (
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-btn text-xs font-semibold transition-all whitespace-nowrap ${
                isActive('/')
                  ? 'bg-sage-light text-olive-deep border border-primary'
                  : 'text-ink-soft hover:text-olive-deep hover:bg-btn-secondary'
              }`}
            >
              Sign In
            </Link>
          ) : (
            <>
              {role === 'driver' ? (
                <Link
                  to="/driver"
                  className={`px-2.5 sm:px-3 py-1.5 rounded-btn text-xs font-semibold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                    isActive('/driver')
                      ? 'bg-sage-light text-olive-deep border border-primary'
                      : 'text-ink-soft hover:text-olive-deep hover:bg-btn-secondary'
                  }`}
                >
                  <span>🚌</span>
                  <span className="hidden sm:inline">Driver Console</span>
                  <span className="sm:hidden">Console</span>
                </Link>
              ) : (
                <Link
                  to="/passenger"
                  className={`px-2.5 sm:px-3 py-1.5 rounded-btn text-xs font-semibold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                    isActive('/passenger')
                      ? 'bg-sage-light text-olive-deep border border-primary'
                      : 'text-ink-soft hover:text-olive-deep hover:bg-btn-secondary'
                  }`}
                >
                  <span>👤</span>
                  <span className="hidden sm:inline">Passenger Portal</span>
                  <span className="sm:hidden">Portal</span>
                </Link>
              )}

              {/* User info — hidden on very small screens */}
              <div className="hidden md:flex items-center gap-2 pl-2 border-l border-beige">
                <span className="text-xs font-medium text-ink truncate max-w-[100px]">
                  {user?.name || user?.email}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold whitespace-nowrap ${
                    role === 'driver'
                      ? 'bg-sage-light text-olive-deep border border-primary'
                      : 'bg-cream text-olive-deep border border-beige'
                  }`}
                >
                  {role}
                </span>
              </div>

              <button
                onClick={handleLogout}
                id="nav-logout-btn"
                className="px-2.5 sm:px-3 py-1.5 rounded-btn text-xs font-semibold text-olive-deep hover:bg-btn-secondary border border-beige transition-colors cursor-pointer whitespace-nowrap"
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
