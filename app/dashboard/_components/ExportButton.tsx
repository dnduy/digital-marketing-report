'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Props {
  projectId: string;
}

export default function ExportButton({ projectId }: Props) {
  function handleExport() {
    window.location.href = `/api/export?project=${encodeURIComponent(projectId)}`;
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download size={14} className="mr-1" />
      Export Excel
    </Button>
  );
}
