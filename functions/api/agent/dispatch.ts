import { GoogleGenAI, Type } from '@google/genai';

interface Env {
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

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
// [GANTI DI SINI] KONFIGURASI CLOUDFLARE PAGES FUNCTION (100% FREE TIER)
// Mendukung GEMINI_API_KEY & GROQ_API_KEY secara otomatis.
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
        'Server AI sedang mengalami lonjakan trafik sementara (503). Klik "Coba Ulang" atau pilih mesin Groq.',
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
        'API key tidak valid atau belum memiliki izin. Periksa GEMINI_API_KEY / GROQ_API_KEY di Cloudflare Pages > Settings > Variables and Secrets.',
    };
  }
  return { status: 502, isTransient: true, message: detail };
}

function buildSystemInstruction(body: DispatchRequestBody): string {
  // [GANTI DI SINI] Sesuaikan persona studio Anda (Adobe Stock, YouTube, Facebook Reels)
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

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const geminiKey = context.env.GEMINI_API_KEY?.trim();
  const groqKey = context.env.GROQ_API_KEY?.trim();

  let body: DispatchRequestBody;
  try {
    body = (await context.request.json()) as DispatchRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Format JSON tidak valid.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Instruksi tugas tidak boleh kosong.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const providerMode = body.provider ?? 'auto';
  if (providerMode === 'gemini' && !geminiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY belum ditambahkan di Cloudflare Pages > Variables and Secrets.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (providerMode === 'groq' && !groqKey) {
    return new Response(
      JSON.stringify({ error: 'GROQ_API_KEY belum ditambahkan di Cloudflare Pages > Variables and Secrets.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (!geminiKey && !groqKey) {
    return new Response(
      JSON.stringify({
        error: 'Tambahkan GEMINI_API_KEY atau GROQ_API_KEY di Cloudflare Pages > Settings > Variables and Secrets.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
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
    );
  } else {
    if (geminiKey) attempts.push({ kind: 'gemini', model: GEMINI_PRIMARY_MODEL, delayMs: 0 });
    if (groqKey) {
      attempts.push({ kind: 'groq', model: GROQ_PRIMARY_MODEL, delayMs: 0 });
      attempts.push({ kind: 'groq', model: GROQ_FALLBACK_MODEL, delayMs: 250 });
    }
    if (geminiKey) attempts.push({ kind: 'gemini', model: GEMINI_FALLBACK_MODEL, delayMs: 400 });
  }

  let lastError: unknown = null;

  for (const attempt of attempts) {
    if (attempt.delayMs > 0) await sleep(attempt.delayMs);
    try {
      const result =
        attempt.kind === 'groq'
          ? await callGroq(groqKey!, attempt.model, systemInstruction, userContent)
          : await callGemini(geminiKey!, attempt.model, systemInstruction, userContent);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: unknown) {
      lastError = err;
    }
  }

  const finalErr = formatUpstreamError(lastError);
  return new Response(JSON.stringify({ error: finalErr.message }), {
    status: finalErr.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
