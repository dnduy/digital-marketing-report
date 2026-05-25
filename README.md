# AI Report Hub — Digital Marketing Auto-Reporting

Hệ thống báo cáo tự động cho admin Digital Marketing. Tự động fetch dữ liệu từ GA4, Google Search Console, Facebook Pages, Google Maps Reviews và WordPress, sau đó tóm tắt bằng AI (Gemini) và gửi Telegram mỗi ngày lúc 08:45 ICT.

---

## 1. Setup local

```bash
git clone <repo-url>
cd ai-report
pnpm install           # hoặc: npm install

cp .env.example .env.local
# Mở .env.local và điền đầy đủ các biến (xem hướng dẫn bên dưới)

pnpm dev               # http://localhost:3000
```

Truy cập `http://localhost:3000` → tự redirect `/login` → đăng nhập bằng `ADMIN_PASSWORD`.

---

## 2. Cách tạo Google Service Account

1. Vào [Google Cloud Console](https://console.cloud.google.com) → IAM & Admin → Service Accounts.
2. Tạo Service Account mới → tạo key JSON.
3. Copy `client_email` vào `GOOGLE_CLIENT_EMAIL`.
4. Copy `private_key` (cả `-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----`) vào `GOOGLE_PRIVATE_KEY`.
5. **Enable các API sau trong project:**
   - [Google Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com)
   - [Search Console API](https://console.cloud.google.com/apis/library/searchconsole.googleapis.com)
   - [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
   - [Places API (New)](https://console.cloud.google.com/apis/library/places-backend.googleapis.com)
6. **Cấp quyền cho Service Account:**
   - GA4: Property → Admin → Account Access Management → Add user (Viewer).
   - GSC: Property → Settings → Users → Add user (Restricted).
   - Sheets: Share spreadsheet với `client_email` (Editor).

---

## 3. Cách lấy Meta Page Access Token

1. Vào [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Chọn App → Generate Access Token → chọn `pages_read_engagement`, `pages_read_user_content`.
3. Lấy **Long-lived Page Access Token** (dùng [Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) để extend).
4. Paste vào env var tương ứng (`META_TOKEN_CHIC`, etc.) đúng với `token_env_key` trong config.

---

## 4. Cách lấy Telegram Chat ID

1. Chat với bot [@userinfobot](https://t.me/userinfobot) trên Telegram.
2. Bot sẽ trả về `Id` của bạn (số âm nếu là group).
3. Paste vào `TELEGRAM_CHAT_ID_CHILLAX` (hoặc tên tương ứng trong config).
4. Lấy Bot Token từ [@BotFather](https://t.me/botfather) → điền vào `TELEGRAM_BOT_TOKEN`.

---

## 5. Cách thêm project mới

1. Mở `lib/config/projects.config.ts`.
2. Thêm object mới vào mảng `projects` theo cấu trúc `ProjectConfig`.
3. Thêm các env var tương ứng vào `.env.local` (và Vercel environment).
4. Tạo Google Sheet mới → cập nhật `google_sheet_id`.

---

## 6. Deploy lên Vercel

```bash
# 1. Push code lên GitHub
git add . && git commit -m "initial setup" && git push

# 2. Import repo vào Vercel: https://vercel.com/new

# 3. Link Vercel KV:
#    Dashboard → Storage → Create KV → Link to project
#    (KV_REST_API_URL, KV_REST_API_TOKEN tự set)

# 4. Thêm tất cả env vars vào Vercel:
#    Project Settings → Environment Variables

# 5. Deploy → verify trong Vercel Logs

# 6. Kiểm tra cron logs:
#    Project → Functions → Cron Jobs
```

### Test cron thủ công:

```bash
# Daily report
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/daily

# Health check
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/health
```

Cron tự chạy:
- **Daily**: `45 1 UTC` = **08:45 ICT** mỗi ngày
- **Health**: mỗi **30 phút**

---

## 7. Troubleshooting

| Lỗi | Nguyên nhân | Giải pháp |
|---|---|---|
| `[env] Missing required environment variable: GOOGLE_PRIVATE_KEY` | Chưa set hoặc thiếu quotes | Bọc giá trị trong dấu `"..."` trong `.env.local` |
| GA4 `PERMISSION_DENIED` | Service account chưa được add vào GA4 property | Vào GA4 Admin → Account Users → add email SA |
| Places API `REQUEST_DENIED` | API chưa enable hoặc key sai | Enable Places API (New) trong Cloud Console |
| Telegram `Bad Request: can't parse entities` | Markdown không hợp lệ | Kiểm tra ký tự `*`, `_` không đóng trong summary |
| `KV_REST_API_URL` missing khi dev local | Chưa link KV | Copy KV env từ Vercel vào `.env.local` hoặc dùng Vercel CLI: `vercel env pull` |
