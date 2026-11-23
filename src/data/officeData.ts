import type { AgentProfile, AgentRuntimeState, HexTile, TileType } from '../types/office';
import { hexKey, hexToWorld } from '../scene/hexMath';

// ============================================================================
// [GANTI DI SINI] 1. PROFIL KARYAWAN AI STUDIO ANDA
// Ubah nama, peran, spesialisasi, warna jaket (hex 0xRRGGBB), aksesoris,
// dan koordinat meja kerja (homeCoord) sesuai struktur tim studio Anda.
// ============================================================================
export const AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'raka',
    name: 'Raka',
    role: 'Riset Tren & SEO',
    specialty: 'Riset niche Adobe Stock, tren kata kunci mikro, & topik viral YouTube/FB Reels',
    accentHex: '#2563EB',
    jacketColor: 0x2b5fa8,
    hairColor: 0x1e293b,
    accessory: 'headset',
    homeCoord: { q: -2, r: 0 },
  },
  {
    id: 'tari',
    name: 'Tari',
    role: 'Penulis Skrip & Hook',
    specialty: 'Skrip video YouTube, hook 3 detik Facebook Reels, caption & CTA konversi tinggi',
    accentHex: '#D96B43',
    jacketColor: 0xc85d3b,
    hairColor: 0x3b2314,
    accessory: 'glasses',
    homeCoord: { q: 2, r: -2 },
  },
  {
    id: 'bima',
    name: 'Bima',
    role: 'Direktur Visual & Prompt',
    specialty: 'Prompt gambar/vektor AI aman komersial untuk Adobe Stock & konsep thumbnail YouTube',
    accentHex: '#2D8A68',
    jacketColor: 0x357a62,
    hairColor: 0x262626,
    accessory: 'beret',
    homeCoord: { q: -2, r: 2 },
  },
  {
    id: 'sora',
    name: 'Sora',
    role: 'Kurator Metadata & QA',
    specialty: 'Judul & 49 keyword Adobe Stock, cek kepatuhan AI disclosure, & tag YouTube/Reels',
    accentHex: '#C2822A',
    jacketColor: 0xc2822a,
    hairColor: 0x4a2c20,
    accessory: 'visor',
    homeCoord: { q: 2, r: 0 },
  },
];

// ============================================================================
// [GANTI DI SINI] 2. TEMPLATE TUGAS CEPAT (MICROSTOCK & KONTEN KREATOR)
// Tambahkan atau ubah preset tugas harian Anda agar cukup 1 klik dari drawer.
// ============================================================================
export const CREATOR_QUICK_PROMPTS: Array<{
  label: string;
  targetAgentId: string;
  prompt: string;
}> = [
  {
    label: 'Riset Niche Adobe Stock',
    targetAgentId: 'raka',
    prompt:
      'Carikan 5 ide tema foto/ilustrasi AI untuk Adobe Stock yang permintaannya tinggi tetapi persaingannya masih rendah bulan ini, lengkap dengan target pembeli (desainer/bisnis/sosmed).',
  },
  {
    label: 'Skrip FB Reels 30 Detik',
    targetAgentId: 'tari',
    prompt:
      'Buatkan skrip Facebook Reels durasi 30 detik tentang tips/proses kreatif menghasilkan aset digital, lengkap dengan hook 3 detik pertama, isi padat, dan CTA komentar.',
  },
  {
    label: 'Prompt Visual Komersial',
    targetAgentId: 'bima',
    prompt:
      'Buatkan 3 prompt AI image generator detail untuk Adobe Stock tema gaya hidup kerja modern/teknologi bersih (bebas logo/merek dagang, pencahayaan komersial, ruang copy space).',
  },
  {
    label: 'Judul & 49 Keyword Stock',
    targetAgentId: 'sora',
    prompt:
      'Buatkan 1 judul bahasa Inggris optimal SEO Adobe Stock (maks 70 karakter), kategori yang tepat, serta tepat 49 keyword bahasa Inggris diurutkan dari relevansi tertinggi untuk tema: Minimalist Workspace Flatlay.',
  },
  {
    label: 'Ide Video & Thumbnail YT',
    targetAgentId: 'team',
    prompt:
      'Kolaborasi tim: Rancang 1 konsep video YouTube terbaru untuk channel kreator/microstock, mulai dari sudut riset, hook pembuka, konsep thumbnail CTR tinggi, hingga tag SEO.',
  },
];

