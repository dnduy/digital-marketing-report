import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import type { ProjectConfig } from '@/lib/config/projects.config';
import type { ProjectState } from '@/lib/types';

interface Props {
  project: ProjectConfig;
  state: ProjectState | null;
}

export default function MapsCard({ project, state }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin size={16} />
          Google Maps
        </CardTitle>
      </CardHeader>
      <CardContent>
        {project.sources.google_maps_places.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có địa điểm.</p>
        ) : (
          <ul className="space-y-3">
            {project.sources.google_maps_places.map((place) => {
              const placeState = state?.google_maps_places[place.id];
              return (
                <li key={place.id} className="border-b pb-2 last:border-0">
                  <p className="font-medium">{place.name}</p>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                    <span>Rating:</span>
                    <span className="font-mono">
                      {placeState ? `⭐ ${placeState.rating}` : '—'}
                    </span>
                    <span>Tổng reviews:</span>
                    <span className="font-mono">{placeState?.total_reviews ?? '—'}</span>
                    <span>Review đã track:</span>
                    <span className="font-mono">{placeState?.last_review_ids.length ?? 0}</span>
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
