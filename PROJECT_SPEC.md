# 🚀 MASTER PROJECT SPECIFICATION
## Digital Marketing Auto-Reporting Hub (Multi-Project / Multi-Source)

> **Audience:** GitHub Copilot / Claude Code / Cursor AI
> **Role:** Senior Fullstack Developer
> **Deliverable:** Codebase chạy được trên Vercel ngay sau khi `vercel deploy`, không cần sửa logic.

---

## 0. EXECUTION CONTRACT (đọc trước khi code)

Khi đọc spec này, AI **PHẢI**:

1. Tạo đầy đủ folder structure ở mục §9.
2. Code tất cả file `.ts` / `.tsx` được liệt kê — **không để file trống**, không để `// TODO`.
3. Mỗi module trong `lib/api/*.ts` phải có:
   - Interface DTO định nghĩa rõ ở đầu file
   - Hàm `fetchXxxForProject(project: ProjectConfig)` trả về `Promise<XxxResult>`
   - Bọc `Promise.allSettled` khi loop nhiều source
   - Log lỗi qua `console.error(`[${moduleName}]`, err)` nhưng **không throw ra ngoài**
4. Tất cả type phải strict — **cấm dùng `any`**, nếu unknown thì dùng `unknown` rồi narrow.
5. Mọi `process.env.X` truy cập qua helper `lib/env.ts` để fail-fast nếu thiếu biến.
6. Build phải pass `pnpm build` (hoặc `npm run build`) **không có warning TypeScript**.

---

## 1. PROJECT OVERVIEW

Hệ thống Web App + Cronjob nội bộ (internal tool) cho admin Digital Marketing. Tính năng:

| Module | Mô tả |
|---|---|
| **Multi-Project Config** | 1 file config khai báo N dự án; mỗi dự án có N website, N fanpage, N Google Map place |
| **Daily Cronjob** | Mỗi ngày 08:45 AM (Asia/Ho_Chi_Minh) tự fetch data 24h qua → so sánh với state hôm trước → AI summarize → gửi Telegram → log vào Google Sheets |
| **Health Check Cronjob** | Mỗi 30 phút ping toàn bộ website domain, alert Telegram nếu down |
| **Web Dashboard** | Login bằng password, xem metric latest theo project, tải Excel |
| **AI Summary** | Gemini 1.5 Flash tạo báo cáo Markdown |

---

## 2. TECH STACK (lock version)

```json
{
  "next": "14.2.x",
  "react": "18.3.x",
  "typescript": "5.4.x",
  "tailwindcss": "3.4.x",
  "@vercel/kv": "^2.0.0",
  "googleapis": "^144.0.0",
  "axios": "^1.7.0",
  "jose": "^5.6.0",
  "xlsx": "^0.18.5",
  "lucide-react": "^0.400.0",
  "@google/generative-ai": "^0.16.0"
}
```

- **UI components:** Shadcn UI (chỉ cài: button, card, table, tabs, input, label, toast)
- **Runtime cho cron routes:** `export const runtime = 'nodejs'` (bắt buộc, vì googleapis không chạy edge)
- **Runtime cho dashboard pages:** mặc định
- **Package manager:** pnpm (ưu tiên), npm fallback

---

## 3. CORE DATA MODEL

### 3.1. ProjectConfig (file `lib/config/projects.config.ts`)

```typescript
export interface FacebookPage {
  id: string;                // Facebook Page ID (numeric string)
  name: string;              // Display name
  token_env_key: string;     // Tên biến env chứa Page Access Token, vd: "META_TOKEN_CHIC"
}

export interface GoogleMapPlace {
  id: string;                // Google Place ID (vd: "ChIJN1t_tDeuEmsRUsoyG83frY4")
  name: string;
}

export interface WebsiteData {
  domain: string;            // "chillax.com.vn" (không có https://)
  wp_api_url?: string;       // Full URL tới WP REST endpoint posts
  ga4_property_id?: string;  // numeric, vd "123456789"
  gsc_url?: string;          // "https://chillax.com.vn/" (đúng property GSC)
}

export interface AdsAccount {
  google_ads_id?: string;
  meta_ads_id?: string;
}

export interface ProjectConfig {
  id: string;                // slug, dùng làm KV key, vd "chillax"
  name: string;              // Display name trong Telegram & Dashboard
  telegram_chat_id_env_key: string;  // Tên env var, KHÔNG hardcode chat ID
  google_sheet_id: string;
  sources: {
    websites: WebsiteData[];
    facebook_pages: FacebookPage[];
    google_maps_places: GoogleMapPlace[];
    ads_accounts?: AdsAccount;
  };
}

export const projects: ProjectConfig[] = [
  // Sample đã có sẵn trong spec gốc — giữ nguyên ví dụ Chillax/Hoi An Chic
];
```

