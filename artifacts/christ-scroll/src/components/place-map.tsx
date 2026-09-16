import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, Popup, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// A minimal raster style pointing at OpenStreetMap's tile server — no API key required.
const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export function PlaceMap({ latitude, longitude, name, className }: { latitude: number; longitude: number; name: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [longitude, latitude],
      zoom: 8,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    new Marker({ color: '#6B2737' }).setLngLat([longitude, latitude]).setPopup(new Popup({ offset: 24 }).setText(name)).addTo(map);

    // The container's final size isn't always known at construction time (e.g. inside a
    // Suspense boundary or a fading-in parent), so keep the map in sync as it settles/resizes.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
    };
  }, [latitude, longitude, name]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
      role="img"
      aria-label={`Map showing the location of ${name}`}
    />
  );
}
