'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    id: '',
    name: '',
    telegram_chat_id: '',
    google_sheet_id: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const slugValid = !form.id || SLUG_RE.test(form.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!SLUG_RE.test(form.id)) {
      setError('ID không hợp lệ');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Lỗi ${res.status}`);
        return;
      }
      const project = await res.json();
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Tạo dự án mới</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="id">
                ID dự án <span className="text-muted-foreground text-xs">(slug, không đổi được sau khi tạo)</span>
              </Label>
              <Input
                id="id"
                placeholder="my-project"
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value.toLowerCase() }))}
                required
                pattern="[a-z0-9][a-z0-9-]{1,31}"
                className={!slugValid ? 'border-red-500' : ''}
              />
              {!slugValid && (
                <p className="text-xs text-red-500">Chỉ dùng chữ thường, số và dấu gạch ngang (2-32 ký tự)</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">Tên dự án</Label>
              <Input
                id="name"
                placeholder="Hệ thống ABC"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="telegram_chat_id">Telegram Chat ID</Label>
              <Input
                id="telegram_chat_id"
                placeholder="-100123456789"
                value={form.telegram_chat_id}
                onChange={(e) => setForm((f) => ({ ...f, telegram_chat_id: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="google_sheet_id">Google Sheet ID</Label>
              <Input
                id="google_sheet_id"
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                value={form.google_sheet_id}
                onChange={(e) => setForm((f) => ({ ...f, google_sheet_id: e.target.value }))}
                required
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Đang tạo...' : 'Tạo dự án'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                Hủy
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
