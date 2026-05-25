import Link from 'next/link';
import { getAllStoredProjects, toProjectSummary } from '@/lib/db/projects';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ProjectSummary } from '@/lib/types/project';

export default async function DashboardPage() {
  let projects: ProjectSummary[];
  try {
    const stored = await getAllStoredProjects();
    projects = stored.map(toProjectSummary);
  } catch {
    projects = [];
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">📊 AI Report Hub</h1>
        <Link href="/dashboard/projects/new">
          <Button>+ Tạo dự án mới</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">Chưa có dự án nào.</p>
          <p className="text-sm mt-1">Nhấn "Tạo dự án mới" để bắt đầu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="block">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.id}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{p.counts.websites} website</span>
                    <span>{p.counts.facebook_pages} FB</span>
                    <span>{p.counts.google_maps_places} Maps</span>
                    <span className={p.enabled ? 'text-green-600' : 'text-red-500'}>
                      {p.enabled ? 'Bật' : 'Tắt'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
