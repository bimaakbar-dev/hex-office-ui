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
  provider?: 'auto' | 'gemini' | 'groq';
  history?: Array<{ sender: string; text: string }>;
}

// ============================================================================
// [GANTI DI SINI] KONFIGURASI MODEL AI (GEMINI & GROQ FREE TIER)
// Catatan: Untuk versi Cloudflare Pages Functions, ubah juga file:
// /functions/api/agent/dispatch.ts
// ============================================================================
const GEMINI_PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_FALLBACK_MODEL = 'gemini-4-hydrogen';
const GROQ_PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const GROQ_FALLBACK_MODEL = 'llama-3.1-8b-instant';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatUpstreamError(err: unknown): { status: number; message: string; isTransient: boolean } {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  let code = 502;
  let detail = raw;

  try {
    const outer = JSON.parse(raw);
    const inner = typeof outer?.error === 'string' ? JSON.parse(outer.error) : outer?.error ?? outer;
    if (typeof inner?.code === 'number') code = inner.code;
    if (typeof inner?.message === 'string') detail = inner.message;
  } catch {
    if (raw.includes('503') || raw.includes('UNAVAILABLE')) code = 503;
    else if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('rate_limit')) code = 429;
    else if (raw.includes('403') || raw.includes('401') || raw.includes('PERMISSION_DENIED')) code = 403;
    else if (raw.includes('400') || raw.includes('API_KEY_INVALID')) code = 400;
  }

  if (code === 503) {
    return {
      status: 503,
      isTransient: true,
      message:
        'Server AI sedang mengalami lonjakan trafik sementara (503). Klik "Coba Ulang" atau ganti mesin ke Groq.',
    };
  }
  if (code === 429) {
    return {
      status: 429,
      isTransient: true,
      message: 'Batas permintaan sementara (429) tercapai. Tunggu sebentar lalu coba kirim ulang.',
    };
  }
  if (code === 403 || code === 401 || code === 400) {
    return {
      status: code,
      isTransient: false,
      message:
        'API key tidak valid atau belum memiliki izin. Periksa GEMINI_API_KEY / GROQ_API_KEY di panel Secrets.',
    };
  }
  return { status: 502, isTransient: true, message: detail };
}

function buildSystemInstruction(body: DispatchRequestBody): string {
  // [GANTI DI SINI] Sesuaikan persona & target platform studio Anda
  return body.isTeamCollaboration
    ? `Kamu adalah tim produksi kreatif studio digital (target: Adobe Stock Microstock, YouTube Channel, dan Facebook Reels) di HexOffice yang terdiri dari 4 karyawan AI:
1. Raka (Riset Tren & SEO — niche Adobe Stock, tren kata kunci, topik viral YouTube & FB Reels)
2. Tari (Penulis Skrip & Hook — skrip YouTube, hook 3 detik FB Reels, caption & CTA)
3. Bima (Direktur Visual & Prompt — prompt gambar/vektor AI bebas merek dagang untuk Adobe Stock & konsep thumbnail YouTube)
4. Sora (Kurator Metadata & QA — judul SEO & 49 keyword Adobe Stock bahasa Inggris, tag YouTube, kepatuhan AI disclosure)

Jawab dalam bahasa Indonesia yang ringkas dan langsung bisa dipakai produksi. Jika ada metadata/prompt/caption siap salin, taruh di field metadataBlock.`
    : `Kamu adalah ${body.agentName}, karyawan AI bagian ${body.agentRole} (${body.agentSpecialty}) di studio kreator & microstock HexOffice (fokus Adobe Stock, YouTube, dan Facebook Reels).
Jawablah instruksi pemilik studio secara tajam, praktis, dan langsung siap dipakai. Untuk metadata/keyword Adobe Stock atau prompt gambar komersial, gunakan bahasa Inggris yang akurat jika diminta dan letakkan teks siap salinnya di metadataBlock.`;
}

