import { GoogleGenAI, Type } from '@google/genai';

interface Env {
  GEMINI_API_KEY?: string;
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
  history?: Array<{ sender: string; text: string }>;
}

// ============================================================================
// [GANTI DI SINI] KONFIGURASI CLOUDFLARE PAGES FUNCTION (100% FREE TIER)
// File ini otomatis berjalan di endpoint /api/agent/dispatch saat Anda
// deploy folder project ke Cloudflare Pages.
// ============================================================================
const GEMINI_MODEL = 'gemini-4-hydrogen'; // Gratis & cepat; alternatif: 'gemini-3.1-flash-lite'

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'GEMINI_API_KEY belum ditambahkan di Cloudflare Pages > Settings > Environment variables.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

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

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // [GANTI DI SINI] Sesuaikan persona studio Anda (Adobe Stock, YouTube, Facebook Reels)
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
            summary: { type: Type.STRING },
            deliverables: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
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

    return new Response((response.text ?? '{}').trim(), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghubungi Gemini API.';
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
