// @deno-types="npm:@types/leaflet@^1.9.14"

import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "../leafletWorkaround.ts";

export const makeLatLng = (lat: number, lng: number) =>
  leaflet.latLng(lat, lng) as unknown as LatLng;

export default class MapService {
  private doc: Document;

  constructor(doc: Document) {
    this.doc = doc;
  }

  loadMap(config: MapConfig): leaflet.Map {
    const map = leaflet.map(this.doc.getElementById("map")!, {
      center: config.spawn,
      zoom: config.zoom,
      minZoom: config.maxZoom,
      maxZoom: config.minZoom,
      zoomControl: config.zoomControl,
      scrollWheelZoom: config.scrollWheelZoom,
    });
    leaflet
      .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      })
      .addTo(map);

    return map;
  }
  // this is a layer group array that will hold all the l.rect instances...
  // I visualise this as chunks in minecraft
  // its important to note that this array is treated as a FIFO queue for chunk loading
  initChunkSystem() {
    return [] as leaflet.LayerGroup[];
  }

  getLayerGroup() {
    return leaflet.layerGroup<leaflet.Rectangle>();
  }

  getPolyline(location: PlayerLocation) {
    return leaflet.polyline([location.current], { color: "blue" });
  }

  initMarker(location: PlayerLocation) {
    return new leaflet.Marker(location.current);
  }

  getLatLngBounds(i: number, j: number, TILE_DEGREES: number) {
    const bounds = leaflet.latLngBounds([
      [i * TILE_DEGREES, j * TILE_DEGREES],
      [(i - 1) * TILE_DEGREES, (j - 1) * TILE_DEGREES],
    ]);
    return bounds;
  }

  getRect(bounds: leaflet.LatLngBounds, color: () => string) {
    return leaflet.rectangle(bounds, { color: color() });
  }
}
