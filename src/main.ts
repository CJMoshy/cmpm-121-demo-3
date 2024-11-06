// todo
// @deno-types="npm:@types/leaflet@^1.9.14"

import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";

import "./leafletWorkaround.ts";

// import luck from "./luck.ts";

// define list of spawn points for player
const spawnLocations = {
  OAKES_CLASSROOM: leaflet.latLng(36.98949379578401, -122.06277128548504),
};

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
// const TILE_DEGREES = 1e-4;
// const NEIGHBORHOOD_SIZE = 8;
// const CACHE_SPAWN_PROBABILITY = 0.1;

// create the map with leaflet
const map = leaflet.map(document.getElementById("map")!, {
  center: spawnLocations.OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const player = {
  coins: 0,
  marker: leaflet.marker(spawnLocations.OAKES_CLASSROOM),
};

const statusPanel = document.querySelector<HTMLDivElement>("#coins")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "0...";

function main() {
  // here is where we would load stuff from local storage

  //  then we can set player and go!
  player.marker.bindTooltip("You are here!");
  player.marker.addTo(map);
}

main();
