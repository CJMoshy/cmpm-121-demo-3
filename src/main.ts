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

const cachePopups = leaflet.layerGroup().addTo(map);

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const player: Player = {
  marker: leaflet.marker(spawnLocations.OAKES_CLASSROOM),
  inventory: [],
};

// track caches we spawn
const caches = new Map<CellHash, Cell>(); // caches we generate
const depositBox = new Map<CellHash, DepositBox>(); // each cache will have a deposit box

const coinCountUI = document.querySelector<HTMLDivElement>("#coins")!;
coinCountUI.innerHTML = "0...";

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  // Convert cell numbers into lat/lng bounds
  const origin = player.marker.getLatLng();
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // brace made me this... generate random color hex
  const randomColor = () => (
    "#" +
    Array.from(
      { length: 6 },
      () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)],
    ).join("")
  );
  const rect = leaflet.rectangle(bounds, {
    color: randomColor(),
  });
  rect.addTo(cachePopups);

  // point value determines how many NFTs each cache can 'mint' or create
  let pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 25);

  //store info about cache so we can give it statefulness ONLY IF IT HAS NOT BEEN MADE
  const IHASH = bounds.getCenter().lat / TILE_DEGREES;
  const JHASH = bounds.getCenter().lng / TILE_DEGREES;
  const HASH = IHASH.toString() + JHASH.toString();
  const CELL: Cell = {
    i: IHASH,
    j: JHASH,
  };
  if (caches.has(HASH) === false) {
    caches.set(HASH, CELL);
  }

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // The popup offers a description and buttons
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
    <div id='wrapper'>
      <div>
        Cache Location: "${IHASH},${JHASH}" 
        <br>
        Available Tokens for Mint: 
        <span id="value">
          ${pointValue.toString()}
        </span>
      </div>
      <div>
        Available Unique Tokens: 
        <span id='tokens'>
        ${depositBox.get(HASH)?.length || 0}
        </span>
      </div>
      <button id="deposit">Deposit Token</button> <br>
      <button id="withdrawal">Withdrawl token</button> <br>
      <button id="generate">Generate New Token</button>
    </div>
    `;

    // helper to update the ui
    const updateUserCoinView = () => {
      popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = pointValue
        .toString();

      popupDiv.querySelector<HTMLSpanElement>("#tokens")!.innerHTML =
        (depositBox.get(HASH)?.length)?.toString() || "0";

      coinCountUI.innerHTML = `${player.inventory.length}`;
    };

    // define a unique id to assign to each coin generated
    let UUID = 0;
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")! //
      .addEventListener("click", () => {
        if (player.inventory.length <= 0) {
          alert("No Token in Inventory");
          return;
        }
        if (!depositBox.has(HASH)) { // check if the hash does not have a deposit box already
          depositBox.set(
            HASH,
            [player.inventory.pop()!],
          );
        } else {
          const token: NFT = player.inventory.pop()!; // add players most recent token to the cache
          const dBox = depositBox.get(HASH)!;
          dBox?.push(token);
          depositBox.set(HASH, dBox);
        }
        updateUserCoinView();
      });
    popupDiv.querySelector<HTMLButtonElement>("#withdrawal")!
      .addEventListener("click", () => {
        const dBox = depositBox.get(HASH);
        if (dBox !== undefined && dBox.length > 0) { // if tokens exist in this caches deposit box
          player.inventory.push(dBox.pop()!); // give player a token
          depositBox.set(HASH, dBox);
          updateUserCoinView();
        } else {
          alert("No Token in Cache");
        }
      });
    popupDiv
      .querySelector<HTMLButtonElement>("#generate")!
      .addEventListener("click", () => {
        if (pointValue! <= 0) { // can this cache still mint?
          alert("No Tokens Available for Mint");
          return;
        }
        pointValue--; // mint one
        const nft: NFT = {
          i: IHASH.toString(),
          j: JHASH.toString(),
          serial: UUID,
        };
        console.log("generated a new token", nft);
        player.inventory.push(nft);
        UUID++; // increment id for next mint
        updateUserCoinView();
      });

    return popupDiv;
  });
}

function generateCache() {
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

document.getElementById("up")?.addEventListener("click", () => {
  movePlayerCommand("up");
});

document.getElementById("down")?.addEventListener("click", () => {
  movePlayerCommand("down");
});

document.getElementById("left")?.addEventListener("click", () => {
  movePlayerCommand("left");
});

document.getElementById("right")?.addEventListener("click", () => {
  movePlayerCommand("right");
});

function movePlayerCommand(direction: MoveCommand) {
  const { lat, lng } = player.marker.getLatLng();
  switch (direction) {
    case "up":
      player.marker.setLatLng(leaflet.latLng(lat + TILE_DEGREES, lng));
      break;
    case "down":
      player.marker.setLatLng(leaflet.latLng(lat - TILE_DEGREES, lng));
      break;
    case "left":
      player.marker.setLatLng(leaflet.latLng(lat, lng - TILE_DEGREES));
      break;
    case "right":
      player.marker.setLatLng(leaflet.latLng(lat, lng + TILE_DEGREES));
      break;
  }
  cachePopups.clearLayers();
  generateCache();
  map.panTo(player.marker.getLatLng());
}

function main() {
  // here is where we would load stuff from local storage

  //  then we can set player and go!
  player.marker.bindTooltip("You are here!");
  player.marker.addTo(map);
  generateCache();
}

main();
