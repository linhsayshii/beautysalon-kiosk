import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  latitude: number | null;
  longitude: number | null;
  radiusMeters?: number;
  onChange: (latitude: number, longitude: number) => void;
  height?: number;
}

const DEFAULT_POSITION: [number, number] = [10.7769, 106.7009];
const pinIcon = L.divIcon({
  className: 'branch-map-pin',
  html: '<span><i class="ph ph-map-pin-fill"></i></span>',
  iconSize: [42, 48], iconAnchor: [21, 46],
});

export function LocationMapPicker({ latitude, longitude, radiusMeters = 100, onChange, height = 330 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initial: [number, number] = latitude !== null && longitude !== null ? [latitude, longitude] : DEFAULT_POSITION;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(initial, latitude === null ? 12 : 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const marker = L.marker(initial, { draggable: true, autoPan: true, icon: pinIcon, title: 'Vị trí chi nhánh' }).addTo(map);
    const circle = L.circle(initial, { radius: radiusMeters, color: '#176ee8', weight: 2, fillColor: '#4c8ff0', fillOpacity: .12 }).addTo(map);
    const apply = (position: L.LatLng) => {
      marker.setLatLng(position); circle.setLatLng(position);
      onChangeRef.current(Number(position.lat.toFixed(7)), Number(position.lng.toFixed(7)));
    };
    map.on('click', (event: L.LeafletMouseEvent) => apply(event.latlng));
    marker.on('dragend', () => apply(marker.getLatLng()));
    mapRef.current = map; markerRef.current = marker; circleRef.current = circle;
    window.setTimeout(() => map.invalidateSize(), 50);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; circleRef.current = null; };
  }, []);

  useEffect(() => {
    if (latitude === null || longitude === null || !mapRef.current || !markerRef.current || !circleRef.current) return;
    const position = L.latLng(latitude, longitude);
    markerRef.current.setLatLng(position); circleRef.current.setLatLng(position);
  }, [latitude, longitude]);

  useEffect(() => { circleRef.current?.setRadius(radiusMeters); }, [radiusMeters]);

  return <div className="branch-map-wrap"><div ref={containerRef} className="branch-map" style={{ height }} /><div className="branch-map-hint"><i className="ph ph-cursor-click" /> Bấm trên bản đồ hoặc kéo ghim để chọn vị trí chính xác</div></div>;
}