### 3.2. KV State Schema

**Key pattern:** `state:{project.id}`
**Value:** JSON object — lưu mọi thứ cần so sánh ngày-qua-ngày.

```typescript
export interface ProjectState {
  project_id: string;
  last_run_at: string;       // ISO timestamp
  websites: {
    [domain: string]: {
      sessions_yesterday: number;
      clicks_yesterday: number;
      impressions_yesterday: number;
      last_wp_post_id?: number;  // ID bài WP mới nhất đã thấy
    };
  };
  facebook_pages: {
    [page_id: string]: {
      last_post_id?: string;
      last_comment_ids: string[];  // tối đa 50 ID gần nhất để dedupe
    };
  };
  google_maps_places: {
    [place_id: string]: {
      last_review_ids: string[];   // tối đa 50 review ID
      rating: number;
      total_reviews: number;
    };
  };
}
```

**Logic so sánh "cái gì là mới":**

- **WP post mới:** `post.id > state.last_wp_post_id`
- **FB comment mới:** `comment.id NOT IN state.last_comment_ids`
- **GMB review mới:** `review.reviewId NOT IN state.last_review_ids`
- **Sessions delta:** `((today - yesterday) / yesterday) * 100`, làm tròn 1 chữ số thập phân; nếu yesterday = 0 thì trả về `null` (UI hiển thị "—")

### 3.3. Google Sheets Schema

Mỗi project = 1 Spreadsheet riêng. Trong đó:

**Sheet "DailyLog"** — header row 1:
```
Date | ProjectID | Website | Sessions | Conversions | Clicks | Impressions | CTR | NewWPPosts | NewFBPosts | NewFBComments | NewGMBReviews | AvgRating
```

**Sheet "Alerts"** — header row 1:
```
Timestamp | ProjectID | Type | Source | Message
```
(dùng cho health check + lỗi cron)

→ Hàm `lib/db/sheets.ts` phải có 2 method: `appendDailyLog(rows)` và `appendAlert(row)`. Nếu sheet chưa tồn tại, tự tạo sheet và ghi header.

---

## 4. DATA EXTRACTION MODULES

Mỗi module ở `lib/api/*.ts` export theo pattern:

```typescript
// Output DTO
export interface Ga4Result {
  property_id: string;
  sessions: number;
  conversions: number;
  error?: string;
}

// Hàm chính
export async function fetchGa4ForProject(
  project: ProjectConfig
): Promise<Ga4Result[]> {
  const targets = project.sources.websites.filter(w => w.ga4_property_id);
  const settled = await Promise.allSettled(
    targets.map(w => fetchSingleGa4(w.ga4_property_id!))
  );
  return settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    console.error(`[ga4] failed for ${targets[i].domain}`, s.reason);
    return {
      property_id: targets[i].ga4_property_id!,
      sessions: 0,
      conversions: 0,
      error: String(s.reason)
    };
  });
}
```

### 4.1. `lib/api/ga4.ts`
- Dùng `googleapis` package, scope: `https://www.googleapis.com/auth/analytics.readonly`
- Service account auth từ `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`
- Metric: `sessions`, `conversions`; date range: `yesterday` to `yesterday`

### 4.2. `lib/api/gsc.ts`
- Scope: `https://www.googleapis.com/auth/webmasters.readonly`
- Metric: `clicks`, `impressions`, `ctr`, `position`; date range: 2 ngày trước (vì GSC delay)

### 4.3. `lib/api/meta.ts`
- Graph API v20.0
- Endpoint posts: `GET /{page-id}/posts?fields=id,message,created_time&since={unix}`
- Endpoint comments: với mỗi post mới, fetch `/{post-id}/comments?fields=id,from,message,created_time`
- Token đọc từ `process.env[page.token_env_key]`

