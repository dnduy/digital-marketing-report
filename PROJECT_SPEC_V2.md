# 🆕 PROJECT_SPEC_V2.md — Dynamic Project Management

> **Bổ sung cho `PROJECT_SPEC.md`.** Phần này thay thế kiến trúc config tĩnh bằng CRUD động qua dashboard.
> Đọc cùng với spec gốc; chỗ nào mâu thuẫn → ưu tiên V2.

---

## 0. WHAT CHANGES (tóm tắt thay đổi)

| Trước (V1) | Sau (V2) |
|---|---|
| `lib/config/projects.config.ts` hardcode projects | KV lưu projects, admin CRUD qua UI |
| Token Meta đặt trong `.env`, key trùng `token_env_key` | Token nhập qua form, lưu encrypted trong KV |
| Sheet ID, chat ID hardcode trong config | Nhập qua form, lưu trong project record |
| Thêm project = sửa code + redeploy | Thêm project = click button "Tạo dự án mới" |
| Env vars: ~10 biến cho mỗi project | Env vars: chỉ infra (KV, JWT, CRON, GOOGLE SA, GEMINI, TELEGRAM BOT) |

Sau khi V2 hoàn thành, file `lib/config/projects.config.ts` chỉ giữ lại **interface definitions**, không còn `export const projects = [...]`.

---

## 1. NEW ENV VARS (bắt buộc)

Thêm vào `.env.example` và `lib/env.ts`:

```env
# === Encryption cho secrets lưu trong KV ===
# Generate: openssl rand -base64 32
ENCRYPTION_KEY=base64-string-32-bytes-exactly
```

**Quan trọng:** Nếu mất `ENCRYPTION_KEY` thì không decrypt được token đã lưu. Rotate key = phải re-encrypt toàn bộ.

Các env var per-project (`META_TOKEN_CHIC`, `TELEGRAM_CHAT_ID_CHILLAX`, etc.) **không cần nữa** — admin nhập qua UI.

---

## 2. STORAGE SCHEMA (Vercel KV)

```
projects:index                  → string[]                 (list of project IDs)
project:{id}                    → StoredProject            (config + encrypted secrets)
state:{id}                      → ProjectState             (giữ nguyên V1)
audit:{id}:{timestamp}          → AuditLog                 (optional, để tracking)
```

### 2.1. StoredProject interface

```typescript
// lib/types/project.ts
export interface EncryptedString {
  iv: string;       // base64
  tag: string;      // base64
  data: string;     // base64
}

export interface StoredWebsite {
  id: string;                    // uuid, dùng để edit/delete trong UI
  domain: string;
  wp_api_url?: string;
  ga4_property_id?: string;
  gsc_url?: string;
  enabled: boolean;              // toggle bật/tắt fetch
}

export interface StoredFacebookPage {
  id: string;                    // uuid (KHÔNG phải FB page ID)
  fb_page_id: string;            // FB Page ID thật
  name: string;
  access_token: EncryptedString; // encrypted
  enabled: boolean;
}

export interface StoredGoogleMapPlace {
  id: string;                    // uuid
  place_id: string;              // Google Place ID
  name: string;
  enabled: boolean;
}

export interface StoredProject {
  id: string;                    // slug, vd "chillax"
  name: string;
  created_at: string;            // ISO
  updated_at: string;
  enabled: boolean;              // toggle bật/tắt toàn project

  // Notification & storage targets — encrypted vì là secret
  telegram_chat_id: EncryptedString;
  google_sheet_id: EncryptedString;

  // Sources
  websites: StoredWebsite[];
  facebook_pages: StoredFacebookPage[];
  google_maps_places: StoredGoogleMapPlace[];
}
```

### 2.2. Decrypted runtime object (chạy daily/health)

Workflow không thao tác với `EncryptedString` trực tiếp. Có helper convert:

```typescript
// lib/db/projects.ts
export async function getDecryptedProject(id: string): Promise<DecryptedProject | null>;

export interface DecryptedProject extends Omit<StoredProject,
  'telegram_chat_id' | 'google_sheet_id' | 'facebook_pages'
> {
  telegram_chat_id: string;
  google_sheet_id: string;
  facebook_pages: Array<{
    id: string;
    fb_page_id: string;
    name: string;
    access_token: string;
    enabled: boolean;
  }>;
}
```

