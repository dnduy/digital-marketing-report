import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';
import type { ProjectConfig } from '@/lib/config/projects.config';
import type { ProjectState } from '@/lib/types';

interface Props {
  project: ProjectConfig;
  state: ProjectState | null;
}

export default function FacebookCard({ project, state }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare size={16} />
          Facebook
        </CardTitle>
      </CardHeader>
      <CardContent>
        {project.sources.facebook_pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có Facebook page.</p>
        ) : (
          <ul className="space-y-3">
            {project.sources.facebook_pages.map((page) => {
              const pageState = state?.facebook_pages[page.id];
              const commentCount = pageState?.last_comment_ids.length ?? 0;
              return (
                <li key={page.id} className="border-b pb-2 last:border-0">
                  <p className="font-medium">{page.name}</p>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                    <span>Post gần nhất:</span>
                    <span className="font-mono truncate">{pageState?.last_post_id ?? '—'}</span>
                    <span>Comment đã track:</span>
                    <span className="font-mono">{commentCount}</span>
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
