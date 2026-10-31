# 全方位健康急救與車禍指南 (Health Emergency & Accident Guide)

本專案為一個整合性的前端網頁工具，旨在協助使用者在面對突發車禍現場、日常傷口包紮、身體不明不適、疼痛穴位按摩以及常備藥品選購時，能快速獲得正確的指引與國際對照。

網頁同時已部署並託管於 GitHub Pages：[健康急救與車禍指南](https://jasminechuang.github.io/health_emergency/)

---

## 🎯 專案目的與特色

* **車禍全攻略**：提供事故現場自保、現場蒐證與保險理賠的完整步驟解析。
* **傷口與關節指引**：依成因與大小對皮膚擦傷、割傷進行分類與處置建議（包含紙張割傷、機車犁田、運動場紅土擦傷等），並涵蓋五十肩（沾黏性肩關節囊炎）與瘀青照護。
* **內科不適與疾病大百科**：涵蓋腸胃炎、發燒感冒、心血管急症（如心肌梗塞、中風）及常見內外科急症說明。
* **疼痛穴位按摩**：提供全身上下各個穴位、指腹特寫與施力對照圖解。
* **慢性病三高專區**：高血壓與糖尿病的日常健康保健與監測指南。
* **常備藥品與多國對照**：收錄超過 20 種常備藥品及對應的海外備用品牌。
* **實用互動工具**：
  * AI 拍照查詢（傷口或藥品智慧分析建議）
  * 身體質量指數（BMI）計算機
  * 全台醫學中心院長與權威醫師一鍵撥號

---

## 🛠️ 技術架構

* **前端介面**：純 HTML / CSS / JavaScript 實作，具備響應式設計與互動導覽視窗。
* **版本控制**：Git / GitHub

---

## 📂 專案檔案結構

```text
health_emergency/
├── 健康急救與車禍指南.html    # 專案主網頁檔案（包含完整急救指南、導覽與互動介面）
└── README.md                # 專案說明文件
```
## 📱 手機版使用方式
1. 線上直接瀏覽：
您可以隨時透過手機瀏覽器點擊上方提供的 GitHub Pages 連結，即可作為日常隨身急救手冊使用。

2. 下載至手機離線使用：
若想在沒有網路的環境下也能隨時查閱，可直接將 健康急救與車禍指南.html 檔案下載至手機儲存空間中，並以手機內建的瀏覽器（如 Safari、Google Chrome）開啟該檔案即可。

## ⚠️ 免責聲明
本平台所提供之所有資料與內容僅供日常健康參考。面對緊急醫療狀況時，請務必立即撥打 119 尋求專業醫療協助。

## Gemini 照片 AI 分析：部署與設定

本專案前端目前託管於 GitHub Pages（純靜態網站，不能執行後端程式）。照片分析端點位於 `api/vision/analyze.js`，需部署至 Vercel Functions；API 金鑰只放在 Vercel 環境變數，絕不可放進網頁程式碼或 Git。

### Gemini 模型與免費層（資料查閱日：2026-10-30）

- 預設使用穩定版多模態模型 `gemini-3.5-flash-lite`，支援圖片輸入。Google 官方目前將它列為新專案可用模型之一，且標示標準層文字／圖片／影片輸入與文字輸出免費。
- 免費層可用模型、RPM／TPM／每日請求數（RPD）會依模型、Google Cloud 專案與帳戶狀態變動。官方沒有保證固定配額；請在 Google AI Studio 的 Rate limits 頁面查詢這個專案的實際數字。超過額度會回傳 429，稍後重試即可。
- 免費層請求內容可能用於改善 Google 產品；付費層資料處理規則不同。本功能不會替使用者啟用付費方案，亦不保證服務永久免費。請勿上傳可識別身分或不願交由 Google 處理的照片。
- 官方資料：[Gemini 模型清單](https://ai.google.dev/gemini-api/docs/models)、[API 定價與免費層](https://ai.google.dev/gemini-api/docs/pricing)、[速率限制與 AI Studio 配額查詢](https://ai.google.dev/gemini-api/docs/rate-limits)、[Gemini API 資料使用政策](https://ai.google.dev/gemini-api/terms)。這些資料會更新，部署前請再確認。

### 老闆設定與部署步驟

1. 在 Google AI Studio 建立或選取專案，建立 Gemini API key；確認專案可使用免費層及 `gemini-3.5-flash-lite`。不要啟用付費方案來解決配額問題。
2. 將此 GitHub repository 匯入 Vercel，使用預設專案設定部署。Vercel 會將 `api/vision/analyze.js` 建成 `/api/vision/analyze` serverless function；本專案前端仍可由 GitHub Pages 提供。
3. 在 Vercel 專案 Settings → Environment Variables 設定：
   - `GEMINI_API_KEY`：AI Studio 的真實 API key（僅伺服器端）。
   - `ALLOWED_ORIGIN`：GitHub Pages 網站來源，例如 `https://jasminechuang.github.io`（只填 origin，不加路徑結尾斜線）。若網站網址不同，填實際 origin。
   - `GEMINI_MODEL`：可不設定；預設為 `gemini-3.5-flash-lite`。若模型被 Google 停用，管理者可改用 AI Studio 中可用且支援圖片的穩定模型名稱。
4. 儲存環境變數並在 Vercel 重新部署。Vercel 部署網址可公開，API key 不可公開。
5. 編輯 `ai-vision-config.js`，將空字串改成 `https://<你的 Vercel 網域>/api/vision/analyze`，再提交／部署 GitHub Pages。這是公開端點 URL，不是密鑰。CORS 端點也必須設定相同的 GitHub Pages origin。
6. 開啟 Vercel Logs 確認沒有設定錯誤；到 Google AI Studio Usage 與 Rate limits 查看使用量。`.env.example` 僅供參照，裡面沒有真實憑證，不要將真實 `.env` 加入版本控制。

### 隱私與檔案處理

- 使用者未勾選 Google Gemini 傳輸同意前，頁面不會呼叫 API；每次選新照片都會清除先前勾選。
- 僅接受 JPG、PNG、WebP；原始檔超過 15 MB 會在瀏覽器拒絕。瀏覽器再將照片縮至最長邊 2048 px 並轉為 JPEG，以符合 Vercel function 的請求大小限制；後端另限制圖片內容約 3 MB。
- 後端不將照片或分析內容寫入磁碟、資料庫或日誌，API 回應設為 `no-store`。照片在本機頁面暫存至離開或更換照片；分析服務的請求只傳送到設定的 Vercel 端點及 Google Gemini。
- Vercel 免費方案和 Gemini 免費層均可能有變動，不能視為無限使用。公開網站的 API 端點可能遭第三方濫用；目前 CORS 只允許設定的網站瀏覽器來源，但 CORS 不是身分驗證。正式公開前建議由管理者在部署平台加上速率限制／濫用防護並監看使用量。

### 手動驗收

1. **未同意**：選一張圖片但不勾同意，按分析；頁面顯示尚未同意，瀏覽器 Network 不應出現 `/api/vision/analyze` 請求。
2. **成功分析**：勾同意並送出有效照片；看到處理狀態、成功結果及非診斷提醒。確認分析文字可讀且沒有 HTML 被執行。
3. **大小／格式錯誤**：選超過 15 MB 檔案、PDF 或其他非圖片；頁面應提示重新選取且不送出。
4. **沒有金鑰**：在 Vercel 暫時移除 `GEMINI_API_KEY` 後重新部署再送出；應顯示管理者需設定金鑰，不應洩漏伺服器細節。測完恢復環境變數並重新部署。
5. **API 錯誤**：以無效金鑰或暫時不可用模型測試，確認頁面提示檢查設定或稍後重試；之後恢復正確設定。
6. **緊急提示與隱私**：確認頁面清楚說明傳至 Google Gemini、網站不保存照片，並提示緊急狀況聯絡當地緊急服務（台灣 119）。
