import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, PlusCircle } from 'lucide-react';
import useInspectionStore from '../../store/useInspectionStore';
import Button from '../common/Button';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'inspections', label: 'Inspections', path: '/inspect' },
  { id: 'analytics', label: 'Analytics', path: '#' },
  { id: 'maintenance', label: 'Maintenance', path: '#' },
  { id: 'system', label: 'System', path: '#' },
];

const TopNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (item) => {
    if (item.id === 'inspections') return location.pathname.startsWith('/inspect');
    return location.pathname === item.path;
  };

  const { sessions, currentSessionId, switchSession, createSession } = useInspectionStore();
  const [sessionOpen, setSessionOpen] = useState(false);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const handleNav = (item) => {
    if (item.path !== '#') navigate(item.path);
    setMobileOpen(false);
  };

  const handleNewInspection = () => {
    const name = prompt("Enter Inspection Name:", `Inspection ${sessions.length + 1}`);
    if (name) {
      createSession(name, null);
      navigate('/inspect');
    }
  };

  return (
    <header className="bg-surface-container-lowest border-b border-outline-variant z-50 flex-shrink-0">
      <div className="flex justify-between items-center w-full px-lg py-md lg:py-lg max-w-full mx-auto">
        {/* Left: Logo + Session Picker */}
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-md">
            <span
              className="font-h1 tracking-tighter text-primary cursor-pointer select-none text-[22px] lg:text-[26px] xl:text-[28px]"
              onClick={() => navigate('/inspect')}
            >
              VANDE_INSPECT_AI
            </span>

            {/* Session Switcher */}
            <div className="relative ml-md border-l border-outline-variant pl-md hidden sm:block">
              <button 
                onClick={() => setSessionOpen(!sessionOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-sm bg-surface-container-low border border-outline-variant hover:border-primary transition-all group"
              >
                <div className="flex flex-col items-start">
                  <span className="font-label-caps text-[9px] lg:text-[10px] text-outline uppercase tracking-widest">Active Session</span>
                  <span className="font-body-sm text-[13px] lg:text-[14px] font-bold text-primary truncate max-w-[180px] xl:max-w-[220px]">
                    {currentSession?.name || 'No Active Session'}
                  </span>
                </div>
                <ChevronDown size={14} className={`text-outline group-hover:text-primary transition-transform ${sessionOpen ? 'rotate-180' : ''}`} />
              </button>

              {sessionOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSessionOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 w-[280px] bg-surface-container-lowest border border-outline-variant shadow-xl z-50 rounded-sm overflow-hidden animate-in fade-in slide-in-from-top-1">
                    <div className="p-2 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
                      <span className="font-label-caps text-[9px] text-outline">SELECT INSPECTION</span>
                      <button onClick={handleNewInspection} className="text-primary hover:bg-primary/10 p-1 rounded-full transition-colors">
                        <PlusCircle size={14} />
                      </button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto py-1">
                      {sessions.length === 0 ? (
                        <div className="px-4 py-6 text-center text-outline text-[11px] italic">No active sessions</div>
                      ) : (
                        sessions.map(s => (
                          <button
                            key={s.id}
                            onClick={() => { switchSession(s.id); setSessionOpen(false); }}
                            className={`w-full text-left px-4 py-2 hover:bg-surface-container-low flex flex-col gap-0.5 transition-colors
                              ${currentSessionId === s.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                          >
                            <span className={`text-[12px] font-bold ${currentSessionId === s.id ? 'text-primary' : 'text-on-surface'}`}>{s.name}</span>
                            <span className="text-[9px] text-outline font-code">{s.timestamp}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex gap-lg xl:gap-xl items-center">
            {navItems.map((item) => (
              <a
                key={item.id}
                onClick={() => handleNav(item)}
                className={`pb-1.5 font-body-base text-[14px] lg:text-[15px] xl:text-[16px] transition-colors duration-200 cursor-pointer active:opacity-70 ${
                  isActive(item)
                    ? 'text-primary border-b-2 border-primary font-semibold'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-md">
          <button className="material-symbols-outlined text-on-surface-variant hover:text-primary p-xs hidden sm:block cursor-pointer">notifications_active</button>
          <button className="material-symbols-outlined text-on-surface-variant hover:text-primary p-xs hidden sm:block cursor-pointer">settings</button>
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-primary flex items-center justify-center text-on-primary text-[13px] lg:text-[14px] font-bold flex-shrink-0">
            VB
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-xs text-on-surface-variant hover:text-primary cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-outline-variant bg-surface-container-lowest px-lg py-sm flex flex-col gap-sm">
          {navItems.map((item) => (
            <a
              key={item.id}
              onClick={() => handleNav(item)}
              className={`py-xs font-body-base cursor-pointer ${
                isActive(item) ? 'text-primary font-semibold' : 'text-on-surface-variant'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
};

export default TopNavBar;
