// Vercel Node.js serverless endpoint. The API key is read only from server environment.
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

function reply(res, status, message, extra = {}) {
  return res.status(status).json({ message, ...extra });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const origin = req.headers.origin;
  if (allowedOrigin && origin && origin !== allowedOrigin) return reply(res, 403, '此網站來源未獲允許。');
  if (origin && (!allowedOrigin || origin === allowedOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin || origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return reply(res, 405, '只接受 POST 請求。');
  if (!process.env.GEMINI_API_KEY) return reply(res, 503, 'AI 服務尚未設定 API 金鑰，請網站管理者完成伺服器設定。');

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return reply(res, 400, '請求資料格式錯誤，請重新選擇照片。'); }
  }
  const { image, mimeType, prompt = '' } = body || {};
  if (!image || typeof image !== 'string' || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return reply(res, 400, '照片格式無效。請使用 JPG、PNG 或 WebP 圖片。');
  }
  const imageBytes = Math.floor(image.length * 3 / 4);
  if (imageBytes > MAX_IMAGE_BYTES || !/^[A-Za-z0-9+/]*={0,2}$/.test(image)) {
    return reply(res, 413, '照片超出伺服器可處理大小，請重新選擇較小的照片。');
  }
  if (typeof prompt !== 'string' || prompt.length > 1000) return reply(res, 400, '補充說明最多 1,000 字元。');

  const instructions = `請以繁體中文分析使用者提供的照片，辨識可見的傷口、皮膚狀況或藥品包裝。只描述可觀察資訊與一般衛教，不要診斷疾病、推測藥品成分或提供處方/劑量。照片不清楚或無法辨識時請直接說明。列出需要儘快就醫的警訊；若可能危及生命，建議立即聯絡當地緊急服務（台灣 119）。明確提醒這不是醫療診斷，應由醫療專業人員評估。${prompt.trim() ? `\n使用者補充：${prompt.trim()}` : ''}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: instructions }, { inline_data: { mime_type: mimeType, data: image } }] }],
        generationConfig: { maxOutputTokens: 700, temperature: 0.2 }
      })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      if (upstream.status === 429) return reply(res, 429, 'Gemini 免費層目前已達流量限制，請稍後再試。管理者可在 Google AI Studio 查看此專案的實際額度。');
      if (upstream.status === 401 || upstream.status === 403) return reply(res, 503, 'Gemini API 金鑰無效或此專案尚無模型使用權限，請網站管理者檢查設定。');
      if (upstream.status === 404) return reply(res, 503, '目前設定的 Gemini 模型不可用，請管理者檢查 GEMINI_MODEL。');
      console.error('Gemini request failed', upstream.status, data?.error?.status || 'unknown');
      return reply(res, 502, 'Gemini 暫時無法完成分析，請稍後重試。');
    }
    const result = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!result) return reply(res, 502, 'Gemini 沒有回傳可顯示的分析內容，請稍後重試。');
    return reply(res, 200, '分析完成。', { result });
  } catch (error) {
    if (error.name === 'AbortError') return reply(res, 504, '分析逾時，請稍後重試。');
    console.error('Gemini request error', error.name);
    return reply(res, 502, '無法連線至 Gemini，請稍後重試。');
  } finally {
    clearTimeout(timeout);
  }
};
