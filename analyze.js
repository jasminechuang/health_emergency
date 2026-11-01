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
  const { image, mimeType, prompt = '', mode = 'symptom', age = '' } = body || {};
  if (typeof prompt !== 'string' || prompt.length > 1000) return reply(res, 400, '補充說明最多 1,000 字元。');
  if (typeof age !== 'string' || age.length > 40) return reply(res, 400, '年齡層資料無效。');
  const hasImage = typeof image === 'string' && image.length > 0;
  if (!hasImage && !prompt.trim()) return reply(res, 400, '請提供照片或症狀描述。');
  if (hasImage) {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) return reply(res, 400, '照片格式無效。請使用 JPG、PNG 或 WebP 圖片。');
    const imageBytes = Math.floor(image.length * 3 / 4);
    if (imageBytes > MAX_IMAGE_BYTES || !/^[A-Za-z0-9+/]*={0,2}$/.test(image)) {
      return reply(res, 413, '照片超出伺服器可處理大小，請重新選擇較小的照片。');
    }
  }

  const MODE_TEXT = {
    symptom: '分析類型：身體症狀、皮膚、傷口或其他不適。',
    medicine: '分析類型：藥膏或藥品包裝。',
    both: '分析類型：症狀，並評估使用者提到或照片中的藥膏是否大致適合。'
  };
  const safeMode = MODE_TEXT[mode] ? mode : 'symptom';
  const common = `你是提供一般衛教的健康資訊助理，請一律以繁體中文、使用 Markdown（### 小標題、* 項目符號、**粗體**）回答，語氣清楚、友善、不嚇人。
${MODE_TEXT[safeMode]}${age ? `\n患者年齡層：${age}。請依此年齡層調整建議；新生兒、嬰幼兒、孕婦與高齡者要特別提醒更低的就醫門檻。` : ''}
【安全原則】
- 你不是醫師，不做確定診斷，不開處方。可用「常見可能原因」「可能與…有關」等不確定語氣說明。
- 不提供任何藥物的具體劑量、次數、療程天數；使用方式一律以藥品包裝、仿單或醫師藥師指示為準。
- 照片不清楚或資訊不足時，直接說明並列出需要補充的資訊。
- 一定要列出「需要儘快就醫的警訊」；若可能危及生命（呼吸困難、意識改變、嚴重出血、胸痛、中風徵象、嚴重過敏、新生兒發燒等），第一段就建議立即撥打 119。
- 結尾固定提醒：這不是醫療診斷，應由醫療專業人員評估。`;
  const symptomFormat = `
【症狀分析請依序包含】
### 1. 觀察到／聽到的重點（部位、外觀、範圍、顏色、症狀持續時間）
### 2. 常見可能原因（列 2–4 項，由較常見到較需留意，並說明各自的特徵）
### 3. 居家照護與處理
### 4. 讓症狀改善的方法（請針對最可能的原因，具體說明）
* **非藥物方式**：冷敷／熱敷、保濕、避免誘發因素、清潔與包紮等。
* **常見的非處方（成藥）藥膏或藥品類型**：可說明「類型」與常見成分名稱（例如：抗黴菌藥膏、氧化鋅護膚膏、保濕乳霜、局部抗組織胺或止癢產品、傷口護理敷料、含水楊酸的痘痘產品…），並說明各自適用於哪種情況、不適用於哪種情況。
* **需要醫師評估才能使用的藥物**（例如類固醇藥膏、處方抗生素）：只說明「可能需要醫師處方」，不要指示使用者自行購買或使用。
* **年齡與特殊族群限制**：新生兒、嬰幼兒、孕婦或哺乳中、高齡者、慢性病患者，不建議自行用藥，請先詢問醫師或藥師。
* 不提供任何劑量、次數、用藥天數；使用方式以包裝、仿單及藥師或醫師指示為準。
* 說明「若多久沒有改善或變嚴重就應就醫」（用時間範圍說明，例如兩到三天沒改善）。
### 5. 需要儘快就醫的警訊
### 6. 建議就診科別`;
  const medicineFormat = `
【藥膏／藥品分析請依序包含】
### 1. 辨識到的藥品資訊（只根據包裝上可見的文字：品名、成分、適應症、廠牌；看不清楚就明說，不要猜測）
### 2. 這類藥品一般用在哪些情況（依成分的一般用途說明，例如抗生素藥膏、類固醇藥膏、抗黴菌藥膏、保濕或傷口護理產品）
### 3. 使用前須知與注意事項（不適合的情況、不能擦的部位如眼睛與黏膜、長期使用的風險、嬰幼兒／孕婦／高齡者注意，類固醇藥膏尤其要提醒不要自行長期使用於臉部與皺褶處與嬰幼兒）
### 4. 與使用者描述的症狀是否大致合適（若有提供症狀；不確定時請建議詢問醫師或藥師）
### 5. 何時應停用並就醫（出現紅腫加劇、過敏、無改善等）
使用方式與劑量請以包裝、仿單及藥師或醫師指示為準。`;
  const format = safeMode === 'medicine' ? medicineFormat : safeMode === 'both' ? symptomFormat + '\n' + medicineFormat : symptomFormat;
  const userText = prompt.trim() ? `\n【使用者描述】${prompt.trim()}` : '';
  const instructions = `${common}${format}${hasImage ? '' : '\n（本次沒有照片，僅依文字描述分析，請特別說明文字描述的限制。）'}${userText}`;
  const parts = [{ text: instructions }];
  if (hasImage) parts.push({ inline_data: { mime_type: mimeType, data: image } });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: 1800, temperature: 0.2 }
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