### 4.4. `lib/api/places.ts`
- Google Places API New (v1) — endpoint: `https://places.googleapis.com/v1/places/{place_id}`
- Field mask: `displayName,rating,userRatingCount,reviews`
- API key: `GOOGLE_MAPS_API_KEY`
- Reviews trả về tối đa 5 cái gần nhất; so sánh `reviewId` với KV state để lọc cái mới

### 4.5. `lib/api/wordpress.ts`
- Endpoint: `{wp_api_url}?after={ISO_yesterday}&per_page=20&_fields=id,title,link,date`
- Public API, không cần auth (giả định site cho phép REST API public — nếu cần auth, để TODO comment)

---

## 5. CRONJOB WORKFLOWS

### 5.1. `/app/api/cron/daily/route.ts`

```typescript
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 phút, đủ cho ~10 projects

export async function GET(req: Request) {
  // 1. Verify CRON_SECRET
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Loop từng project (sequential, không Promise.all toàn bộ vì sẽ vượt rate limit)
  const results = [];
  for (const project of projects) {
    try {
      const result = await runDailyForProject(project);
      results.push({ project: project.id, ok: true, ...result });
    } catch (err) {
      console.error(`[daily] ${project.id} failed`, err);
      results.push({ project: project.id, ok: false, error: String(err) });
      // Vẫn tiếp tục project tiếp theo
    }
  }
  return Response.json({ success: true, results });
}
```

**Hàm `runDailyForProject(project)`** ở `lib/workflows/daily.ts`, các bước:

| Step | Action |
|---|---|
| 1 | `getProjectState(project.id)` từ KV |
| 2 | `Promise.all([fetchGa4..., fetchGsc..., fetchMeta..., fetchPlaces..., fetchWp...])` (vì các API độc lập) |
| 3 | Diff với state → tính `newReviews`, `newComments`, `newWpPosts`, `trafficDeltaPercent` |
| 4 | Build prompt → gọi `generateGeminiSummary(payload)` |
| 5 | `sendTelegramMessage(chatId, markdown)` |
| 6 | `appendDailyLog(rows)` cho từng website |
| 7 | `setProjectState(project.id, newState)` |

### 5.2. `/app/api/cron/health/route.ts`

```typescript
export const runtime = 'nodejs';
export const maxDuration = 60;

// Logic:
// - Loop projects → loop websites
// - fetch(`https://${domain}`, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
// - Nếu status !== 200-399 hoặc timeout → gửi Telegram alert + appendAlert vào sheet
// - Throttle: chờ 200ms giữa các request để không spam target
```

### 5.3. `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/daily", "schedule": "45 1 * * *" },
    { "path": "/api/cron/health", "schedule": "*/30 * * * *" }
  ]
}
```

> **Note:** Vercel cron chạy theo UTC. `45 1 UTC` = `08:45 ICT (UTC+7)`.

---

## 6. AI SUMMARIZATION (`lib/ai/gemini.ts`)

### 6.1. Input payload (TypeScript)

```typescript
export interface DailySummaryInput {
  project_name: string;
  date: string; // YYYY-MM-DD
  websites: Array<{
    domain: string;
    sessions: number;
    sessions_delta_percent: number | null;
    conversions: number;
    clicks: number;
    impressions: number;
    new_wp_posts: Array<{ title: string; link: string }>;
  }>;
  facebook: Array<{
    page_name: string;
    new_posts_count: number;
    new_comments: Array<{ author: string; message: string; post_id: string }>;
  }>;
  google_maps: Array<{
    place_name: string;
    rating: number;
    total_reviews: number;
    new_reviews: Array<{ author: string; rating: number; text: string }>;
  }>;
  errors: Array<{ source: string; message: string }>;
}
```

### 6.2. Prompt template (hardcode trong file)

```
Bạn là chuyên gia phân tích Digital Marketing. Dưới đây là dữ liệu 24h qua của dự án "{project_name}" ngày {date}.

DỮ LIỆU JSON:
{json_payload}

YÊU CẦU:
- Viết báo cáo Markdown bằng tiếng Việt, dùng emoji phù hợp.
- Cấu trúc CỐ ĐỊNH:

📊 *BÁO CÁO {PROJECT_NAME} - {DATE}*

