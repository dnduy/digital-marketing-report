import { appendAlert } from '@/lib/db/sheets';
import { sendTelegramAlert } from '@/lib/notifications/telegram';
import type { DecryptedProject } from '@/lib/types/project';

export interface HealthCheckResult {
  domain: string;
  status: 'ok' | 'down';
  statusCode?: number;
  error?: string;
}

async function checkSingleDomain(domain: string): Promise<HealthCheckResult> {
  try {
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });

    const ok = response.status >= 200 && response.status < 400;
    return {
      domain,
      status: ok ? 'ok' : 'down',
      statusCode: response.status,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { domain, status: 'down', error: message };
  }
}

export async function runHealthCheckForProject(
  project: DecryptedProject
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];
  const chatId = project.telegram_chat_id;

  for (const site of project.websites.filter((w) => w.enabled)) {
    const result = await checkSingleDomain(site.domain);
    results.push(result);

    if (result.status === 'down') {
      const detail = result.error
        ? `Error: ${result.error}`
        : `HTTP ${result.statusCode}`;

      console.error(`[health:${project.id}] ${site.domain} is DOWN — ${detail}`);

      await sendTelegramAlert(
        chatId,
        '🚨',
        `Website Down: ${site.domain}`,
        `*Project:* ${project.name}\n*Domain:* \`${site.domain}\`\n*Reason:* ${detail}`
      ).catch((err) =>
        console.error(`[health:${project.id}] telegram alert failed`, err)
      );

      await appendAlert(project.google_sheet_id, {
        timestamp: new Date().toISOString(),
        project_id: project.id,
        type: 'health_down',
        source: site.domain,
        message: detail,
      }).catch((err) =>
        console.error(`[health:${project.id}] sheets alert failed`, err)
      );
    }

    // Throttle: 200ms between requests
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return results;
}

export interface HealthCheckResult {
  domain: string;
  status: 'ok' | 'down';
  statusCode?: number;
  error?: string;
}
