"use client";

import { useEffect, useRef, useState } from "react";

type MapMarker = {
  position: [number, number];
  label?: string;
  type?: "source" | "destination" | "driver";
};

type MapRoute = {
  coordinates: [number, number][];
  color?: string;
};

type MapComponentProps = {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routes?: MapRoute[];
  className?: string;
  onClick?: (lat: number, lng: number) => void;
  interactive?: boolean;
};

export function MapComponent({
  center = [33.6844, 73.0479],
  zoom = 10,
  markers = [],
  routes = [],
  className = "",
  onClick,
  interactive = true,
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routesRef = useRef<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Only run on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || typeof window === 'undefined' || !mapRef.current || mapInstanceRef.current) return;

    // Dynamically import Leaflet only on client side
    import('leaflet').then((L) => {
      // Fix for default icon issue in Leaflet
      delete (L.default as any).Icon.Default.prototype._getIconUrl;
      (L.default as any).Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const sourceIcon = L.default.divIcon({
        html: `<div class="w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
          <div class="w-2 w-2 bg-white rounded-full"></div>
        </div>`,
        className: "custom-marker",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const destIcon = L.default.divIcon({
        html: `<div class="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
          <div class="w-2 w-2 bg-white rounded-full"></div>
        </div>`,
        className: "custom-marker",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const driverIcon = L.default.divIcon({
        html: `<div class="w-8 w-8 bg-primary rounded-full border-2 border-white shadow-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
        </div>`,
        className: "custom-marker",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (!mapRef.current) return;

      const map = L.default.map(mapRef.current, {
        center,
        zoom,
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
      });

      const isDark = (typeof window !== 'undefined' && (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches))
        || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      const attribution = isDark
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

      const tileLayer = L.default.tileLayer(tileUrl, {
        attribution,
        maxZoom: 19,
      }).addTo(map);

      if (onClick && interactive) {
        map.on("click", (e: any) => {
          onClick(e.latlng.lat, e.latlng.lng);
        });
      }

      mapInstanceRef.current = { map, L: L.default, sourceIcon, destIcon, driverIcon, tileLayer, isDark };
      setIsLoaded(true);

      return () => {
        if (mapInstanceRef.current) {
          try { mapInstanceRef.current.tileLayer && mapInstanceRef.current.tileLayer.remove(); } catch {}
          mapInstanceRef.current.map.remove();
          mapInstanceRef.current = null;
        }
      };
    });
  }, [isClient]);

  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;
    const { map, L, sourceIcon, destIcon, driverIcon } = mapInstanceRef.current;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    markers.forEach((marker) => {
      let icon = destIcon;
      if (marker.type === "source") icon = sourceIcon;
      if (marker.type === "driver") icon = driverIcon;

      const m = L.marker(marker.position, { icon }).addTo(map);
      if (marker.label) {
        m.bindPopup(marker.label);
      }
      markersRef.current.push(m);
    });
  }, [markers, isLoaded]);

  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;
    const { map, L } = mapInstanceRef.current;

    routesRef.current.forEach((route) => route.remove());
    routesRef.current = [];

    routes.forEach((route) => {
      const defaultColor = mapInstanceRef.current?.isDark ? "#60a5fa" : "#2563eb";
      const polyline = L.polyline(route.coordinates, {
        color: route.color || defaultColor,
        weight: 4,
        opacity: 0.8,
      }).addTo(map);
      routesRef.current.push(polyline);
    });

    if (routes.length > 0 && routes[0].coordinates.length > 0) {
      const bounds = L.latLngBounds(routes[0].coordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routes, isLoaded]);

  useEffect(() => {
    if (mapInstanceRef.current && isLoaded) {
      mapInstanceRef.current.map.setView(center, zoom);
    }
  }, [center, zoom, isLoaded]);

  if (!isClient) {
    return (
      <div
        className={`w-full h-full min-h-[300px] rounded-md bg-muted animate-pulse flex items-center justify-center ${className}`}
        data-testid="map-container-loading"
      >
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className={`w-full h-full min-h-[300px] rounded-md ${className}`}
      data-testid="map-container"
    />
  );
}