🌐 *Website*
- (mỗi domain 1 dòng: sessions, delta %, conversions, clicks, impressions)
- Bài mới: liệt kê title + link

📱 *Facebook*
- (mỗi page: số post mới, số comment mới đáng chú ý)
- Comment cần phản hồi: trích nguyên văn 2-3 comment quan trọng nhất

📍 *Google Maps*
- (mỗi địa điểm: rating hiện tại, tổng review, review mới)
- Highlight review tiêu cực (≤3 sao) nếu có

⚠️ *Cảnh báo / Lỗi*
- (chỉ ghi nếu có; nếu errors[] rỗng thì bỏ section này)

💡 *Đề xuất hành động*
- 2-3 gạch đầu dòng ngắn gọn, actionable, ưu tiên theo độ khẩn cấp.

QUY TẮC:
- KHÔNG bịa số liệu ngoài JSON.
- KHÔNG dùng từ chung chung như "tăng nhẹ" — phải nêu con số cụ thể.
- Độ dài tối đa 1500 ký tự (giới hạn Telegram đẹp).
- Dùng *italic* và `code` markdown thay vì **bold** (Telegram MarkdownV1 không hỗ trợ bold kiểu **).
```

### 6.3. Hàm export

```typescript
export async function generateGeminiSummary(
  input: DailySummaryInput
): Promise<string> {
  // model: 'gemini-1.5-flash-latest'
  // temperature: 0.4
  // Trả về plain Markdown string
  // Nếu API fail → fallback: tự build markdown từ payload bằng template cứng
}
```

---

## 7. TELEGRAM (`lib/notifications/telegram.ts`)

```typescript
export async function sendTelegramMessage(
  chatId: string,
  markdown: string
): Promise<void> {
  // POST https://api.telegram.org/bot{TOKEN}/sendMessage
  // body: { chat_id, text, parse_mode: 'Markdown', disable_web_page_preview: true }
  // Nếu text > 4000 chars → split theo dòng và gửi nhiều message
  // Retry tối đa 2 lần nếu lỗi 5xx
}

