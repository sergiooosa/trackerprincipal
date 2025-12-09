const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type AIOptions = {
  timeoutMs?: number;
};

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function sanitizeText(s: string, max = 200_000): string {
  const ss = (s || "").toString();
  if (ss.length > max) return ss.slice(0, max);
  return ss;
}

export async function generateWithGemini(systemPrompt: string, userContent: string, options: AIOptions = {}): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n-----\nCONVERSACIÓN:\n${userContent}` }],
        },
      ],
      generationConfig: {
        temperature: 0.1, // Más determinístico para precisión
        topP: 0.95,
        topK: 40,
      },
    };
    // Usar gemini-2.0-flash-exp para mejor rendimiento
    const resp = await fetchWithTimeout(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=" + GEMINI_API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      options.timeoutMs ?? 45000 // Aumentar timeout
    );
    if (!resp.ok) {
      // Fallback a gemini-1.5-pro si falla
      console.log("[AI] gemini-2.0-flash-exp falló, intentando gemini-1.5-pro...");
      const fallbackResp = await fetchWithTimeout(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=" + GEMINI_API_KEY,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        options.timeoutMs ?? 45000
      );
      if (!fallbackResp.ok) return null;
      const fallbackData = await fallbackResp.json();
      return sanitizeText(fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
    }
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return sanitizeText(text);
  } catch (e) {
    console.error("[AI] Error Gemini:", e);
    return null;
  }
}

export async function generateWithOpenAI(systemPrompt: string, userContent: string, options: AIOptions = {}): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const body = {
      model: "gpt-4o", // Usar GPT-4o completo para mejor razonamiento
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.1, // Más determinístico
      top_p: 0.95,
    };
    const resp = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      },
      options.timeoutMs ?? 45000 // Aumentar timeout
    );
    if (!resp.ok) {
      // Fallback a gpt-4o-mini si falla (costos)
      console.log("[AI] gpt-4o falló, intentando gpt-4o-mini...");
      const fallbackBody = { ...body, model: "gpt-4o-mini" };
      const fallbackResp = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify(fallbackBody),
        },
        options.timeoutMs ?? 45000
      );
      if (!fallbackResp.ok) return null;
      const fallbackData = await fallbackResp.json();
      return sanitizeText(fallbackData?.choices?.[0]?.message?.content ?? "");
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return sanitizeText(text);
  } catch (e) {
    console.error("[AI] Error OpenAI:", e);
    return null;
  }
}

export async function generateResumenIA(prompt: string, transcripcion: string): Promise<string> {
  const gem = await generateWithGemini(prompt, transcripcion);
  if (gem) return gem;
  const oai = await generateWithOpenAI(prompt, transcripcion);
  if (oai) return oai;
  return "";
}

export async function extractObjecionesIA(prompt: string, transcripcion: string): Promise<unknown> {
  const gem = await generateWithGemini(prompt, transcripcion);
  let txt = gem;
  if (!txt) {
    const oai = await generateWithOpenAI(prompt, transcripcion);
    txt = oai;
  }
  if (!txt) return { objeciones: [] };
  // Intentar parsear JSON. Si viene con texto adicional, intentar extraer el primer bloque JSON.
  try {
    const trimmed = txt.trim();
    if (trimmed.startsWith("[")) {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed[0] ?? { objeciones: [] } : parsed;
    }
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed);
    }
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start >= 0 && end > start) {
      const sub = trimmed.slice(start, end + 1);
      const parsed = JSON.parse(sub);
      return Array.isArray(parsed) ? parsed[0] ?? { objeciones: [] } : parsed;
    }
  } catch {
    // ignore
  }
  return { objeciones: [] };
}

export async function generateReporteMarketing(prompt: string, transcripcion: string): Promise<string> {
  const gem = await generateWithGemini(prompt, transcripcion);
  if (gem) return gem;
  const oai = await generateWithOpenAI(prompt, transcripcion);
  if (oai) return oai;
  return "";
}


