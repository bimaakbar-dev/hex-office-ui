import React, { useState } from 'react';
import { ArrowRight, Briefcase, Check, Coffee, Copy, Send, Users, X } from 'lucide-react';
import { AGENT_PROFILES, CREATOR_QUICK_PROMPTS } from '../data/officeData';
import type { AgentActivityState, AgentMessage, AgentRuntimeState } from '../types/office';

interface AgentDrawerProps {
  open: boolean;
  selectedAgentId: string | null;
  agentStates: Record<string, AgentRuntimeState>;
  messages: AgentMessage[];
  isDispatching: boolean;
  onClose: () => void;
  onSelectAgent: (id: string) => void;
  onTriggerLifeAction: (agentId: string, action: 'coffee' | 'work' | 'meeting') => void;
  onSendPrompt: (prompt: string, agentId: string) => void;
}

const ACTIVITY_TEXT: Record<AgentActivityState, string> = {
  working: 'Fokus Produksi',
  walking: 'Sedang Berjalan',
  coffee: 'Istirahat Kopi',
  meeting: 'Brainstorming',
  thinking: 'Memproses Tugas AI',
  idle: 'Cari Inspirasi',
};

export const AgentDrawer: React.FC<AgentDrawerProps> = ({
  open,
  selectedAgentId,
  agentStates,
  messages,
  isDispatching,
  onClose,
  onSelectAgent,
  onTriggerLifeAction,
  onSendPrompt,
}) => {
  const [drawerPrompt, setDrawerPrompt] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!open) return null;

  const activeAgent = AGENT_PROFILES.find((p) => p.id === selectedAgentId) ?? null;
  const activeRuntime = activeAgent ? agentStates[activeAgent.id] : null;

  const visibleMessages = activeAgent
    ? messages.filter((m) => m.agentId === activeAgent.id || m.agentId === 'team')
    : messages;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = drawerPrompt.trim();
    if (!trimmed || isDispatching) return;
    onSendPrompt(trimmed, activeAgent ? activeAgent.id : 'team');
    setDrawerPrompt('');
  };

  const handleCopyBlock = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <aside
      aria-label="Panel Karyawan AI Studio"
      className="fixed top-16 right-4 bottom-24 z-20 w-[395px] max-w-[calc(100vw-2rem)] bg-[#09090B]/95 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-200 smooth-ease"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-zinc-800/90 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {activeAgent ? (
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: activeAgent.accentHex }}
              />
              <h2 className="font-display text-sm font-bold text-zinc-50 truncate">
                {activeAgent.name}
              </h2>
              <span className="text-xs text-zinc-400 truncate">
                · {activeAgent.role}
              </span>
            </div>
          ) : (
            <h2 className="font-display text-sm font-bold text-zinc-50">
              Karyawan Studio AI
            </h2>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeAgent && (
            <button
              type="button"
              onClick={() => onSelectAgent('')}
              className="px-2 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-900 transition-colors duration-150 cursor-pointer"
            >
              Semua Tim
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-900 transition-colors duration-150 cursor-pointer"
            aria-label="Tutup panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-5">
        {!activeAgent ? (
          <div className="space-y-2.5">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Pilih karyawan studio di bawah atau klik karakter 3D untuk memfokuskan kamera dan menugaskan produksi Adobe Stock, YouTube, atau FB Reels.
            </p>
            <div className="divide-y divide-zinc-800/80 border border-zinc-800 rounded-lg bg-[#111114] overflow-hidden">
              {AGENT_PROFILES.map((agent) => {
                const rt = agentStates[agent.id];
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => onSelectAgent(agent.id)}
                    className="w-full px-3.5 py-3 text-left hover:bg-zinc-900/90 transition-colors duration-150 flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: agent.accentHex }}
                        />
                        <span>{agent.name}</span>
                        <span className="text-xs font-normal text-zinc-400">
                          · {agent.role}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400 truncate">
                        {ACTIVITY_TEXT[rt?.activity ?? 'working']} — {rt?.thoughtBubble}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-500 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 pb-4 border-b border-zinc-800/80">
              <p className="text-xs text-zinc-400 leading-relaxed">
                {activeAgent.specialty}
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>Energi</span>
                    <span className="font-mono-tabular font-semibold text-zinc-100">
                      {activeRuntime?.energy ?? 90}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-100 transition-all duration-300"
                      style={{ width: `${activeRuntime?.energy ?? 90}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>Fokus</span>
                    <span className="font-mono-tabular font-semibold text-zinc-100">
                      {activeRuntime?.focus ?? 92}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${activeRuntime?.focus ?? 92}%`,
                        backgroundColor: activeAgent.accentHex,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick 3D Office Life Actions */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onTriggerLifeAction(activeAgent.id, 'work')}
                  className="flex-1 py-1.5 px-2 text-xs font-medium bg-[#111114] border border-zinc-800 hover:border-zinc-700 text-zinc-200 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-150 cursor-pointer"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Meja</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerLifeAction(activeAgent.id, 'coffee')}
                  className="flex-1 py-1.5 px-2 text-xs font-medium bg-[#111114] border border-zinc-800 hover:border-zinc-700 text-zinc-200 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-150 cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Kopi</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerLifeAction(activeAgent.id, 'meeting')}
                  className="flex-1 py-1.5 px-2 text-xs font-medium bg-[#111114] border border-zinc-800 hover:border-zinc-700 text-zinc-200 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-150 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Pitching</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Microstock & Content Creator Templates */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-zinc-300">
            Tugas Cepat Microstock & Kreator
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CREATOR_QUICK_PROMPTS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={isDispatching}
                onClick={() => onSendPrompt(preset.prompt, preset.targetAgentId)}
                className="px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 bg-[#111114] border border-zinc-800 hover:border-zinc-600 hover:text-white disabled:opacity-50 rounded-md transition-colors duration-150 whitespace-nowrap cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Task & AI Conversation Log */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="font-medium text-zinc-300">Hasil Kerja & Log Produksi</span>
            <span className="font-mono-tabular">{visibleMessages.length} catatan</span>
          </div>

          {visibleMessages.length === 0 ? (
            <div className="py-5 px-4 bg-[#111114] border border-zinc-800/80 rounded-lg text-center">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pilih tombol tugas cepat di atas atau tulis instruksi khusus untuk{' '}
                {activeAgent ? activeAgent.name : 'tim studio'}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg border text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-zinc-100 text-zinc-950 border-zinc-100 ml-6'
                      : msg.sender === 'error'
                        ? 'bg-red-950/60 text-red-200 border-red-900/80'
                        : 'bg-[#111114] text-zinc-200 border-zinc-800 mr-2'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between text-[11px] mb-1 ${
                      msg.sender === 'user' ? 'text-zinc-600' : 'text-zinc-400'
                    }`}
                  >
                    <span className="font-semibold">
                      {msg.sender === 'user' ? 'Pemilik Studio' : msg.agentName}
                    </span>
                    <span className="font-mono-tabular">{msg.timestamp}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {msg.deliverables && msg.deliverables.length > 0 && (
                    <ul className="mt-2.5 pt-2 border-t border-zinc-800 space-y-1.5 text-zinc-300">
                      {msg.deliverables.map((item, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="font-mono-tabular text-zinc-500 shrink-0">
                            0{idx + 1}.
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {msg.metadataBlock && msg.metadataBlock.trim().length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-zinc-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-zinc-400">
                          Siap Salin (Metadata / Prompt / Caption)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyBlock(msg.id, msg.metadataBlock!)}
                          className="px-2 py-0.5 text-[11px] font-medium bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 rounded flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-2 bg-[#09090B] border border-zinc-800 rounded text-[11px] font-mono-tabular text-zinc-200 whitespace-pre-wrap break-words">
                        {msg.metadataBlock}
                      </pre>
                    </div>
                  )}

                  {(msg.collaboratorName || msg.providerUsed) && (
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                      <span>
                        {msg.collaboratorName ? `Sinkronisasi dengan ${msg.collaboratorName}` : ''}
                      </span>
                      {msg.providerUsed && (
                        <span className="font-mono-tabular">{msg.providerUsed}</span>
                      )}
                    </div>
                  )}

                  {msg.sender === 'error' && msg.retryPrompt && (
                    <button
                      type="button"
                      disabled={isDispatching}
                      onClick={() =>
                        onSendPrompt(msg.retryPrompt!, msg.retryAgentId ?? 'raka')
                      }
                      className="mt-2.5 px-2.5 py-1 text-[11px] font-semibold bg-red-600 hover:bg-red-500 text-white rounded-md disabled:opacity-50 cursor-pointer"
                    >
                      Coba Ulang
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Follow-up Prompt Footer */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-zinc-800 bg-[#09090B] flex items-center gap-2"
      >
        <input
          type="text"
          value={drawerPrompt}
          onChange={(e) => setDrawerPrompt(e.target.value)}
          placeholder={
            activeAgent
              ? `Beri tugas ke ${activeAgent.name}...`
              : 'Kirim tugas ke seluruh tim studio...'
          }
          className="h-9 flex-1 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 bg-[#111114] border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600"
        />
        <button
          type="submit"
          disabled={!drawerPrompt.trim() || isDispatching}
          className="h-9 px-3 bg-zinc-50 text-zinc-950 rounded-lg hover:bg-white disabled:opacity-45 transition-colors duration-150 flex items-center justify-center shrink-0 cursor-pointer"
          aria-label="Kirim tugas"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </aside>
  );
};
