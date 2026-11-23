import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Pause,
  Play,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AGENT_PROFILES, TILE_CATALOG } from '../data/officeData';
import type { AIProvider, CameraPreset, TileType, WorkspaceMode } from '../types/office';

interface BottomDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  workspaceMode: WorkspaceMode;
  onChangeMode: (mode: WorkspaceMode) => void;
  selectedBrush: TileType;
  onSelectBrush: (type: TileType) => void;
  onResetLayout: () => void;
  cameraPreset: CameraPreset;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  simSpeed: number;
  onChangeSimSpeed: (speed: number) => void;
  showBubbles: boolean;
  onToggleBubbles: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  targetAgentId: string;
  onChangeTargetAgent: (id: string) => void;
  aiProvider: AIProvider;
  onChangeAiProvider: (provider: AIProvider) => void;
  isDispatching: boolean;
  onDispatchPrompt: (prompt: string, agentId: string) => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  collapsed,
  onToggleCollapse,
  workspaceMode,
  onChangeMode,
  selectedBrush,
  onSelectBrush,
  onResetLayout,
  cameraPreset,
  onSelectCameraPreset,
  simSpeed,
  onChangeSimSpeed,
  showBubbles,
  onToggleBubbles,
  audioEnabled,
  onToggleAudio,
  targetAgentId,
  onChangeTargetAgent,
  aiProvider,
  onChangeAiProvider,
  isDispatching,
  onDispatchPrompt,
}) => {
  const [promptInput, setPromptInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = promptInput.trim();
    if (!trimmed || isDispatching) return;
    onDispatchPrompt(trimmed, targetAgentId);
    setPromptInput('');
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 z-20 flex flex-col items-center transition-transform duration-200 smooth-ease"
      style={{
        transform: collapsed
          ? 'translate(-50%, calc(100% - 34px))'
          : 'translate(-50%, 0)',
        maxWidth: 'min(960px, 95vw)',
        width: 'max-content',
      }}
    >
      {/* Collapse / Expand toggle tab */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="mb-1.5 px-3 py-1 bg-[#111114]/95 border border-zinc-800 rounded-md shadow-md text-[11px] font-medium text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer"
        title="Pintasan keyboard: H"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Tampilkan Kontrol</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Sembunyikan Kontrol</span>
          </>
        )}
      </button>

      {/* Main Dock Container (Vercel obsidian surface — zero backdrop-filter over WebGL) */}
      <div className="bg-[#09090B]/95 border border-zinc-800 rounded-xl shadow-2xl px-3.5 py-3 flex flex-col gap-2.5 w-full max-w-[940px]">
        {workspaceMode === 'observe' ? (
          <form onSubmit={handleSubmit} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <select
              value={targetAgentId}
              onChange={(e) => onChangeTargetAgent(e.target.value)}
              aria-label="Pilih Karyawan AI"
              className="h-9 px-2.5 text-xs font-medium text-zinc-100 bg-[#111114] border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 shrink-0 cursor-pointer"
            >
              <option value="team">Semua Tim (Kolaborasi)</option>
              {AGENT_PROFILES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.role}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Beri tugas produksi (misal: 49 keyword Adobe Stock, skrip FB Reels, ide YouTube)..."
              className="h-9 flex-1 min-w-[200px] px-3 text-xs text-zinc-100 placeholder:text-zinc-500 bg-[#111114] border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600"
            />

            <button
              type="submit"
              disabled={!promptInput.trim() || isDispatching}
              className="h-9 px-3.5 bg-zinc-50 text-zinc-950 text-xs font-semibold rounded-lg hover:bg-white disabled:opacity-45 disabled:cursor-not-allowed transition-colors duration-150 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isDispatching ? 'Memproses...' : 'Kirim'}</span>
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-400 mr-1 whitespace-nowrap">
              Klik ubin heksagon untuk mengubah zona:
            </span>
            {TILE_CATALOG.map((item) => {
              const active = selectedBrush === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => onSelectBrush(item.type)}
                  className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-zinc-50 text-zinc-950 border-zinc-50'
                      : 'bg-[#111114] text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-xs border border-white/15 shrink-0"
                    style={{ backgroundColor: item.swatch }}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onResetLayout}
              className="h-8 px-2.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-[#111114] border border-zinc-800 hover:border-zinc-700 flex items-center gap-1 whitespace-nowrap shrink-0 ml-auto cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        )}

        {/* Secondary Simulation, AI Engine & Camera Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-800/80 text-xs">
          {/* Camera presets */}
          <div className="flex items-center gap-1 bg-[#111114] border border-zinc-800/80 p-0.5 rounded-lg">
            {(
              [
                { id: 'isometric', label: 'Isometrik' },
                { id: 'top', label: 'Atas' },
                { id: 'focus', label: 'Fokus Agen' },
              ] as Array<{ id: CameraPreset; label: string }>
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => onSelectCameraPreset(cam.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  cameraPreset === cam.id
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          {/* AI Engine Switcher (Auto Failover / Gemini / Groq) */}
          <div className="flex items-center gap-1 bg-[#111114] border border-zinc-800/80 p-0.5 rounded-lg">
            {(
              [
                { id: 'auto', label: 'Auto AI' },
                { id: 'groq', label: 'Groq' },
                { id: 'gemini', label: 'Gemini' },
              ] as Array<{ id: AIProvider; label: string }>
            ).map((eng) => (
              <button
                key={eng.id}
                type="button"
                onClick={() => onChangeAiProvider(eng.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  aiProvider === eng.id
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {eng.label}
              </button>
            ))}
          </div>

          {/* Speed controls */}
          <div className="flex items-center gap-1 bg-[#111114] border border-zinc-800/80 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => onChangeSimSpeed(simSpeed === 0 ? 1 : 0)}
              className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                simSpeed === 0
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title={simSpeed === 0 ? 'Lanjutkan Simulasi' : 'Jeda Simulasi'}
            >
              {simSpeed === 0 ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              <span>{simSpeed === 0 ? 'Jeda' : 'Aktif'}</span>
            </button>
            {[1, 2].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onChangeSimSpeed(spd)}
                className={`px-2 py-1 rounded-md font-mono-tabular font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  simSpeed === spd
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {spd}×
              </button>
            ))}
          </div>

          {/* Mode, Bubbles & Audio */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                onChangeMode(workspaceMode === 'observe' ? 'layout' : 'observe')
              }
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                workspaceMode === 'layout'
                  ? 'bg-zinc-50 text-zinc-950 border-zinc-50'
                  : 'bg-[#111114] text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
              }`}
            >
              {workspaceMode === 'layout' ? 'Selesai Tata Ruang' : 'Tata Ruang'}
            </button>

            <button
              type="button"
              onClick={onToggleBubbles}
              className="p-1.5 rounded-lg border border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors duration-150 cursor-pointer"
              title={showBubbles ? 'Sembunyikan label agen' : 'Tampilkan label agen'}
              aria-label="Toggle label agen"
            >
              {showBubbles ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={onToggleAudio}
              className="p-1.5 rounded-lg border border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors duration-150 cursor-pointer"
              title={audioEnabled ? 'Bisukan suara' : 'Aktifkan suara interaksi'}
              aria-label="Toggle suara"
            >
              {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
