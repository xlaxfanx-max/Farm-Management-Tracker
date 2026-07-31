import React from 'react';
import { Menu } from 'lucide-react';
import IconButton from '../ui/IconButton';

export default function MobileHeader({ onOpenSidebar }) {
  return (
    <div className="sticky top-0 z-30 lg:hidden bg-surface-raised border-b border-border px-4 py-3 flex items-center gap-3">
      <IconButton
        icon={Menu}
        label="Open navigation menu"
        variant="ghost"
        onClick={onOpenSidebar}
        className="-ml-2"
      />
      <span className="font-display text-xl text-heading leading-none">
        Finch<span className="text-primary">.</span>
      </span>
    </div>
  );
}
