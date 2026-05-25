import { projects } from '@/lib/config/projects.config';
import { getProjectState } from '@/lib/db/kv';
import ProjectTabs from './_components/ProjectTabs';

export default async function DashboardPage() {
  const statesSettled = await Promise.allSettled(
    projects.map((p) => getProjectState(p.id))
  );

  const statesByProjectId = Object.fromEntries(
    projects.map((p, i) => {
      const settled = statesSettled[i];
      return [p.id, settled.status === 'fulfilled' ? settled.value : null];
    })
  );

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">📊 AI Report Hub</h1>
      </div>
      <ProjectTabs projects={projects} statesByProjectId={statesByProjectId} />
    </div>
  );
}