Workflow (`runDailyForProject`, `runHealthCheckForProject`) nhận `DecryptedProject` thay vì `ProjectConfig`.

---

## 3. ENCRYPTION MODULE

File mới: `lib/utils/crypto.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';
import type { EncryptedString } from '@/lib/types/project';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (base64-encoded)');
  }
  return key;
}

export function encrypt(plaintext: string): EncryptedString {
  if (!plaintext) {
    // Cho phép lưu chuỗi rỗng (vd: chưa nhập token), nhưng vẫn encrypt để consistent
    plaintext = '';
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

export function decrypt(encrypted: EncryptedString): string {
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  const data = Buffer.from(encrypted.data, 'base64');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Mask token để hiển thị trong UI: "abc...xyz" */
export function maskSecret(decrypted: string): string {
  if (!decrypted) return '(chưa nhập)';
  if (decrypted.length <= 8) return '••••••••';
  return `${decrypted.slice(0, 4)}…${decrypted.slice(-4)}`;
}
```

**Quy tắc dùng:**
- Lưu KV: dùng `encrypt()`.
- Workflow (cron) đọc KV: decrypt ngay khi load, dùng plaintext trong memory rồi quên.
- UI dashboard: KHÔNG bao giờ trả plaintext token về client. Chỉ trả masked version (`maskSecret`).
- Form edit token: nếu user để trống → giữ token cũ; nếu nhập mới → replace.

---

## 4. NEW DATA LAYER: `lib/db/projects.ts`

```typescript
import { kv } from '@vercel/kv';
import { encrypt, decrypt } from '@/lib/utils/crypto';
import type { StoredProject, DecryptedProject } from '@/lib/types/project';

const INDEX_KEY = 'projects:index';
const projectKey = (id: string) => `project:${id}`;

export async function listProjectIds(): Promise<string[]> {
  return (await kv.get<string[]>(INDEX_KEY)) ?? [];
}

export async function getStoredProject(id: string): Promise<StoredProject | null> {
  return (await kv.get<StoredProject>(projectKey(id))) ?? null;
}

export async function getAllStoredProjects(): Promise<StoredProject[]> {
  const ids = await listProjectIds();
  const results = await Promise.all(ids.map((id) => getStoredProject(id)));
  return results.filter((p): p is StoredProject => p !== null);
}

export async function getDecryptedProject(id: string): Promise<DecryptedProject | null> {
  const stored = await getStoredProject(id);
  if (!stored) return null;
  return {
    ...stored,
    telegram_chat_id: decrypt(stored.telegram_chat_id),
    google_sheet_id: decrypt(stored.google_sheet_id),
    facebook_pages: stored.facebook_pages.map((p) => ({
      id: p.id,
      fb_page_id: p.fb_page_id,
      name: p.name,
      access_token: decrypt(p.access_token),
      enabled: p.enabled,
    })),
  };
}

export async function getAllDecryptedProjects(): Promise<DecryptedProject[]> {
  const ids = await listProjectIds();
  const results = await Promise.all(ids.map((id) => getDecryptedProject(id)));
  return results.filter((p): p is DecryptedProject => p !== null);
}

export async function saveProject(project: StoredProject): Promise<void> {
  const ids = await listProjectIds();
  if (!ids.includes(project.id)) {
    await kv.set(INDEX_KEY, [...ids, project.id]);
  }
  await kv.set(projectKey(project.id), { ...project, updated_at: new Date().toISOString() });
}

export async function deleteProject(id: string): Promise<void> {
  const ids = await listProjectIds();
  await kv.set(INDEX_KEY, ids.filter((x) => x !== id));
  await kv.del(projectKey(id));
  await kv.del(`state:${id}`); // dọn luôn state cũ
}

/** Validate slug: lowercase, alphanumeric + dash, 2-32 chars */
export function isValidProjectId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,31}$/.test(id);
}
```

---

## 5. UPDATE WORKFLOWS

### 5.1. `runDailyForProject` / `runHealthCheckForProject`

Đổi signature: nhận `DecryptedProject` thay vì `ProjectConfig`. Các thay đổi cụ thể:

