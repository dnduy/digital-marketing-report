import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe } from 'lucide-react';
import type { ProjectConfig } from '@/lib/config/projects.config';
import type { ProjectState } from '@/lib/types';

interface Props {
  project: ProjectConfig;
  state: ProjectState | null;
}

export default function WebsiteCard({ project, state }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe size={16} />
          Website
        </CardTitle>
      </CardHeader>
      <CardContent>
        {project.sources.websites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có website.</p>
        ) : (
          <ul className="space-y-3">
            {project.sources.websites.map((site) => {
              const siteState = state?.websites[site.domain];
              return (
                <li key={site.domain} className="border-b pb-2 last:border-0">
                  <p className="font-medium">{site.domain}</p>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                    <span>Sessions hôm qua:</span>
                    <span className="font-mono">{siteState?.sessions_yesterday ?? '—'}</span>
                    <span>Clicks:</span>
                    <span className="font-mono">{siteState?.clicks_yesterday ?? '—'}</span>
                    <span>Impressions:</span>
                    <span className="font-mono">{siteState?.impressions_yesterday ?? '—'}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
