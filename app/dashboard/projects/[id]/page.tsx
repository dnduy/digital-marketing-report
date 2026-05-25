'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { OverviewTab, WebsitesTab, FacebookTab, MapsTab } from './_components/tabs';
import type { ProjectDetail } from '@/lib/types/project';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState('');
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Resolve async params
  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) { setError('Không tìm thấy dự án'); return; }
    setProject(await res.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      router.push('/dashboard');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (error) return <p className="p-8 text-red-500">{error}</p>;
  if (!project) return <p className="p-8 text-muted-foreground">Đang tải...</p>;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground text-sm font-mono">{project.id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>← Quay lại</Button>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">Xoá dự án</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Xoá dự án "{project.name}"?</DialogTitle>
                <DialogDescription>
                  Hành động này không thể hoàn tác. Toàn bộ cấu hình và state sẽ bị xoá khỏi KV.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>Hủy</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Đang xoá...' : 'Xác nhận xoá'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="websites">
                Websites <span className="ml-1 text-xs">({project.websites.length})</span>
              </TabsTrigger>
              <TabsTrigger value="facebook">
                Facebook <span className="ml-1 text-xs">({project.facebook_pages.length})</span>
              </TabsTrigger>
              <TabsTrigger value="maps">
                Google Maps <span className="ml-1 text-xs">({project.google_maps_places.length})</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <OverviewTab project={project} onRefresh={load} />
            </TabsContent>
            <TabsContent value="websites" className="mt-4">
              <WebsitesTab project={project} onRefresh={load} />
            </TabsContent>
            <TabsContent value="facebook" className="mt-4">
              <FacebookTab project={project} onRefresh={load} />
            </TabsContent>
            <TabsContent value="maps" className="mt-4">
              <MapsTab project={project} onRefresh={load} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
