'use client';

import { useState, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProjectDetail } from '@/lib/types/project';

export function OverviewTab({ project, onRefresh }: { project: ProjectDetail; onRefresh: () => void }) {
  const [running, setRunning] = useState<'daily' | 'health' | null>(null);
  const [msg, setMsg] = useState('');

  async function trigger(type: 'run-daily' | 'run-health') {
    setRunning(type === 'run-daily' ? 'daily' : 'health');
    setMsg('');
    try {
      const res = await fetch(`/api/projects/${project.id}/${type}`, { method: 'POST' });
      const data = await res.json();
      setMsg(res.ok ? 'Hoàn thành!' : data.error ?? 'Lỗi');
    } catch (err) {
      setMsg(String(err));
    } finally {
      setRunning(null);
    }
  }

  async function toggleEnabled() {
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !project.enabled }),
    });
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Switch checked={project.enabled} onCheckedChange={toggleEnabled} id="enabled" />
        <Label htmlFor="enabled">{project.enabled ? 'Đang bật' : 'Đang tắt'}</Label>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Telegram Chat ID</p>
          <p className="font-mono">{project.telegram_chat_id_masked}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Google Sheet ID</p>
          <p className="font-mono">{project.google_sheet_id_masked}</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button
          size="sm"
          onClick={() => trigger('run-daily')}
          disabled={running !== null}
        >
          {running === 'daily' ? 'Đang chạy...' : 'Chạy báo cáo ngay'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => trigger('run-health')}
          disabled={running !== null}
        >
          {running === 'health' ? 'Đang kiểm tra...' : 'Health check ngay'}
        </Button>
      </div>

      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

// ── Websites Tab ──────────────────────────────────────────────────────────────

