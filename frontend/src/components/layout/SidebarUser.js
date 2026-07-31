import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Building2, ChevronDown } from 'lucide-react';
import { VIEW_TO_PATH } from '../../routes';

export default function SidebarUser({
  user,
  currentCompany,
  companies,
  collapsed,
  onLogout,
  onSwitchCompany,
}) {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);

  const getUserInitials = () => {
    if (!user) return '?';
    const first = user.first_name?.[0] || '';
    const last = user.last_name?.[0] || '';
    return (first + last).toUpperCase() || user.email[0].toUpperCase();
  };

  const handleLogout = async () => {
    await onLogout();
    setShowUserMenu(false);
  };

  if (collapsed) {
    return (
      <div className="p-3 border-t border-cream-50/[0.14]">
        <button
          onClick={handleLogout}
          className="w-full flex justify-center p-2 hover:bg-sidebar-hover rounded-button text-cream-50/[0.78] hover:text-orange-300 transition-colors focus:outline-none focus-visible:ring-[3px] focus-visible:ring-cream-50/30"
          title="Sign Out"
          aria-label="Sign out"
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-cream-50/[0.14]">
      {/* Company selector */}
      {currentCompany && (
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <button
              onClick={() => {
                if (companies.length > 1) {
                  setShowCompanyMenu(!showCompanyMenu);
                } else {
                  navigate(VIEW_TO_PATH['company']);
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 bg-cream-50/[0.06] rounded-button hover:bg-cream-50/[0.12] transition-colors focus:outline-none focus-visible:ring-[3px] focus-visible:ring-cream-50/30"
              aria-label={companies.length > 1 ? 'Switch company' : 'Company settings'}
              aria-expanded={companies.length > 1 ? showCompanyMenu : undefined}
            >
              <Building2 className="w-4 h-4 text-cream-50/60" />
              <span className="text-sm font-medium text-cream-50/90 truncate flex-1 text-left">
                {currentCompany.name}
              </span>
              {companies.length > 1 && (
                <ChevronDown
                  className={`w-3.5 h-3.5 text-cream-50/60 transition-transform ${
                    showCompanyMenu ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>

            {showCompanyMenu && companies.length > 1 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-raised border border-border rounded-card shadow-lg z-50 py-1 overflow-hidden">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      onSwitchCompany(company.id);
                      setShowCompanyMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-cream-100 text-left ${
                      company.id === currentCompany.id ? 'bg-orange-50' : ''
                    }`}
                  >
                    <span className="text-sm text-bark-700 truncate">
                      {company.name}
                    </span>
                    {company.id === currentCompany.id && (
                      <span className="ml-auto text-primary">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-cream-50/50 mt-1 px-1">{currentCompany.role}</p>
        </div>
      )}

      {/* User menu */}
      <div className="px-3 pb-3">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-button hover:bg-sidebar-hover transition-colors focus:outline-none focus-visible:ring-[3px] focus-visible:ring-cream-50/30"
            aria-label="User menu"
            aria-expanded={showUserMenu}
          >
            <div className="w-[34px] h-[34px] bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <span className="font-display text-base text-white leading-none">{getUserInitials()}</span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-cream-50/90 truncate">
                {user?.first_name || user?.email}
              </p>
              <p className="text-[11px] text-cream-50/50 truncate">{user?.email}</p>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-raised border border-border rounded-card shadow-lg z-50 py-1 overflow-hidden">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  navigate(VIEW_TO_PATH['profile']);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cream-100 text-left text-sm text-bark-700"
              >
                <User className="w-4 h-4" />
                Profile
              </button>
              <hr className="my-1 border-border" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-danger-bg text-left text-sm text-danger"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Click-outside handler */}
      {(showUserMenu || showCompanyMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false);
            setShowCompanyMenu(false);
          }}
        />
      )}
    </div>
  );
}
