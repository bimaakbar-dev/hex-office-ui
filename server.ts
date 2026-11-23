import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = 3000;

interface DispatchRequestBody {
  prompt: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  agentSpecialty: string;
  isTeamCollaboration?: boolean;
  history?: Array<{ sender: string; text: string }>;
}

// ============================================================================
// [GANTI DI SINI] KONFIGURASI MODEL & SYSTEM PROMPT STUDIO (SERVER LOKAL / NODE)
// Catatan: Untuk versi Cloudflare Pages Functions, ubah juga file:
// /functions/api/agent/dispatch.ts
// ============================================================================
const GEMINI_MODEL = 'gemini-4-hydrogen'; // Free-tier kuota besar; alternatif: 'gemini-3.1-flash-lite'

app.post('/api/agent/dispatch', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'GEMINI_API_KEY belum dikonfigurasi di panel Settings > Secrets.',
    });
    return;
  }

  const body = req.body as DispatchRequestBody;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    res.status(400).json({ error: 'Instruksi tugas tidak boleh kosong.' });
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // [GANTI DI SINI] Sesuaikan persona & target platform studio Anda
  const systemInstruction = body.isTeamCollaboration
    ? `Kamu adalah tim produksi kreatif studio digital (target: Adobe Stock Microstock, YouTube Channel, dan Facebook Reels) di HexOffice yang terdiri dari 4 karyawan AI:
1. Raka (Riset Tren & SEO — niche Adobe Stock, tren kata kunci, topik viral YouTube & FB Reels)
2. Tari (Penulis Skrip & Hook — skrip YouTube, hook 3 detik FB Reels, caption & CTA)
3. Bima (Direktur Visual & Prompt — prompt gambar/vektor AI bebas merek dagang untuk Adobe Stock & konsep thumbnail YouTube)
4. Sora (Kurator Metadata & QA — judul SEO & 49 keyword Adobe Stock bahasa Inggris, tag YouTube, kepatuhan AI disclosure)

Jawab dalam bahasa Indonesia yang ringkas dan langsung bisa dipakai produksi. Jika ada metadata/prompt/caption siap salin, taruh di field metadataBlock.`
    : `Kamu adalah ${body.agentName}, karyawan AI bagian ${body.agentRole} (${body.agentSpecialty}) di studio kreator & microstock HexOffice (fokus Adobe Stock, YouTube, dan Facebook Reels).
Jawablah instruksi pemilik studio secara tajam, praktis, dan langsung siap dipakai. Untuk metadata/keyword Adobe Stock atau prompt gambar komersial, gunakan bahasa Inggris yang akurat jika diminta dan letakkan teks siap salinnya di metadataBlock.`;

  const conversationContext =
    Array.isArray(body.history) && body.history.length > 0
      ? `Riwayat singkat:\n${body.history
          .slice(-4)
          .map((h) => `${h.sender}: ${h.text}`)
          .join('\n')}\n\n`
      : '';

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `${conversationContext}Instruksi dari pemilik studio:\n${prompt}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'Ringkasan strategi atau hasil kerja karyawan AI (2-4 kalimat jelas).',
            },
            deliverables: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3-5 poin langkah produksi, ide, hook, atau temuan.',
            },
            metadataBlock: {
              type: Type.STRING,
              description:
                'Opsional: teks siap salin (misal 49 keyword Adobe Stock dipisah koma, prompt AI visual, atau caption + hashtag FB Reels). Kosongkan string jika tidak relevan.',
            },
            thoughtBubble: {
              type: Type.STRING,
              description: 'Status sangat singkat (maks 6 kata) di atas kepala karakter 3D.',
            },
            collaboratorId: {
              type: Type.STRING,
              description: 'ID rekan yang diajak sinkronisasi: "raka", "tari", "bima", "sora", atau "none".',
            },
            recommendedZone: {
              type: Type.STRING,
              description: 'Zona kantor tujuan: "workstation", "meeting", atau "server".',
            },
          },
          required: [
            'summary',
            'deliverables',
            'metadataBlock',
            'thoughtBubble',
            'collaboratorId',
            'recommendedZone',
          ],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memproses permintaan ke Gemini API.';
    console.error('Gemini API error:', message);
    res.status(502).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HexOffice Studio running on http://localhost:${PORT}`);
  });
}

startServer();