export function WebsitesTab({ project, onRefresh }: { project: ProjectDetail; onRefresh: () => void }) {
  const [form, setForm] = useState({ domain: '', wp_api_url: '', ga4_property_id: '', gsc_url: '' });
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');

  async function addSite(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/websites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Lỗi'); return; }
      setForm({ domain: '', wp_api_url: '', ga4_property_id: '', gsc_url: '' });
      onRefresh();
    } finally {
      setAdding(false);
    }
  }

  async function remove(websiteId: string) {
    if (!confirm('Xoá website này?')) return;
    await fetch(`/api/projects/${project.id}/websites/${websiteId}`, { method: 'DELETE' });
    onRefresh();
  }

  async function toggleSite(websiteId: string, enabled: boolean) {
    await fetch(`/api/projects/${project.id}/websites/${websiteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {project.websites.length === 0 && <p className="text-muted-foreground text-sm">Chưa có website nào.</p>}
        {project.websites.map((w) => (
          <div key={w.id} className="flex items-center justify-between border rounded p-3 text-sm">
            <div>
              <span className="font-medium">{w.domain}</span>
              <span className="ml-2 text-muted-foreground">{w.ga4_property_id ? `GA4: ${w.ga4_property_id}` : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={w.enabled} onCheckedChange={(v) => toggleSite(w.id, v)} />
              <Button size="sm" variant="ghost" onClick={() => remove(w.id)}>Xoá</Button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={addSite} className="space-y-3 border-t pt-4">
        <p className="font-medium text-sm">Thêm website</p>
        <Input placeholder="domain.com" value={form.domain} onChange={(e) => setForm(f => ({ ...f, domain: e.target.value }))} required />
        <Input placeholder="WP API URL (tùy chọn)" value={form.wp_api_url} onChange={(e) => setForm(f => ({ ...f, wp_api_url: e.target.value }))} />
        <Input placeholder="GA4 Property ID (tùy chọn)" value={form.ga4_property_id} onChange={(e) => setForm(f => ({ ...f, ga4_property_id: e.target.value }))} />
        <Input placeholder="GSC URL (tùy chọn)" value={form.gsc_url} onChange={(e) => setForm(f => ({ ...f, gsc_url: e.target.value }))} />
        {err && <p className="text-red-500 text-xs">{err}</p>}
        <Button size="sm" type="submit" disabled={adding}>{adding ? 'Đang thêm...' : 'Thêm'}</Button>
      </form>
    </div>
  );
}

// ── Facebook Tab ──────────────────────────────────────────────────────────────

export function FacebookTab({ project, onRefresh }: { project: ProjectDetail; onRefresh: () => void }) {
  const [form, setForm] = useState({ fb_page_id: '', name: '', access_token: '' });
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');

  async function addPage(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/facebook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Lỗi'); return; }
      setForm({ fb_page_id: '', name: '', access_token: '' });
      onRefresh();
    } finally {
      setAdding(false);
    }
  }

  async function remove(pageId: string) {
    if (!confirm('Xoá Facebook Page này?')) return;
    await fetch(`/api/projects/${project.id}/facebook/${pageId}`, { method: 'DELETE' });
    onRefresh();
  }

  async function toggle(pageId: string, enabled: boolean) {
    await fetch(`/api/projects/${project.id}/facebook/${pageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {project.facebook_pages.length === 0 && <p className="text-muted-foreground text-sm">Chưa có Facebook Page nào.</p>}
        {project.facebook_pages.map((p) => (
          <div key={p.id} className="flex items-center justify-between border rounded p-3 text-sm">
            <div>
              <span className="font-medium">{p.name}</span>
              <span className="ml-2 text-muted-foreground">{p.fb_page_id}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">Token: {p.access_token_masked}</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={p.enabled} onCheckedChange={(v) => toggle(p.id, v)} />
              <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>Xoá</Button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={addPage} className="space-y-3 border-t pt-4">
        <p className="font-medium text-sm">Thêm Facebook Page</p>
        <Input placeholder="Facebook Page ID" value={form.fb_page_id} onChange={(e) => setForm(f => ({ ...f, fb_page_id: e.target.value }))} required />
        <Input placeholder="Tên Page" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
        <Input type="password" placeholder="Access Token" value={form.access_token} onChange={(e) => setForm(f => ({ ...f, access_token: e.target.value }))} required />
        {err && <p className="text-red-500 text-xs">{err}</p>}
        <Button size="sm" type="submit" disabled={adding}>{adding ? 'Đang thêm...' : 'Thêm'}</Button>
      </form>
    </div>
  );
}

// ── Maps Tab ──────────────────────────────────────────────────────────────────

export function MapsTab({ project, onRefresh }: { project: ProjectDetail; onRefresh: () => void }) {
  const [form, setForm] = useState({ place_id: '', name: '' });
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');

  async function addPlace(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Lỗi'); return; }
      setForm({ place_id: '', name: '' });
      onRefresh();
    } finally {
      setAdding(false);
    }
  }

  async function remove(mapId: string) {
    if (!confirm('Xoá Google Maps Place này?')) return;
    await fetch(`/api/projects/${project.id}/maps/${mapId}`, { method: 'DELETE' });
    onRefresh();
  }

  async function toggle(mapId: string, enabled: boolean) {
    await fetch(`/api/projects/${project.id}/maps/${mapId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {project.google_maps_places.length === 0 && <p className="text-muted-foreground text-sm">Chưa có địa điểm nào.</p>}
        {project.google_maps_places.map((m) => (
          <div key={m.id} className="flex items-center justify-between border rounded p-3 text-sm">
            <div>
              <span className="font-medium">{m.name}</span>
              <span className="ml-2 text-muted-foreground font-mono text-xs">{m.place_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={m.enabled} onCheckedChange={(v) => toggle(m.id, v)} />
              <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>Xoá</Button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={addPlace} className="space-y-3 border-t pt-4">
        <p className="font-medium text-sm">Thêm địa điểm</p>
        <Input placeholder="Google Maps Place ID (ChIJ...)" value={form.place_id} onChange={(e) => setForm(f => ({ ...f, place_id: e.target.value }))} required />
        <Input placeholder="Tên địa điểm" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
        {err && <p className="text-red-500 text-xs">{err}</p>}
        <Button size="sm" type="submit" disabled={adding}>{adding ? 'Đang thêm...' : 'Thêm'}</Button>
      </form>
    </div>
  );
}