| Trước | Sau |
|---|---|
| `env.getRequired(project.telegram_chat_id_env_key)` | `project.telegram_chat_id` (đã decrypt) |
| `env.getRequired(page.token_env_key)` trong `meta.ts` | Truyền token qua param từ workflow |
| `project.google_sheet_id` (plain string từ config) | `project.google_sheet_id` (đã decrypt) |
| Loop `project.sources.websites` | Loop `project.websites.filter(w => w.enabled)` |
| Loop `project.sources.facebook_pages` | Loop `project.facebook_pages.filter(p => p.enabled)` |

Workflow sẽ skip source nào `enabled = false` ngay từ đầu.

### 5.2. `lib/api/meta.ts` không đọc env nữa

Trước:
```typescript
const token = env.getRequired(page.token_env_key);
```

Sau:
```typescript
// Hàm fetchMetaForProject giờ nhận thêm pages decrypted:
export async function fetchMetaForProject(
  pages: Array<{ fb_page_id: string; name: string; access_token: string }>,
  knownCommentIdsByPage: Record<string, string[]>
): Promise<MetaPageResult[]>
```

Tương tự, cả `daily.ts` truyền pages đã decrypt xuống.

### 5.3. Cron routes loop projects

```typescript
// app/api/cron/daily/route.ts
import { getAllDecryptedProjects } from '@/lib/db/projects';

const projects = (await getAllDecryptedProjects()).filter((p) => p.enabled);
for (const project of projects) {
  // ...
}
```

---

## 6. NEW API ROUTES (`/api/projects/...`)

Tất cả các route này nằm sau JWT middleware (admin only). Update `middleware.ts` matcher:

```typescript
export const config = {
  matcher: ['/dashboard/:path*', '/api/export/:path*', '/api/projects/:path*'],
};
```

### 6.1. `app/api/projects/route.ts`

```typescript
// GET: list all projects (KHÔNG trả secrets, chỉ trả metadata + counts)
// POST: create new project

interface ProjectSummary {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  counts: { websites: number; facebook_pages: number; google_maps_places: number };
  // KHÔNG có telegram_chat_id, google_sheet_id, tokens
}

interface CreateProjectBody {
  id: string;        // slug
  name: string;
  telegram_chat_id: string;
  google_sheet_id: string;
}
```

POST flow:
1. Validate `isValidProjectId(id)`, trùng → 409.
2. Validate `name` không rỗng.
3. Build `StoredProject` rỗng (websites/facebook/maps = []), encrypt 2 secrets.
4. `saveProject(...)`.
5. Return `ProjectSummary`.

### 6.2. `app/api/projects/[id]/route.ts`

```typescript
// GET: full project detail with MASKED secrets
// PATCH: update project metadata (name, enabled, secrets)
// DELETE: remove project + state

interface ProjectDetail {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  telegram_chat_id_masked: string;   // "1234…5678"
  google_sheet_id_masked: string;
  websites: StoredWebsite[];          // không có secrets
  facebook_pages: Array<{
    id: string;
    fb_page_id: string;
    name: string;
    access_token_masked: string;      // "EAAB…xyz"
    enabled: boolean;
  }>;
  google_maps_places: StoredGoogleMapPlace[];
}

interface PatchProjectBody {
  name?: string;
  enabled?: boolean;
  telegram_chat_id?: string;   // nếu undefined → giữ nguyên; nếu "" → giữ nguyên; nếu có value → replace
  google_sheet_id?: string;
}
```

### 6.3. Sources sub-routes

```
POST   /api/projects/{id}/websites              # add
PATCH  /api/projects/{id}/websites/{websiteId}  # edit
DELETE /api/projects/{id}/websites/{websiteId}

POST   /api/projects/{id}/facebook              # add (body có access_token plaintext)
PATCH  /api/projects/{id}/facebook/{pageId}
DELETE /api/projects/{id}/facebook/{pageId}

POST   /api/projects/{id}/maps
PATCH  /api/projects/{id}/maps/{mapId}
DELETE /api/projects/{id}/maps/{mapId}
```

Mỗi sub-route:
1. Load `StoredProject` từ KV.
2. Mutate array tương ứng (thêm uuid mới cho item, encrypt token nếu có).
3. `saveProject(...)`.

**Token update rule:** PATCH facebook với `access_token: ""` hoặc field thiếu → giữ token cũ. Chỉ replace khi gửi string non-empty.

