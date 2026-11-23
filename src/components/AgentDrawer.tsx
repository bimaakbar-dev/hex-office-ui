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
      // Clipboard fallback silently ignored
    }
  };

  return (
    <aside
      aria-label="Panel Karyawan AI Studio"
      className="fixed top-16 right-4 bottom-24 z-20 w-[390px] max-w-[calc(100vw-2rem)] bg-white/95 border border-slate-200 rounded-xl shadow-lg flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {activeAgent ? (
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: activeAgent.accentHex }}
              />
              <h2 className="font-display text-sm font-bold text-slate-900 truncate">
                {activeAgent.name}
              </h2>
              <span className="text-xs text-slate-500 truncate">
                · {activeAgent.role}
              </span>
            </div>
          ) : (
            <h2 className="font-display text-sm font-bold text-slate-900">
              Karyawan Studio AI
            </h2>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeAgent && (
            <button
              type="button"
              onClick={() => onSelectAgent('')}
              className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
            >
              Semua Tim
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
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
            <p className="text-xs text-slate-600 leading-relaxed">
              Pilih karyawan studio di bawah atau klik karakter 3D untuk memfokuskan kamera dan menugaskan produksi Adobe Stock, YouTube, atau FB Reels.
            </p>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50/60">
              {AGENT_PROFILES.map((agent) => {
                const rt = agentStates[agent.id];
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => onSelectAgent(agent.id)}
                    className="w-full px-3.5 py-3 text-left hover:bg-white transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: agent.accentHex }}
                        />
                        <span>{agent.name}</span>
                        <span className="text-xs font-normal text-slate-500">
                          · {agent.role}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 truncate">
                        {ACTIVITY_TEXT[rt?.activity ?? 'working']} — {rt?.thoughtBubble}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 pb-4 border-b border-slate-100">
              <p className="text-xs text-slate-600 leading-relaxed">
                {activeAgent.specialty}
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Energi</span>
                    <span className="font-mono-tabular font-semibold text-slate-900">
                      {activeRuntime?.energy ?? 90}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 transition-all duration-300"
                      style={{ width: `${activeRuntime?.energy ?? 90}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Fokus</span>
                    <span className="font-mono-tabular font-semibold text-slate-900">
                      {activeRuntime?.focus ?? 92}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
                  className="flex-1 py-1.5 px-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Meja</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerLifeAction(activeAgent.id, 'coffee')}
                  className="flex-1 py-1.5 px-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Kopi</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerLifeAction(activeAgent.id, 'meeting')}
                  className="flex-1 py-1.5 px-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
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
          <div className="text-xs font-medium text-slate-700">
            Tugas Cepat Microstock & Kreator
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CREATOR_QUICK_PROMPTS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={isDispatching}
                onClick={() => onSendPrompt(preset.prompt, preset.targetAgentId)}
                className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Task & AI Conversation Log */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-slate-700">Hasil Kerja & Log Produksi</span>
            <span className="font-mono-tabular">{visibleMessages.length} catatan</span>
          </div>

          {visibleMessages.length === 0 ? (
            <div className="py-5 px-4 bg-slate-50 border border-slate-200/80 rounded-lg text-center">
              <p className="text-xs text-slate-600 leading-relaxed">
                Pilih salah satu tombol tugas cepat di atas atau tulis instruksi khusus untuk{' '}
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
                      ? 'bg-slate-900 text-white border-slate-900 ml-6'
                      : msg.sender === 'error'
                        ? 'bg-red-50 text-red-800 border-red-200'
                        : 'bg-slate-50 text-slate-800 border-slate-200 mr-2'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between text-[11px] mb-1 ${
                      msg.sender === 'user' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    <span className="font-semibold">
                      {msg.sender === 'user' ? 'Pemilik Studio' : msg.agentName}
                    </span>
                    <span className="font-mono-tabular">{msg.timestamp}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {msg.deliverables && msg.deliverables.length > 0 && (
                    <ul className="mt-2.5 pt-2 border-t border-slate-200/80 space-y-1.5 text-slate-700">
                      {msg.deliverables.map((item, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="font-mono-tabular text-slate-400 shrink-0">
                            0{idx + 1}.
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {msg.metadataBlock && msg.metadataBlock.trim().length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/80">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-slate-600">
                          Siap Salin (Metadata / Prompt / Caption)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyBlock(msg.id, msg.metadataBlock!)}
                          className="px-2 py-0.5 text-[11px] font-medium bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
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
                      <pre className="p-2 bg-white border border-slate-200 rounded text-[11px] font-mono-tabular text-slate-800 whitespace-pre-wrap break-words">
                        {msg.metadataBlock}
                      </pre>
                    </div>
                  )}

                  {msg.collaboratorName && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Sinkronisasi dengan {msg.collaboratorName}
                    </p>
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
        className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
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
          className="h-9 flex-1 px-3 text-xs text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        />
        <button
          type="submit"
          disabled={!drawerPrompt.trim() || isDispatching}
          className="h-9 px-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-45 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
          aria-label="Kirim tugas"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </aside>
  );
};
