// @deno-types="npm:@types/leaflet@^1.9.14"

import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// define list of spawn points for player
const spawnLocations = {
  NULL_ISLAND: leaflet.latLng(0, 0),
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

const player: Player = {
  coins: 0,
  marker: leaflet.marker(spawnLocations.OAKES_CLASSROOM),
  inventory: [],
};

// track caches we spawn
const caches = new Map<Hash, number>(); // caches we generate
const depositBox = new Map<Hash, DepositBox>();

const coinCountUI = document.querySelector<HTMLDivElement>("#coins")!;
coinCountUI.innerHTML = "0...";

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

  // Each cache has a random point value, mutable by the player
  const pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);

  //store info about cache so we can give it statefulness ONLY IF IT HAS NOT BEEN MADE
  const IHASH: Hash = (bounds.getCenter().lat / TILE_DEGREES).toString();
  const JHASH: Hash = (bounds.getCenter().lng / TILE_DEGREES).toString();
  const hash: Hash = IHASH + JHASH;
  if (caches.has(hash) === false) {
    caches.set(hash, pointValue);
  }

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>Cache Location: "${i},${j}" Available coins to mint: <span id="value">${
      (caches.get(hash)!).toString()
    }</span></div><div>Available Unique Tokens: ${
      depositBox.get(hash)?.length || 0
    }</div>
                <button id="deposit">deposit coins</button> <button id="withdrawal">withdrawl coins</button><button id="generate">Generate New Token</button>`;

    const updateUserCoinView = () => {
      popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
        (caches.get(hash)!).toString();
      coinCountUI.innerHTML = `${player.coins}`;
    };

    // Clicking the button decrements the cache's value and increments the player's points
    let UUID = 0;
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (player.coins <= 0) {
          alert("You dont have any coins to deposit!");
          return;
        }
        if (!depositBox.has(hash)) {
          depositBox.set(
            hash,
            [player.inventory.pop()!],
          );
        } else {
          const token: NFT = player.inventory.pop()!;
          const dBox = depositBox.get(hash)!;
          dBox?.push(token);
          depositBox.set(hash, dBox);
        }
        player.coins--;
        console.log(depositBox.get(hash));
        updateUserCoinView();
      });
    popupDiv.querySelector<HTMLButtonElement>("#withdrawal")!
      .addEventListener("click", () => {
        const dBox = depositBox.get(hash);
        if (dBox !== undefined && dBox.length > 0) {
          player.inventory.push(dBox.pop()!);
          depositBox.set(hash, dBox);
          player.coins++;
          updateUserCoinView();
          console.log(player.inventory);
        } else if (dBox === undefined || dBox.length === 0) {
          alert("no tokens in this cache storage");
        }
      });
    popupDiv
      .querySelector<HTMLButtonElement>("#generate")!
      .addEventListener("click", () => {
        if (pointValue <= 0) {
          alert("This cache cannot generate any more tokesn!");
          return;
        }
        caches.set(
          hash,
          caches.get(hash)! - 1,
        );
        player.coins++;
        player.inventory.push({ i: IHASH, j: JHASH, serial: UUID });
        UUID++;
        console.log(player.inventory);
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
