import React from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../navigation/Breadcrumbs';
import { VIEW_TO_PATH, VIEW_NAMES, VIEW_EYEBROWS } from '../../routes';

/**
 * The page frame every route sits in: white topbar carrying the eyebrow and
 * serif page title, cream body below it.
 *
 * Titles and eyebrows come from `routes.js` unless overridden per-route.
 */
export default function PageShell({
  view,
  title,
  eyebrow,
  actions,
  padded = true,
  breadcrumbs = true,
  children,
}) {
  const navigate = useNavigate();

  const resolvedTitle = title ?? VIEW_NAMES[view] ?? '';
  const resolvedEyebrow = eyebrow ?? VIEW_EYEBROWS[view];

  const handleNavigate = (viewId) => {
    const path = VIEW_TO_PATH[viewId];
    if (path) navigate(path);
  };

  return (
    <div className="min-h-full">
      {(resolvedTitle || actions) && (
        <header className="bg-surface-raised border-b border-border px-6 lg:px-8 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              {resolvedEyebrow && <p className="finch-eyebrow mb-1.5">{resolvedEyebrow}</p>}
              {resolvedTitle && (
                <h1 className="font-display text-page-title text-heading">{resolvedTitle}</h1>
              )}
            </div>
            {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
          </div>
        </header>
      )}

      <div className={padded ? 'p-6 lg:p-8' : ''}>
        {breadcrumbs && view && view !== 'dashboard' && (
          <Breadcrumbs currentView={view} onNavigate={handleNavigate} />
        )}
        {children}
      </div>
    </div>
  );
}
