import axios from 'axios';
import { env } from '@/lib/env';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_RETRIES = 2;

function splitMessage(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) return [text];

  const chunks: string[] = [];
  const lines = text.split('\n');
  let current = '';

  for (const line of lines) {
    if ((current + '\n' + line).length > MAX_MESSAGE_LENGTH) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function sendSingleMessage(
  chatId: string,
  text: string,
  attempt = 0
): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  } catch (err: unknown) {
    const isServerError =
      axios.isAxiosError(err) &&
      err.response?.status !== undefined &&
      err.response.status >= 500;

    if (isServerError && attempt < MAX_RETRIES) {
      console.error(`[telegram] 5xx error, retry ${attempt + 1}`, err);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      return sendSingleMessage(chatId, text, attempt + 1);
    }
    console.error('[telegram] sendMessage failed', err);
    throw err;
  }
}

export async function sendTelegramMessage(
  chatId: string,
  markdown: string
): Promise<void> {
  const chunks = splitMessage(markdown);
  for (const chunk of chunks) {
    await sendSingleMessage(chatId, chunk);
  }
}

export async function sendTelegramAlert(
  chatId: string,
  emoji: string,
  title: string,
  detail: string
): Promise<void> {
  const text = `${emoji} *${title}*\n\n${detail}`;
  await sendTelegramMessage(chatId, text);
}
