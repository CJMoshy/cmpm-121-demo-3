// todo
// @deno-types="npm:@types/leaflet@^1.9.14"

import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";

import "./leafletWorkaround.ts";

import luck from "./luck.ts";

// define list of spawn points for player
const spawnLocations = {
  OAKES_CLASSROOM: leaflet.latLng(36.98949379578401, -122.06277128548504),
};

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

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

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  // Convert cell numbers into lat/lng bounds
  const origin = spawnLocations.OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // Each cache has a random point value, mutable by the player
    let pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);

    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>Cache Location: "${i},${j}" Available coins: <span id="value">${pointValue}</span></div>
                <button id="deposit">deposit coins</button> <button id="withdrawal">withdrawl coins</button>`;

    const updateUserCoinView = () => {
      popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = pointValue
        .toString();
      statusPanel.innerHTML = `${player.coins}`;
    };

    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (player.coins <= 0) {
          alert("You dont have any coins to deposit!");
          return;
        }
        pointValue++;
        player.coins--;
        updateUserCoinView();
      });
    popupDiv
      .querySelector<HTMLButtonElement>("#withdrawal")!
      .addEventListener("click", () => {
        if (pointValue <= 0) {
          alert("This cache has no coins to withdrawal!");
          return;
        }
        pointValue--;
        player.coins++;
        updateUserCoinView();
      });

    return popupDiv;
  });
}

function main() {
  // here is where we would load stuff from local storage

  //  then we can set player and go!
  player.marker.bindTooltip("You are here!");
  player.marker.addTo(map);

  // Look around the player's neighborhood for caches to spawn
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      // If location i,j is lucky enough, spawn a cache!
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(i, j);
      }
    }
  }
}

main();
