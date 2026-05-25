'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import WebsiteCard from './WebsiteCard';
import FacebookCard from './FacebookCard';
import MapsCard from './MapsCard';
import ExportButton from './ExportButton';
import type { ProjectConfig } from '@/lib/config/projects.config';
import type { ProjectState } from '@/lib/types';

interface Props {
  projects: ProjectConfig[];
  statesByProjectId: Record<string, ProjectState | null>;
}

export default function ProjectTabs({ projects, statesByProjectId }: Props) {
  return (
    <Tabs defaultValue={projects[0]?.id ?? ''}>
      <TabsList className="mb-4 flex flex-wrap gap-1 h-auto">
        {projects.map((p) => (
          <TabsTrigger key={p.id} value={p.id}>
            {p.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {projects.map((project) => {
        const state = statesByProjectId[project.id];
        return (
          <TabsContent key={project.id} value={project.id}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {state
                  ? `Cập nhật lần cuối: ${new Date(state.last_run_at).toLocaleString('vi-VN')}`
                  : 'Chưa có dữ liệu'}
              </p>
              <div className="flex gap-2">
                <ExportButton projectId={project.id} />
                <LogoutButton />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <WebsiteCard project={project} state={state} />
              <FacebookCard project={project} state={state} />
              <MapsCard project={project} state={state} />
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    window.location.href = '/login';
  }
  return (
    <button
      onClick={handleLogout}
      className="text-sm text-muted-foreground underline hover:text-foreground"
    >
      Đăng xuất
    </button>
  );
}
