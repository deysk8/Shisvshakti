'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export type MapStop = {
  sequence: number;
  name: string;
  city?: string | null;
  latitude: number;
  longitude: number;
};

export type LiveBusMarker = {
  latitude: number;
  longitude: number;
  label?: string;
};

type Props = {
  stops: MapStop[];
  liveBus?: LiveBusMarker | null;
  className?: string;
};

export function RouteMap({ stops, liveBus, className = 'h-80 w-full rounded-xl' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || stops.length < 2) return;

    let cancelled = false;

    void import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, { scrollWheelZoom: false });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      const latlngs: [number, number][] = stops.map((s) => [s.latitude, s.longitude]);
      L.polyline(latlngs, { color: '#E8740C', weight: 4, opacity: 0.9 }).addTo(map);

      stops.forEach((stop, idx) => {
        const isEnd = idx === 0 || idx === stops.length - 1;
        L.circleMarker([stop.latitude, stop.longitude], {
          radius: isEnd ? 8 : 6,
          color: '#E8740C',
          fillColor: isEnd ? '#E8740C' : '#ffffff',
          fillOpacity: 1,
          weight: 2,
        })
          .bindPopup(`<strong>${stop.name}</strong>${stop.city ? `<br/>${stop.city}` : ''}`)
          .addTo(map);
      });

      if (liveBus) {
        L.circleMarker([liveBus.latitude, liveBus.longitude], {
          radius: 10,
          color: '#1a1a1a',
          fillColor: '#2563eb',
          fillOpacity: 1,
          weight: 2,
        })
          .bindPopup(liveBus.label ?? 'Bus location')
          .addTo(map);
      }

      map.fitBounds(latlngs, { padding: [28, 28] });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stops, liveBus]);

  if (stops.length < 2) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 text-sm text-gray-500 ${className}`}>
        Map unavailable — stop coordinates missing
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
