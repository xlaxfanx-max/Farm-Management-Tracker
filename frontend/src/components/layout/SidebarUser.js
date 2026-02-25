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
      <div className="p-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex justify-center p-2 hover:bg-sidebar-hover rounded-md text-gray-300 hover:text-red-400 transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10">
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
              className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 rounded-md hover:bg-white/10 transition-colors"
            >
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-200 truncate flex-1 text-left">
                {currentCompany.name}
              </span>
              {companies.length > 1 && (
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                    showCompanyMenu ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>

            {showCompanyMenu && companies.length > 1 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-raised dark:bg-gray-700 border border-border dark:border-gray-600 rounded-lg shadow-lg z-50 py-1">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      onSwitchCompany(company.id);
                      setShowCompanyMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-sunken dark:hover:bg-gray-600 text-left ${
                      company.id === currentCompany.id ? 'bg-primary-light dark:bg-green-900/30' : ''
                    }`}
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                      {company.name}
                    </span>
                    {company.id === currentCompany.id && (
                      <span className="ml-auto text-primary dark:text-green-400">&#10003;</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-500 mt-1 px-1">{currentCompany.role}</p>
        </div>
      )}

      {/* User menu */}
      <div className="px-3 pb-3">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-hover transition-colors"
          >
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-white">{getUserInitials()}</span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">
                {user?.first_name || user?.email}
              </p>
              <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-raised dark:bg-gray-700 border border-border dark:border-gray-600 rounded-lg shadow-lg z-50 py-1">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  navigate(VIEW_TO_PATH['profile']);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-sunken dark:hover:bg-gray-600 text-left text-sm text-gray-700 dark:text-gray-200"
              >
                <User className="w-4 h-4" />
                Profile
              </button>
              <hr className="my-1 border-gray-200 dark:border-gray-600" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-left text-sm text-red-600 dark:text-red-400"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
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