### 6.4. Manual trigger routes (tiện debug)

```
POST /api/projects/{id}/run-daily    # trigger runDailyForProject ngay
POST /api/projects/{id}/run-health   # trigger runHealthCheckForProject ngay
```

Hữu ích cho admin: vừa tạo project xong test luôn không cần đợi cron.

---

## 7. UI / DASHBOARD CHANGES

### 7.1. Route structure mới

```
/dashboard                          # list projects (cards/table)
/dashboard/projects/new             # form tạo project mới
/dashboard/projects/[id]            # detail + edit
/dashboard/projects/[id]/sources    # tab quản lý sources (websites/fb/maps)
```

### 7.2. `/dashboard` — Project list

- Header có button **"+ Tạo dự án mới"** → link `/dashboard/projects/new`
- Bảng/grid hiển thị: name, enabled toggle, counts (3 websites • 2 fb • 4 maps), last_run_at, actions (View / Run now / Delete)
- Search box lọc theo name

### 7.3. `/dashboard/projects/new` — Form tạo

Fields:
- `id` (slug, auto-suggest từ name, validate realtime regex)
- `name` (required)
- `telegram_chat_id` (text, placeholder "vd: -100123456789")
- `google_sheet_id` (text, placeholder "ID lấy từ URL sheet")
- Submit → POST `/api/projects` → redirect `/dashboard/projects/{id}`

### 7.4. `/dashboard/projects/[id]` — Detail & edit

**Tab "Tổng quan":**
- Edit name, toggle enabled
- Hiển thị masked `telegram_chat_id`, `google_sheet_id` với button "Đổi"
- Click "Đổi" mở modal nhập value mới
- Button "Chạy báo cáo ngay" (manual trigger daily)
- Button "Health check ngay"
- Button "Xóa dự án" (confirm 2 lần)

**Tab "Websites":**
- Bảng list: domain, GA4 ID, GSC URL, WP API URL, enabled toggle, actions
- Button "+ Thêm website" → modal form
- Click row → modal edit (cùng form)

**Tab "Facebook Pages":**
- Bảng list: tên, FB Page ID, token masked, enabled toggle, actions
- Button "+ Thêm Fanpage" → modal form (tên, page ID, access_token textarea)
- Edit modal: token field rỗng = giữ token cũ, có hint "Để trống nếu không đổi"

**Tab "Google Maps":**
- Bảng list: tên địa điểm, place ID, enabled toggle, actions
- Button "+ Thêm địa điểm"

**Tab "State hiện tại":**
- Hiển thị `ProjectState` từ KV (read-only) — như V1 dashboard cũ
- Button "Reset state" (xóa state để cron coi như chạy lần đầu)

### 7.5. Components mới cần tạo

```
app/dashboard/projects/_components/
├── ProjectList.tsx              # client component, gọi GET /api/projects
├── ProjectListItem.tsx
├── CreateProjectForm.tsx
├── ProjectDetailTabs.tsx
├── OverviewTab.tsx
├── WebsitesTab.tsx
├── FacebookTab.tsx
├── MapsTab.tsx
├── StateTab.tsx
├── SecretInput.tsx              # input đặc biệt cho token (mask + "đổi")
└── ConfirmDialog.tsx            # reusable confirm cho delete
```

UI dùng Shadcn `Dialog` component → cài thêm: `pnpm add @radix-ui/react-dialog @radix-ui/react-switch`.

---

## 8. MIGRATION FROM V1

Nếu đã có data V1 (hardcode trong `projects.config.ts`), thêm script một lần:

```typescript
// scripts/migrate-v1-to-v2.ts
// Đọc projects từ projects.config.ts cũ + env vars → tạo StoredProject → saveProject

// Chạy: pnpm tsx scripts/migrate-v1-to-v2.ts
```

Sau khi migrate xong, xóa export `projects` trong config file (giữ lại interface).

---

## 9. SECURITY CHECKLIST (bắt buộc verify)

