import React from 'react';

const TopNavBar = ({ activeModule, onModuleChange }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inspections', label: 'Inspections' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'system', label: 'System' },
  ];

  return (
    <header className="bg-surface-container-lowest border-b border-outline-variant fixed top-0 w-full z-50">
      <div className="flex justify-between items-center w-full px-lg py-md max-w-full mx-auto">
        <div className="flex items-center gap-xl">
          <span className="font-h1 text-h1 tracking-tighter text-primary">VANDE_INSPECT_AI</span>
          <nav className="hidden md:flex gap-lg items-center">
            {navItems.map((item) => (
              <a
                key={item.id}
                onClick={() => onModuleChange(item.id)}
                className={`pb-2 font-body-base transition-colors duration-200 cursor-pointer active:opacity-70 ${
                  activeModule === item.id
                    ? 'text-primary border-b-2 border-primary font-h2'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-md">
          <button className="material-symbols-outlined text-on-surface-variant hover:text-primary p-xs">notifications_active</button>
          <button className="material-symbols-outlined text-on-surface-variant hover:text-primary p-xs">settings</button>
          <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant overflow-hidden">
            <img 
              alt="Engineer Profile" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBCEOYyWG4h6DfU3iKzPzbm7jVkaUKI0Nnw-HlK0gaLPTlntanuebog8l6idFPzI-6TAZcIxB16T-EE2YOBrUIhvcQryMN3HFi8sXxx8IGDUWbALgI9SkRaTVl-7Lx-yctu_XI0-QTAcqIiqjIMZLbmyviP2wB6191oP4FmKw-Gh1gUdhCtwNaiNoH32b3fcZKlWtT_ww-5A-ZW9qZTJ8SINVh0IygwiuhWDJgt3D7F-CCUVHcCfJn64AOTzfX_xAwzMA4TJy9INQ"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavBar;