export async function sendTelegramAlert(
  chatId: string,
  emoji: string,
  title: string,
  detail: string
): Promise<void> {
  // Format: `${emoji} *${title}*\n\n${detail}`
}
```

---

## 8. WEB DASHBOARD

### 8.1. `/app/login/page.tsx`
- Form: 1 input password + submit button
- POST tới `/api/auth` → nếu OK, server set HTTP-only cookie `auth_token` (JWT ký bằng `JWT_SECRET`, expire 7 ngày)
- Redirect về `/dashboard`

### 8.2. `/app/api/auth/route.ts`
- Method POST: nhận `{ password }`, so sánh với `ADMIN_PASSWORD` (timing-safe compare), ký JWT bằng `jose`
- Method DELETE: clear cookie (logout)

### 8.3. `/middleware.ts`
- Match `/dashboard/:path*` và `/api/export/:path*`
- Verify JWT từ cookie; nếu invalid → redirect `/login`
- **KHÔNG** match route `/api/cron/*` (cron dùng Bearer token riêng)

### 8.4. `/app/dashboard/page.tsx`
- Server component lấy danh sách projects từ config
- Render Tabs (Shadcn) — mỗi tab là 1 project
- Trong mỗi tab: 3 Card (Website / Facebook / Maps) hiển thị data từ KV state
- 1 button "Export Excel" gọi `/api/export?project={id}`
- 1 button "Logout" gọi `DELETE /api/auth`

### 8.5. `/app/api/export/route.ts`
- Query param: `?project={id}`
- Fetch toàn bộ data từ Google Sheet của project đó
- Dùng `xlsx` build file → return với header `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` và `Content-Disposition: attachment; filename="{project_id}-{date}.xlsx"`

---

## 9. FOLDER STRUCTURE (đầy đủ — Copilot phải tạo hết)

```
/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          # Redirect → /dashboard hoặc /login
│   ├── globals.css
│   ├── login/
│   │   └── page.tsx
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── _components/
│   │       ├── ProjectTabs.tsx
│   │       ├── WebsiteCard.tsx
│   │       ├── FacebookCard.tsx
│   │       ├── MapsCard.tsx
│   │       └── ExportButton.tsx
│   └── api/
│       ├── auth/route.ts
│       ├── export/route.ts
│       └── cron/
│           ├── daily/route.ts
│           └── health/route.ts
├── lib/
│   ├── env.ts                            # Type-safe env access
│   ├── config/
│   │   └── projects.config.ts
│   ├── types/
│   │   └── index.ts                      # Re-export tất cả interface chung
│   ├── api/
│   │   ├── ga4.ts
│   │   ├── gsc.ts
│   │   ├── meta.ts
│   │   ├── places.ts
│   │   └── wordpress.ts
│   ├── db/
│   │   ├── kv.ts                         # getProjectState / setProjectState
│   │   └── sheets.ts                     # appendDailyLog / appendAlert / readAll
│   ├── ai/
│   │   └── gemini.ts
│   ├── notifications/
│   │   └── telegram.ts
│   ├── workflows/
│   │   ├── daily.ts                      # runDailyForProject
│   │   └── health.ts                     # runHealthCheckForProject
│   └── utils/
│       ├── auth.ts                       # JWT sign/verify
│       └── date.ts                       # getYesterdayRange (Asia/Ho_Chi_Minh)
├── components/ui/                        # Shadcn components
│   ├── button.tsx
│   ├── card.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   ├── input.tsx
│   └── label.tsx
├── middleware.ts
├── vercel.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 10. ENVIRONMENT VARIABLES (`.env.example`)

```env
# === Security ===
ADMIN_PASSWORD=changeme-strong-password-here
JWT_SECRET=use-openssl-rand-base64-32
CRON_SECRET=use-openssl-rand-base64-32

# === Vercel KV (auto-set khi link Vercel KV) ===
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=

# === Google Service Account (cho GA4, GSC, Sheets) ===
GOOGLE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# Lưu ý: \n thật trong giá trị, KHÔNG escape

# === Google Maps Places API ===
GOOGLE_MAPS_API_KEY=

# === Meta / Facebook (mỗi page 1 token, đặt tên trùng với token_env_key trong config) ===
META_TOKEN_CHIC=
META_TOKEN_HOIAN=

# === AI ===
GEMINI_API_KEY=

# === Telegram ===
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID_CHILLAX=
TELEGRAM_CHAT_ID_MIRA=
```

---

## 11. ERROR HANDLING & LOGGING PATTERN

**Quy ước log prefix:**
- `[ga4]`, `[gsc]`, `[meta]`, `[places]`, `[wp]` — module API
- `[daily:{project_id}]`, `[health:{project_id}]` — workflow
- `[telegram]`, `[sheets]`, `[kv]` — infrastructure

**Mỗi catch block phải:**
1. `console.error('[module]', context, error)`
2. Gọi `appendAlert({ type: 'error', source: 'module', message: ... })` nếu là lỗi nghiêm trọng
3. KHÔNG re-throw nếu đang trong vòng lặp multi-source (graceful degradation)
4. CÓ throw nếu là lỗi fatal toàn project (vd: không lấy được Google Auth)

---

## 12. ACCEPTANCE CRITERIA (Definition of Done)

Code được coi là HOÀN THÀNH khi:

- [ ] `pnpm install && pnpm build` chạy không lỗi, không warning TS
- [ ] `pnpm dev` mở `http://localhost:3000` → redirect `/login` → đăng nhập được
- [ ] Sau login, `/dashboard` hiển thị tabs cho tất cả project trong config
- [ ] Gọi tay `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily` → response 200, có log chi tiết từng project, Telegram nhận được message, Google Sheet có dòng mới
- [ ] Gọi tay `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/health` → response 200
- [ ] Tắt 1 token Meta giả lập (đổi env sai) → cron daily vẫn chạy xong cho các source khác, có log lỗi đỏ cho Meta
- [ ] Click "Export Excel" → tải về file `.xlsx` hợp lệ mở được bằng Excel
- [ ] Đăng xuất → cookie bị clear, vào `/dashboard` redirect lại `/login`
- [ ] `vercel.json` có 2 cron entry đúng format
- [ ] `README.md` hướng dẫn setup từ `git clone` → `vercel deploy` trong 10 phút

---

## 13. README.md (Copilot sinh nội dung tối thiểu)

README phải có các section:
1. **Mô tả ngắn** dự án
2. **Setup local:** clone, cài đặt, copy `.env.example` → `.env.local`, fill env, `pnpm dev`
3. **Cách tạo Google Service Account** (link tới docs official + scope cần enable)
4. **Cách lấy Meta Page Token** (link tới Graph API Explorer)
5. **Cách lấy Telegram Chat ID** (chat với @userinfobot)
6. **Cách thêm project mới:** edit `lib/config/projects.config.ts` + thêm env var tương ứng
7. **Deploy lên Vercel:** link KV, set env, push code, verify cron logs
8. **Troubleshooting:** 3-5 lỗi thường gặp (private key escape, GA4 permission, Places API not enabled)

---

## 14. STRICT CODING RULES (nhắc lại để Copilot không quên)

| # | Rule |
|---|---|
| 1 | TypeScript strict, **cấm `any`**, dùng `unknown` + type guard |
| 2 | Mọi `process.env.X` phải qua `lib/env.ts` (fail-fast nếu missing required) |
| 3 | `Promise.allSettled` khi loop multi-source — log lỗi, không sập |
| 4 | Cron route: verify `Authorization: Bearer {CRON_SECRET}` ở dòng đầu tiên |
| 5 | Route handler ≤ 30 dòng — logic ở `lib/workflows/*` |
| 6 | Không hardcode chat_id, token, sheet_id — luôn qua env |
| 7 | Mọi async function có return type tường minh: `Promise<XxxType>` |
| 8 | Sheets API: dùng `valueInputOption: 'USER_ENTERED'` để format số đẹp |
| 9 | JWT cookie: `httpOnly: true, secure: true (in prod), sameSite: 'lax'` |
| 10 | Mỗi file ≤ 250 dòng — vượt thì tách module con |

---

## 15. SAMPLE DATA cho `projects.config.ts` (Copilot dùng làm seed)

```typescript
export const projects: ProjectConfig[] = [
  {
    id: 'chillax',
    name: 'Hệ thống Chillax & Hoi An Chic',
    telegram_chat_id_env_key: 'TELEGRAM_CHAT_ID_CHILLAX',
    google_sheet_id: 'YOUR_SHEET_ID_HERE',
    sources: {
      websites: [
        {
          domain: 'chillax.com.vn',
          wp_api_url: 'https://chillax.com.vn/wp-json/wp/v2/posts',
          ga4_property_id: '123456789',
          gsc_url: 'https://chillax.com.vn/'
        },
        {
          domain: 'hoianchic.com',
          wp_api_url: 'https://hoianchic.com/wp-json/wp/v2/posts',
          ga4_property_id: '987654321',
          gsc_url: 'https://hoianchic.com/'
        }
      ],
      facebook_pages: [
        { id: '100000000000001', name: 'Chillax Eatery', token_env_key: 'META_TOKEN_CHIC' },
        { id: '100000000000002', name: 'Hoi An Chic Hotel', token_env_key: 'META_TOKEN_HOIAN' }
      ],
      google_maps_places: [
        { id: 'ChIJxxxxxxxxxxxxxxxx', name: 'Chillax Eatery Hoi An' },
        { id: 'ChIJyyyyyyyyyyyyyyyy', name: 'Hoi An Chic Hotel' }
      ]
    }
  }
  // Thêm project khác ở đây
];
```

---

## 16. FINAL CHECKLIST cho Copilot

Trước khi báo "DONE", AI phải verify từng dòng:

1. [ ] Tất cả file trong §9 đã được tạo và có code thực sự (không chỉ có khai báo).
2. [ ] `tsconfig.json` có `"strict": true`, `"noImplicitAny": true`.
3. [ ] Không có `console.log` debug sót lại trong code production (chỉ giữ `console.error` và `console.info` có chủ đích).
4. [ ] `.gitignore` có: `node_modules`, `.env.local`, `.next`, `*.log`.
5. [ ] `next.config.js` không bật `ignoreBuildErrors` hay `ignoreLintDuringBuilds`.
6. [ ] Đã có ít nhất 1 sample test thủ công viết trong README (cách trigger cron bằng curl).

---

**HẾT SPEC.** Copilot/Claude/Cursor: bắt đầu code từ `package.json`, sau đó `tsconfig.json`, rồi lần lượt theo thứ tự folder structure ở §9.