| # | Item |
|---|---|
| 1 | `ENCRYPTION_KEY` được set trên Vercel với scope Production + Preview (không Development để bắt buộc dùng `.env.local`) |
| 2 | API routes `/api/projects/*` chỉ accessible sau JWT middleware |
| 3 | Response JSON từ `/api/projects/*` KHÔNG bao giờ chứa plaintext token/sheet ID/chat ID — chỉ masked |
| 4 | Plaintext token chỉ tồn tại trong request body (lúc admin submit) và trong memory cron workflow |
| 5 | Log không print token: `console.error('[meta]', err)` an toàn vì axios không log token mặc định, nhưng kiểm tra `err.config?.params` có chứa `access_token` không — nếu có, redact |
| 6 | Rate limit `/api/auth` POST (chống brute force password): max 5 attempts / 15 phút / IP. Dùng KV làm counter |
| 7 | Form submit có CSRF protection: vì dùng same-origin + httpOnly cookie + JSON content-type, browser sẽ block CSRF default, nhưng nên thêm check `Origin` header trong route handler |
| 8 | `deleteProject` confirm 2 bước trên UI + log audit |

### Helper redact log (nếu cần):

```typescript
// lib/utils/redact.ts
export function redactError(err: unknown): string {
  const s = String(err);
  return s.replace(/access_token=[^&\s"']+/gi, 'access_token=***');
}
```

---

## 10. NEW ACCEPTANCE CRITERIA (thêm vào §12 spec gốc)

- [ ] `pnpm dev` → `/dashboard` hiển thị empty state "Chưa có dự án nào, tạo dự án đầu tiên"
- [ ] Click "+ Tạo dự án" → form → submit → redirect detail page
- [ ] Tại detail page, thêm 1 website (GA4 ID + domain) → save → reload → vẫn còn
- [ ] Thêm 1 Facebook page với token → reload page → token hiển thị masked, không thấy plaintext trong DevTools Network response
- [ ] Click "Chạy báo cáo ngay" → Telegram nhận message trong vòng 60s
- [ ] Toggle disable 1 source → chạy daily → source đó bị skip (kiểm tra log)
- [ ] Xóa project → KV không còn `project:{id}`, `state:{id}`, và `projects:index` không chứa id đó
- [ ] Sai password 6 lần trong 15 phút → response 429 Too Many Requests
- [ ] Curl trực tiếp `/api/projects` không có cookie → 401/redirect
- [ ] Sai `ENCRYPTION_KEY` → decrypt throw error → workflow log lỗi rõ ràng, KHÔNG crash cron

---

## 11. FILES TO ADD / MODIFY

### Files mới cần tạo:
```
lib/types/project.ts                  # StoredProject, DecryptedProject, EncryptedString
lib/utils/crypto.ts                   # encrypt/decrypt/maskSecret
lib/db/projects.ts                    # CRUD projects qua KV
lib/utils/rate-limit.ts               # rate limit cho /api/auth

app/api/projects/route.ts             # GET list, POST create
app/api/projects/[id]/route.ts        # GET detail, PATCH update, DELETE
app/api/projects/[id]/websites/route.ts                # POST add
app/api/projects/[id]/websites/[websiteId]/route.ts    # PATCH, DELETE
app/api/projects/[id]/facebook/route.ts
app/api/projects/[id]/facebook/[pageId]/route.ts
app/api/projects/[id]/maps/route.ts
app/api/projects/[id]/maps/[mapId]/route.ts
app/api/projects/[id]/run-daily/route.ts
app/api/projects/[id]/run-health/route.ts

app/dashboard/projects/new/page.tsx
app/dashboard/projects/[id]/page.tsx
app/dashboard/projects/_components/...  # (xem §7.5)

components/ui/dialog.tsx               # Shadcn dialog
components/ui/switch.tsx               # Shadcn switch
components/ui/textarea.tsx
```

### Files cần modify:
```
lib/env.ts                            # thêm ENCRYPTION_KEY, bỏ require các per-project env
lib/config/projects.config.ts         # giữ interface, xóa export projects[]
lib/workflows/daily.ts                # nhận DecryptedProject thay vì ProjectConfig
lib/workflows/health.ts               # nhận DecryptedProject
lib/api/meta.ts                       # bỏ env.getRequired, nhận token qua param
app/api/cron/daily/route.ts           # đọc projects từ KV thay vì import
app/api/cron/health/route.ts          # đọc projects từ KV thay vì import
app/dashboard/page.tsx                # redesign thành project list
middleware.ts                         # match thêm /api/projects/*
.env.example                          # thêm ENCRYPTION_KEY, bỏ các META_TOKEN_*, TELEGRAM_CHAT_ID_*
```