// ============================================================================
// [GANTI DI SINI] 3. KATALOG ZONA KANTOR HEKSAGONAL
// ============================================================================
export const TILE_CATALOG: Array<{
  type: TileType;
  label: string;
  description: string;
  swatch: string;
}> = [
  {
    type: 'workstation',
    label: 'Meja Produksi',
    description: 'Stasiun editing kreator & riset microstock',
    swatch: '#D8C7AE',
  },
  {
    type: 'meeting',
    label: 'Ruang Pitching',
    description: 'Meja bundar brainstorming konten & review mingguan',
    swatch: '#9EB3C8',
  },
  {
    type: 'lounge',
    label: 'Kafe Studio',
    description: 'Bar espresso untuk memulihkan energi karyawan AI',
    swatch: '#D98A6C',
  },
  {
    type: 'garden',
    label: 'Taman Inspirasi',
    description: 'Area hijau biofilik penambah fokus kreatif',
    swatch: '#78A37E',
  },
  {
    type: 'server',
    label: 'Node Render & NAS',
    description: 'Penyimpanan aset mentah 4K & node pemrosesan AI',
    swatch: '#475569',
  },
  {
    type: 'walkway',
    label: 'Koridor',
    description: 'Lantai teraso jalur jalan antar divisi studio',
    swatch: '#ECE6DA',
  },
];

// ============================================================================
// [GANTI DI SINI] 4. TATA LETAK AWAL PETA HEKSAGON (RADIUS 3 = 37 UBIN)
// Pastikan id ubin meja kerja cocok dengan homeCoord di AGENT_PROFILES.
// ============================================================================
export function createInitialHexMap(): HexTile[] {
  const radius = 3;
  const tiles: HexTile[] = [];

  const overrides = new Map<string, Partial<HexTile>>([
    // Pusat Studio: Ruang Pitching & Review Konten
    ['0,0', { type: 'meeting', label: 'Ruang Pitching Konten', rotationStep: 0 }],
    // Sayap Utara: Node Render & Penyimpanan Aset Microstock
    ['0,-3', { type: 'server', label: 'Server Aset & Render A', rotationStep: 0 }],
    ['1,-3', { type: 'server', label: 'Server Aset & Render B', rotationStep: 0 }],
    ['-1,-2', { type: 'garden', label: 'Taman Utara' }],
    // Meja Raka (Riset & SEO)
    ['-2,0', { type: 'workstation', label: 'Meja Raka (Riset)', assignedAgentId: 'raka', rotationStep: 1 }],
    ['-3,1', { type: 'garden', label: 'Sudut Monstera' }],
    // Meja Tari (Skrip YouTube & FB Reels)
    ['2,-2', { type: 'workstation', label: 'Meja Tari (Skrip & Reels)', assignedAgentId: 'tari', rotationStep: 4 }],
    ['3,-3', { type: 'garden', label: 'Sudut Ficus' }],
    // Meja Bima (Visual & Prompt Adobe Stock)
    ['-2,2', { type: 'workstation', label: 'Meja Bima (Visual AI)', assignedAgentId: 'bima', rotationStep: 2 }],
    ['-1,3', { type: 'lounge', label: 'Sudut Santai' }],
    // Meja Sora (Kurator Metadata & QA)
    ['2,0', { type: 'workstation', label: 'Meja Sora (Metadata QA)', assignedAgentId: 'sora', rotationStep: 5 }],
    // Kafe Studio (Tenggara)
    ['1,2', { type: 'lounge', label: 'Kafe Espresso Studio', rotationStep: 3 }],
    ['0,3', { type: 'garden', label: 'Taman Atrium' }],
    // Dekorasi & Node Cadangan
    ['3,-1', { type: 'garden', label: 'Teras Hijau' }],
    ['-3,3', { type: 'server', label: 'Backup Arsip Video', rotationStep: 2 }],
  ]);

  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      const key = hexKey(q, r);
      const custom = overrides.get(key);
      tiles.push({
        id: key,
        q,
        r,
        type: custom?.type ?? 'walkway',
        label: custom?.label ?? 'Koridor Studio',
        assignedAgentId: custom?.assignedAgentId,
        rotationStep: custom?.rotationStep ?? 0,
      });
    }
  }

  return tiles;
}

export function createInitialAgentStates(): Record<string, AgentRuntimeState> {
  const initialThoughts: Record<string, string> = {
    raka: 'Memantau tren Adobe Stock',
    tari: 'Menulis hook FB Reels',
    bima: 'Meracik prompt visual AI',
    sora: 'Menyusun 49 keyword aset',
  };

  const map: Record<string, AgentRuntimeState> = {};
  for (const agent of AGENT_PROFILES) {
    const world = hexToWorld(agent.homeCoord.q, agent.homeCoord.r);
    map[agent.id] = {
      id: agent.id,
      coord: { ...agent.homeCoord },
      worldX: world.x,
      worldZ: world.z,
      activity: 'working',
      energy: 88 + Math.floor(Math.random() * 10),
      focus: 90 + Math.floor(Math.random() * 9),
      tasksCompleted: 3,
      thoughtBubble: initialThoughts[agent.id] ?? 'Siap menerima tugas',
      currentTask: 'Produksi rutin Microstock & Konten',
    };
  }
  return map;
}
