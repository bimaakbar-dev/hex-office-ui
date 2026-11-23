import React from 'react';
import type { WorkspaceMode } from '../types/office';

interface TopBarProps {
  workspaceMode: WorkspaceMode;
  drawerOpen: boolean;
  onSelectView: (view: 'office' | 'team' | 'layout') => void;
  onOpenCommandDrawer: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  workspaceMode,
  drawerOpen,
  onSelectView,
  onOpenCommandDrawer,
}) => {
  const activeNav =
    workspaceMode === 'layout' ? 'layout' : drawerOpen ? 'team' : 'office';

  return (
    <header className="fixed top-0 inset-x-0 z-20 h-14 bg-[#09090B]/95 border-b border-zinc-800/90 px-6 flex items-center justify-between gap-8">
      {/* [GANTI DI SINI] Ubah nama brand studio Anda di sini dan di index.html */}
      <button
        type="button"
        onClick={() => onSelectView('office')}
        className="font-display text-lg font-bold tracking-tight text-zinc-50 whitespace-nowrap shrink-0 cursor-pointer hover:text-white transition-colors duration-150"
      >
        HexOffice
      </button>

      {/* Zone 2: Clean single-line text navigation */}
      <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-zinc-400">
        <button
          type="button"
          onClick={() => onSelectView('office')}
          className={`py-1 border-b-2 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
            activeNav === 'office'
              ? 'border-zinc-50 text-zinc-50'
              : 'border-transparent hover:text-zinc-200'
          }`}
        >
          Kantor 3D
        </button>
        <button
          type="button"
          onClick={() => onSelectView('team')}
          className={`py-1 border-b-2 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
            activeNav === 'team'
              ? 'border-zinc-50 text-zinc-50'
              : 'border-transparent hover:text-zinc-200'
          }`}
        >
          Tim Agen
        </button>
        <button
          type="button"
          onClick={() => onSelectView('layout')}
          className={`py-1 border-b-2 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
            activeNav === 'layout'
              ? 'border-zinc-50 text-zinc-50'
              : 'border-transparent hover:text-zinc-200'
          }`}
        >
          Tata Ruang
        </button>
      </nav>

      {/* Zone 3: Single primary Vercel-style high-contrast action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenCommandDrawer}
          className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-zinc-50 rounded-lg hover:bg-white transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Kirim Tugas
        </button>
      </div>
    </header>
  );
};
