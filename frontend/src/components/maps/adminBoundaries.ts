// Cameroon outline and the ten administrative regions, from Developer A's task A3:
// data/regions/cameroon_admin1.geojson. Until that file exists the map works without it.
// The dev server does not watch data/: restart `npm run dev` after adding the file.
// The glob returns {} when the file is missing, so the build never breaks.
import type { FeatureCollection } from 'geojson'

const files = import.meta.glob('../../../../data/regions/cameroon_admin1.geojson', {
  query: '?url',
  import: 'default',
}) as Record<string, () => Promise<string>>

let cached: Promise<FeatureCollection | null> | null = null

export function loadAdminBoundaries(): Promise<FeatureCollection | null> {
  if (cached) return cached
  const loader = Object.values(files)[0]
  cached = loader
    ? loader()
        .then((url) => fetch(url))
        .then((res) => (res.ok ? (res.json() as Promise<FeatureCollection>) : null))
        .catch(() => null)
    : Promise.resolve(null)
  return cached
}

export const hasAdminBoundaries = Object.keys(files).length > 0
