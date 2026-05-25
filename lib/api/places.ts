import axios from 'axios';
import { env } from '@/lib/env';
import type { ProjectConfig, GoogleMapPlace } from '@/lib/config/projects.config';

const PLACES_API_BASE = 'https://places.googleapis.com/v1/places';
const FIELD_MASK = 'displayName,rating,userRatingCount,reviews';

interface PlaceReview {
  name: string;
  relativePublishTimeDescription: string;
  rating: number;
  text?: { text: string; languageCode: string };
  authorAttribution?: { displayName: string; uri: string };
  publishTime: string;
  // reviewId is part of the resource name: places/{placeId}/reviews/{reviewId}
}

interface PlaceApiResponse {
  displayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  reviews?: PlaceReview[];
}

export interface PlaceReviewResult {
  reviewId: string;
  author: string;
  rating: number;
  text: string;
  publishTime: string;
}

export interface PlacesResult {
  place_id: string;
  place_name: string;
  rating: number;
  total_reviews: number;
  reviews: PlaceReviewResult[];
  new_reviews: PlaceReviewResult[];
  error?: string;
}

function extractReviewId(reviewName: string): string {
  // resource name format: places/{placeId}/reviews/{reviewId}
  const parts = reviewName.split('/');
  return parts[parts.length - 1] ?? reviewName;
}

async function fetchSinglePlace(
  place: GoogleMapPlace,
  knownReviewIds: string[]
): Promise<PlacesResult> {
  const response = await axios.get<PlaceApiResponse>(
    `${PLACES_API_BASE}/${place.id}`,
    {
      headers: {
        'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
    }
  );

  const data = response.data;
  const rating = data.rating ?? 0;
  const totalReviews = data.userRatingCount ?? 0;

  const reviews: PlaceReviewResult[] = (data.reviews ?? []).map((r) => ({
    reviewId: extractReviewId(r.name),
    author: r.authorAttribution?.displayName ?? 'Anonymous',
    rating: r.rating,
    text: r.text?.text ?? '',
    publishTime: r.publishTime,
  }));

  const newReviews = reviews.filter((r) => !knownReviewIds.includes(r.reviewId));

  return {
    place_id: place.id,
    place_name: place.name,
    rating,
    total_reviews: totalReviews,
    reviews,
    new_reviews: newReviews,
  };
}

export async function fetchPlacesForProject(
  project: ProjectConfig,
  knownReviewIdsByPlace: Record<string, string[]>
): Promise<PlacesResult[]> {
  const places = project.sources.google_maps_places;

  const settled = await Promise.allSettled(
    places.map((place) =>
      fetchSinglePlace(place, knownReviewIdsByPlace[place.id] ?? [])
    )
  );

  return settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    console.error(`[places] failed for ${places[i].id}`, s.reason);
    return {
      place_id: places[i].id,
      place_name: places[i].name,
      rating: 0,
      total_reviews: 0,
      reviews: [],
      new_reviews: [],
      error: String(s.reason),
    };
  });
}
