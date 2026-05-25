import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '@/lib/env';
import type { DailySummaryInput } from '@/lib/types';

const MODEL_NAME = 'gemini-1.5-flash-latest';
const TEMPERATURE = 0.4;

function buildPrompt(input: DailySummaryInput): string {
  const jsonPayload = JSON.stringify(input, null, 2);
  return `Bạn là chuyên gia phân tích Digital Marketing. Dưới đây là dữ liệu 24h qua của dự án "${input.project_name}" ngày ${input.date}.

DỮ LIỆU JSON:
${jsonPayload}

YÊU CẦU:
- Viết báo cáo Markdown bằng tiếng Việt, dùng emoji phù hợp.
- Cấu trúc CỐ ĐỊNH:

📊 *BÁO CÁO ${input.project_name.toUpperCase()} - ${input.date}*

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
- Dùng *italic* và \`code\` markdown thay vì **bold** (Telegram MarkdownV1 không hỗ trợ bold kiểu **).`;
}

function buildFallbackMarkdown(input: DailySummaryInput): string {
  const lines: string[] = [
    `📊 *BÁO CÁO ${input.project_name.toUpperCase()} - ${input.date}*`,
    '',
    '🌐 *Website*',
  ];

  for (const w of input.websites) {
    const delta =
      w.sessions_delta_percent !== null
        ? `${w.sessions_delta_percent > 0 ? '+' : ''}${w.sessions_delta_percent}%`
        : '—';
    lines.push(
      `- *${w.domain}*: ${w.sessions} sessions (${delta}), ${w.conversions} conversions, ${w.clicks} clicks`
    );
    for (const p of w.new_wp_posts) {
      lines.push(`  📝 [${p.title}](${p.link})`);
    }
  }

  lines.push('', '📱 *Facebook*');
  for (const fb of input.facebook) {
    lines.push(`- *${fb.page_name}*: ${fb.new_posts_count} bài mới, ${fb.new_comments.length} comment mới`);
  }

  lines.push('', '📍 *Google Maps*');
  for (const gm of input.google_maps) {
    lines.push(
      `- *${gm.place_name}*: ⭐ ${gm.rating} (${gm.total_reviews} reviews), ${gm.new_reviews.length} review mới`
    );
    for (const r of gm.new_reviews.filter((rv) => rv.rating <= 3)) {
      lines.push(`  ⚠️ ${r.rating}⭐ - ${r.author}: "${r.text.slice(0, 100)}"`);
    }
  }

  if (input.errors.length > 0) {
    lines.push('', '⚠️ *Cảnh báo / Lỗi*');
    for (const e of input.errors) {
      lines.push(`- [${e.source}] ${e.message}`);
    }
  }

  return lines.join('\n');
}

export async function generateGeminiSummary(
  input: DailySummaryInput
): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { temperature: TEMPERATURE },
    });

    const prompt = buildPrompt(input);
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return text.trim();
  } catch (err) {
    console.error('[gemini] generateGeminiSummary failed, using fallback', err);
    return buildFallbackMarkdown(input);
  }
}