async function callGemini(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userContent: string,
) {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const response = await ai.models.generateContent({
    model,
    contents: userContent,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          deliverables: { type: Type.ARRAY, items: { type: Type.STRING } },
          metadataBlock: { type: Type.STRING },
          thoughtBubble: { type: Type.STRING },
          collaboratorId: { type: Type.STRING },
          recommendedZone: { type: Type.STRING },
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

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return { ...parsed, providerUsed: `Gemini · ${model}` };
}

async function callGroq(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userContent: string,
) {
  const jsonSystem = `${systemInstruction}

WAJIB keluarkan HANYA objek JSON valid dengan skema persis berikut:
{
  "summary": "Ringkasan strategi atau hasil kerja (2-4 kalimat)",
  "deliverables": ["poin 1", "poin 2", "poin 3"],
  "metadataBlock": "Teks siap salin (misal 49 keyword Adobe Stock dipisah koma, prompt AI, atau caption Reels), atau string kosong",
  "thoughtBubble": "Status singkat maks 6 kata di atas kepala karakter 3D",
  "collaboratorId": "raka | tari | bima | sora | none",
  "recommendedZone": "workstation | meeting | server"
}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: jsonSystem },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Groq HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = (data.choices?.[0]?.message?.content ?? '{}')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
  const parsed = JSON.parse(content);
  return { ...parsed, providerUsed: `Groq · ${model}` };
}

app.post('/api/agent/dispatch', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();

  const body = req.body as DispatchRequestBody;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    res.status(400).json({ error: 'Instruksi tugas tidak boleh kosong.' });
    return;
  }

  const providerMode = body.provider ?? 'auto';
  if (providerMode === 'gemini' && !geminiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY belum diatur di Settings > Secrets.' });
    return;
  }
  if (providerMode === 'groq' && !groqKey) {
    res.status(500).json({ error: 'GROQ_API_KEY belum diatur di Settings > Secrets / environment.' });
    return;
  }
  if (!geminiKey && !groqKey) {
    res.status(500).json({
      error: 'Belum ada API key yang aktif. Tambahkan GEMINI_API_KEY atau GROQ_API_KEY di Settings > Secrets.',
    });
    return;
  }

  const systemInstruction = buildSystemInstruction(body);
  const conversationContext =
    Array.isArray(body.history) && body.history.length > 0
      ? `Riwayat singkat:\n${body.history
          .slice(-4)
          .map((h) => `${h.sender}: ${h.text}`)
          .join('\n')}\n\n`
      : '';
  const userContent = `${conversationContext}Instruksi dari pemilik studio:\n${prompt}`;

  type Attempt = { kind: 'gemini' | 'groq'; model: string; delayMs: number };
  const attempts: Attempt[] = [];

  if (providerMode === 'groq' && groqKey) {
    attempts.push(
      { kind: 'groq', model: GROQ_PRIMARY_MODEL, delayMs: 0 },
      { kind: 'groq', model: GROQ_FALLBACK_MODEL, delayMs: 300 },
    );
  } else if (providerMode === 'gemini' && geminiKey) {
    attempts.push(
      { kind: 'gemini', model: GEMINI_PRIMARY_MODEL, delayMs: 0 },
      { kind: 'gemini', model: GEMINI_FALLBACK_MODEL, delayMs: 500 },
      { kind: 'gemini', model: GEMINI_PRIMARY_MODEL, delayMs: 900 },
    );
  } else {
    // Auto failover: try Gemini first if key exists, immediately fail over to Groq if available
    if (geminiKey) {
      attempts.push({ kind: 'gemini', model: GEMINI_PRIMARY_MODEL, delayMs: 0 });
    }
    if (groqKey) {
      attempts.push({ kind: 'groq', model: GROQ_PRIMARY_MODEL, delayMs: 0 });
      attempts.push({ kind: 'groq', model: GROQ_FALLBACK_MODEL, delayMs: 250 });
    }
    if (geminiKey) {
      attempts.push({ kind: 'gemini', model: GEMINI_FALLBACK_MODEL, delayMs: 500 });
      attempts.push({ kind: 'gemini', model: GEMINI_PRIMARY_MODEL, delayMs: 850 });
    }
  }

  let lastError: unknown = null;

  for (const attempt of attempts) {
    if (attempt.delayMs > 0) await sleep(attempt.delayMs);
    try {
      const result =
        attempt.kind === 'groq'
          ? await callGroq(groqKey!, attempt.model, systemInstruction, userContent)
          : await callGemini(geminiKey!, attempt.model, systemInstruction, userContent);
      res.json(result);
      return;
    } catch (err: unknown) {
      lastError = err;
      const info = formatUpstreamError(err);
      if (!info.isTransient && attempts.length === 1) {
        res.status(info.status).json({ error: info.message });
        return;
      }
    }
  }

  const finalErr = formatUpstreamError(lastError);
  console.error(`All AI attempts failed [${finalErr.status}]:`, finalErr.message);
  res.status(finalErr.status).json({ error: finalErr.message });
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