### Files giữ nguyên (không cần đụng):
```
lib/api/ga4.ts, gsc.ts, places.ts, wordpress.ts    # logic fetch không liên quan auth per-project
lib/db/kv.ts, sheets.ts                            # state vẫn vậy, sheets vẫn vậy
lib/ai/gemini.ts, lib/notifications/telegram.ts    # nhận chat_id qua param, đã chuẩn
components/ui/{button,card,input,label,table,tabs} # giữ
app/login/page.tsx, app/api/auth/route.ts          # giữ (chỉ thêm rate limit)
```

---

## 12. IMPLEMENTATION ORDER (đề xuất thứ tự code)

Copilot/Claude code theo thứ tự này để không vỡ đột ngột:

1. **`lib/utils/crypto.ts`** + test thủ công bằng `node -e`
2. **`lib/types/project.ts`** — define các interface
3. **`lib/db/projects.ts`** — CRUD layer
4. **`lib/env.ts`** — thêm `ENCRYPTION_KEY`
5. **`app/api/projects/route.ts`** + **`[id]/route.ts`** — test bằng curl + cookie
6. **Sources sub-routes** (websites/facebook/maps)
7. **`/dashboard/projects/new`** UI
8. **`/dashboard/projects/[id]`** UI + tabs
9. **Update workflows** (`daily.ts`, `health.ts`, `meta.ts`) để dùng `DecryptedProject`
10. **Update cron routes** đọc từ KV
11. **Manual trigger routes** (`run-daily`, `run-health`) + nút trên UI
12. **Rate limit `/api/auth`**
13. **Migration script** (nếu cần)
14. **Cleanup**: xóa `projects` export trong config, xóa env vars cũ trong `.env.example`

---

## 13. CRITICAL FIX BEFORE V2 (bug V1 cần sửa trước)

Tau review thấy mấy bug ở V1 nên sửa luôn trong quá trình lên V2:

### 13.1. `lib/utils/date.ts` — sai timezone

Hàm hiện tại fragile. Thay bằng version dùng `Intl.DateTimeFormat`:

```typescript
const TZ = 'Asia/Ho_Chi_Minh';

function getICTDateParts(d: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function getYesterdayDateICT(): string {
  const now = new Date();
  const { year, month, day } = getICTDateParts(now);
  // Subtract 1 day using UTC arithmetic to avoid DST issues (VN không có DST nhưng phòng hờ)
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
```

Tương tự cho `getTwoDaysAgoDateICT`, `getTodayDateICT`.

### 13.2. `lib/workflows/daily.ts` — bug last_comment_ids

Hiện tại (line ~155 trong file gốc):
```typescript
const allCommentIds = r.new_comments.map((c) => c.id);  // ❌ CHỈ comment mới
const prev = prevState.facebook_pages[r.page_id]?.last_comment_ids ?? [];
const combined = Array.from(new Set(prev.concat(allCommentIds))).slice(-50);
```

Sửa: dùng `all_comments` từ MetaPageResult (cần thêm field này). Hoặc gộp `new_comments` với toàn bộ comment đã fetch:

```typescript
// Trong meta.ts, thêm vào MetaPageResult:
all_comments_seen: MetaComment[];  // tất cả comment fetch được trong lần này, kể cả đã biết

// Trong daily.ts:
const allCommentIdsThisRun = r.all_comments_seen.map((c) => c.id);
const prev = prevState.facebook_pages[r.page_id]?.last_comment_ids ?? [];
const combined = Array.from(new Set([...prev, ...allCommentIdsThisRun])).slice(-50);
```

Logic: state lưu tất cả comment ID đã từng thấy (cap 50 mới nhất) để lần sau biết comment nào thật sự mới.

### 13.3. `lib/env.ts` — cache getter

```typescript
let cachedPrivateKey: string | undefined;
get GOOGLE_PRIVATE_KEY() {
  if (!cachedPrivateKey) {
    cachedPrivateKey = requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  }
  return cachedPrivateKey;
}
```

---

**HẾT V2 SPEC.** Tham chiếu V1 spec gốc cho mọi thứ không đề cập ở đây.
