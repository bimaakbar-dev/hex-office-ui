import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentDrawer } from './components/AgentDrawer';
import { BottomDock } from './components/BottomDock';
import { type AgentDirective, HexOfficeCanvas } from './components/HexOfficeCanvas';
import { TopBar } from './components/TopBar';
import {
  AGENT_PROFILES,
  createInitialAgentStates,
  createInitialHexMap,
  TILE_CATALOG,
} from './data/officeData';
import type {
  AgentMessage,
  AgentRuntimeState,
  CameraPreset,
  HexTile,
  TileType,
  WorkspaceMode,
} from './types/office';
import { officeAudio } from './utils/officeAudio';

function formatClockTime(): string {
  return new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function App() {
  const [tiles, setTiles] = useState<HexTile[]>(() => createInitialHexMap());
  const [agentStates, setAgentStates] = useState<Record<string, AgentRuntimeState>>(() =>
    createInitialAgentStates(),
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('observe');
  const [selectedBrush, setSelectedBrush] = useState<TileType>('workstation');

  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState(0);
  const [simSpeed, setSimSpeed] = useState(1);
  const [showBubbles, setShowBubbles] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const [targetAgentId, setTargetAgentId] = useState<string>('raka');
  const [isDispatching, setIsDispatching] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [pendingDirective, setPendingDirective] = useState<AgentDirective | null>(null);
  const [tileNotice, setTileNotice] = useState<string | null>(null);

  const directiveNonceRef = useRef(1);
  const noticeTimeoutRef = useRef<number | null>(null);

  const showBriefNotice = useCallback((text: string) => {
    setTileNotice(text);
    if (noticeTimeoutRef.current) window.clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = window.setTimeout(() => {
      setTileNotice(null);
    }, 2800);
  }, []);

  // Keyboard shortcuts: H to toggle Zen/Cinema HUD, Escape to close drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'Escape') {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleToggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      officeAudio.enabled = next;
      if (next) officeAudio.playTileClick();
      return next;
    });
  }, []);

  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setCameraPresetTrigger((n) => n + 1);
  }, []);

  const handleSelectAgent = useCallback(
    (agentId: string | null) => {
      if (!agentId) {
        setSelectedAgentId(null);
        return;
      }
      officeAudio.playTileClick();
      setSelectedAgentId(agentId);
      setTargetAgentId(agentId);
      setDrawerOpen(true);
      setCameraPreset('focus');
      setCameraPresetTrigger((n) => n + 1);
    },
    [],
  );

  const handleTileClick = useCallback(
    (tile: HexTile) => {
      if (workspaceMode === 'layout') {
        officeAudio.playTileClick();
        const catalogItem = TILE_CATALOG.find((c) => c.type === selectedBrush);
        setTiles((prev) =>
          prev.map((t) =>
            t.id === tile.id
              ? {
                  ...t,
                  type: selectedBrush,
                  label: catalogItem?.label ?? selectedBrush,
                  assignedAgentId: selectedBrush === 'workstation' ? t.assignedAgentId : undefined,
                }
              : t,
          ),
        );
        showBriefNotice(`Ubin (${tile.q}, ${tile.r}) diubah menjadi ${catalogItem?.label ?? selectedBrush}`);
        return;
      }

      if (!tile.assignedAgentId) {
        const catalogItem = TILE_CATALOG.find((c) => c.type === tile.type);
        showBriefNotice(`${tile.label ?? catalogItem?.label ?? 'Zona Kantor'}`);
      }
    },
    [workspaceMode, selectedBrush, showBriefNotice],
  );

  const handleResetLayout = useCallback(() => {
    officeAudio.playTileClick();
    setTiles(createInitialHexMap());
    showBriefNotice('Tata ruang kantor dikembalikan ke bawaan');
  }, [showBriefNotice]);

  const handleSelectTopView = useCallback((view: 'office' | 'team' | 'layout') => {
    if (view === 'office') {
      setWorkspaceMode('observe');
      setDrawerOpen(false);
      setCameraPreset('isometric');
      setCameraPresetTrigger((n) => n + 1);
    } else if (view === 'team') {
      setWorkspaceMode('observe');
      setSelectedAgentId(null);
      setDrawerOpen(true);
    } else if (view === 'layout') {
      setWorkspaceMode('layout');
      setDrawerOpen(false);
      setDockCollapsed(false);
    }
  }, []);

  const handleTriggerLifeAction = useCallback(
    (agentId: string, action: 'coffee' | 'work' | 'meeting') => {
      officeAudio.playTileClick();
      directiveNonceRef.current += 1;
      const map: Record<typeof action, Omit<AgentDirective, 'agentId' | 'nonce'>> = {
        coffee: {
          targetType: 'lounge',
          activity: 'coffee',
          thoughtBubble: 'Menuju Kafe Espresso',
          currentTask: 'Istirahat sejenak mengisi energi',
        },
        work: {
          targetType: 'home',
          activity: 'working',
          thoughtBubble: 'Kembali fokus di meja',
          currentTask: 'Menyelesaikan tugas utama',
        },
        meeting: {
          targetType: 'meeting',
          activity: 'meeting',
          thoughtBubble: 'Menuju Ruang Rapat',
          currentTask: 'Sinkronisasi tim di atrium',
        },
      };
      setPendingDirective({
        agentId,
        nonce: directiveNonceRef.current,
        ...map[action],
      });
    },
    [],
  );

  const handleDispatchPrompt = useCallback(
    async (prompt: string, agentOrTeamId: string) => {
      const isTeam = agentOrTeamId === 'team';
      const primaryAgent =
        AGENT_PROFILES.find((a) => a.id === agentOrTeamId) ?? AGENT_PROFILES[0];

      officeAudio.playTileClick();
      setIsDispatching(true);
      setDrawerOpen(true);
      if (!isTeam) {
        setSelectedAgentId(primaryAgent.id);
      } else {
        setSelectedAgentId(null);
      }

      const userMsg: AgentMessage = {
        id: `u-${Date.now()}`,
        agentId: isTeam ? 'team' : primaryAgent.id,
        agentName: isTeam ? 'Semua Tim' : primaryAgent.name,
        sender: 'user',
        text: prompt,
        timestamp: formatClockTime(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Animate 3D agent(s) walking to workstation or meeting table & thinking
      if (isTeam) {
        AGENT_PROFILES.forEach((p, idx) => {
          window.setTimeout(() => {
            directiveNonceRef.current += 1;
            setPendingDirective({
              agentId: p.id,
              targetType: 'meeting',
              activity: 'thinking',
              thoughtBubble: 'Berdiskusi dengan tim...',
              currentTask: prompt,
              nonce: directiveNonceRef.current,
            });
          }, idx * 120);
        });
      } else {
        directiveNonceRef.current += 1;
        setPendingDirective({
          agentId: primaryAgent.id,
          targetType: 'home',
          activity: 'thinking',
          thoughtBubble: 'Menyusun solusi AI...',
          currentTask: prompt,
          nonce: directiveNonceRef.current,
        });
      }

      try {
        const recentHistory = messages.slice(-4).map((m) => ({
          sender: m.sender === 'user' ? 'Pengguna' : m.agentName,
          text: m.text,
        }));

        const res = await fetch('/api/agent/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            agentId: primaryAgent.id,
            agentName: primaryAgent.name,
            agentRole: primaryAgent.role,
            agentSpecialty: primaryAgent.specialty,
            isTeamCollaboration: isTeam,
            history: recentHistory,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Permintaan gagal diproses.');
        }

        const collaborator = AGENT_PROFILES.find((a) => a.id === data.collaboratorId);

        const replyMsg: AgentMessage = {
          id: `a-${Date.now()}`,
          agentId: isTeam ? 'team' : primaryAgent.id,
          agentName: isTeam ? 'Tim Studio' : `${primaryAgent.name} (${primaryAgent.role})`,
          sender: 'agent',
          text: data.summary ?? 'Tugas selesai diproses.',
          deliverables: Array.isArray(data.deliverables) ? data.deliverables : [],
          metadataBlock: typeof data.metadataBlock === 'string' ? data.metadataBlock : undefined,
          collaboratorName: collaborator?.name,
          timestamp: formatClockTime(),
        };
        setMessages((prev) => [...prev, replyMsg]);
        officeAudio.playTaskComplete();

        // Transition agent to completed working state with new thought bubble
        const targetZone: TileType | 'home' =
          data.recommendedZone === 'meeting'
            ? 'meeting'
            : data.recommendedZone === 'server'
              ? 'server'
              : 'home';

        directiveNonceRef.current += 1;
        setPendingDirective({
          agentId: primaryAgent.id,
          targetType: targetZone,
          activity: 'working',
          thoughtBubble: data.thoughtBubble || 'Tugas selesai!',
          currentTask: prompt,
          nonce: directiveNonceRef.current,
        });

        // If a collaborator was recommended, walk them to the meeting hex to sync
        if (collaborator && collaborator.id !== primaryAgent.id) {
          window.setTimeout(() => {
            directiveNonceRef.current += 1;
            setPendingDirective({
              agentId: collaborator.id,
              targetType: 'meeting',
              activity: 'meeting',
              thoughtBubble: `Sinkronisasi dengan ${primaryAgent.name}`,
              currentTask: prompt,
              nonce: directiveNonceRef.current,
            });
          }, 220);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat menghubungi server AI.';
        const errMsg: AgentMessage = {
          id: `e-${Date.now()}`,
          agentId: isTeam ? 'team' : primaryAgent.id,
          agentName: 'Sistem',
          sender: 'error',
          text: message,
          retryPrompt: prompt,
          retryAgentId: agentOrTeamId,
          timestamp: formatClockTime(),
        };
        setMessages((prev) => [...prev, errMsg]);

        // Reset agent back to normal working animation
        directiveNonceRef.current += 1;
        setPendingDirective({
          agentId: primaryAgent.id,
          targetType: 'home',
          activity: 'working',
          thoughtBubble: 'Menunggu instruksi baru',
          currentTask: 'Siaga',
          nonce: directiveNonceRef.current,
        });
      } finally {
        setIsDispatching(false);
      }
    },
    [messages],
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#EBF0F5]">
      <TopBar
        workspaceMode={workspaceMode}
        drawerOpen={drawerOpen}
        onSelectView={handleSelectTopView}
        onOpenCommandDrawer={() => {
          setWorkspaceMode('observe');
          setDrawerOpen(true);
        }}
      />

      {/* Full-viewport 3D Hexagonal Office Stage */}
      <main className="w-full h-full pt-14">
        <HexOfficeCanvas
          tiles={tiles}
          selectedAgentId={selectedAgentId}
          cameraPreset={cameraPreset}
          cameraPresetTrigger={cameraPresetTrigger}
          simSpeed={simSpeed}
          workspaceMode={workspaceMode}
          showBubbles={showBubbles}
          agentStates={agentStates}
          pendingDirective={pendingDirective}
          onSelectAgent={handleSelectAgent}
          onTileClick={handleTileClick}
          onUpdateAgentStates={setAgentStates}
        />
      </main>

      {/* Brief non-intrusive tile feedback toast */}
      {tileNotice && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3.5 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg shadow-md">
          {tileNotice}
        </div>
      )}

      {/* Slide-over Agent Inspector & AI Task Output Drawer */}
      <AgentDrawer
        open={drawerOpen}
        selectedAgentId={selectedAgentId}
        agentStates={agentStates}
        messages={messages}
        isDispatching={isDispatching}
        onClose={() => setDrawerOpen(false)}
        onSelectAgent={(id) => handleSelectAgent(id || null)}
        onTriggerLifeAction={handleTriggerLifeAction}
        onSendPrompt={handleDispatchPrompt}
      />

      {/* Unified Collapsible Bottom Control Dock */}
      <BottomDock
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((c) => !c)}
        workspaceMode={workspaceMode}
        onChangeMode={(mode) => {
          setWorkspaceMode(mode);
          if (mode === 'layout') {
            setDrawerOpen(false);
            setDockCollapsed(false);
          }
        }}
        selectedBrush={selectedBrush}
        onSelectBrush={setSelectedBrush}
        onResetLayout={handleResetLayout}
        cameraPreset={cameraPreset}
        onSelectCameraPreset={handleSelectCameraPreset}
        simSpeed={simSpeed}
        onChangeSimSpeed={setSimSpeed}
        showBubbles={showBubbles}
        onToggleBubbles={() => setShowBubbles((b) => !b)}
        audioEnabled={audioEnabled}
        onToggleAudio={handleToggleAudio}
        targetAgentId={targetAgentId}
        onChangeTargetAgent={setTargetAgentId}
        isDispatching={isDispatching}
        onDispatchPrompt={handleDispatchPrompt}
      />
    </div>
  );
}
