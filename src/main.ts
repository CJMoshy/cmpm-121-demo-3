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
const SPAWN = spawnLocations.OAKES_CLASSROOM;

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.05;

// create the map with leaflet
const map = leaflet.map(document.getElementById("map")!, {
  center: SPAWN,
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

// caches hold deposit boxes which deal with coins
// deposit boxes are only created when user deposits a coin
const [caches, depositBox] = loadExistingCaches();

// this is a layer group array that will hold all the l.rect instances...
// I visualise this as chunks in minecraft
// its important to note that this array is treated as a FIFO queue for chunk loading
const visualChunks: leaflet.LayerGroup[] = [];

// load player from local storage if exists
const player: Player = initPlayer();

// simple ui stuff for user
const coinCountUI = document.querySelector<HTMLDivElement>("#coins")!;
coinCountUI.innerHTML = player.inventory.length.toString();

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  console.log("sapwning");
  // Convert cell numbers into lat/lng bounds
  const origin = player.marker.getLatLng();
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i - 1) * TILE_DEGREES, origin.lng + (j - 1) * TILE_DEGREES],
  ]);

  // brace made me this... generate random color hex
  // I replaced it with luck to deterministically generate the colors, random colors each time
  // ws proving to be too confusing
  const randomColor = () => (
    "#" +
    Array.from(
      { length: 6 },
      () => "0123456789ABCDEF"[Math.floor(luck([i, j].toString()) * 16)],
    ).join("")
  );
  const rect = leaflet.rectangle(bounds, {
    color: randomColor(),
  });

  //store info about cache so we can give it statefulness ONLY IF IT HAS NOT BEEN MADE
  const IHASH = bounds.getCenter().lat / TILE_DEGREES;
  const JHASH = bounds.getCenter().lng / TILE_DEGREES;
  const HASH = IHASH.toString() + JHASH.toString();

  // cell has not been made yet
  if (caches.has(HASH) === false) {
    const cell = {
      i: IHASH,
      j: JHASH,
      tokenCount: Math.floor(luck([i, j, "initialValue"].toString()) * 25) + 1,
    };
    caches.set(HASH, cell);
  }

  // Handle interactions with the cache
  try {
    rect.bindPopup(() => {
      // The popup offers a description and buttons
      const thisCache = caches.get(HASH);
      if (!thisCache) throw new Error("Queried cache not found in database");

      const popupDiv = document.createElement("div");
      popupDiv.innerHTML = `
    <div id='wrapper'>
      <div>
        Cache Location: ${IHASH.toFixed(2)} lat  ${JHASH.toFixed(2)} lng
        <br>
        Available Tokens for Mint: 
        <span id="value">
          ${thisCache.tokenCount.toString()}
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
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = thisCache
          .tokenCount.toString();
        popupDiv.querySelector<HTMLSpanElement>("#tokens")!.innerHTML =
          (depositBox.get(HASH)?.length)?.toString() || "0";

        coinCountUI.innerHTML = `${player.inventory.length}`;
      };
      // and then encapsulate that function and the save into one helper as its called on each interaction
      const handleGenericInteration = () => {
        updateUserCoinView();
        saveToLocalStorage();
      };

      // define a unique id to assign to each coin generated
      let UUID = 0;

      popupDiv // deposit logic
        .querySelector<HTMLButtonElement>("#deposit")!
        .addEventListener("click", () => {
          if (player.inventory.length <= 0) {
            alert("No Token in Inventory");
            return;
          }
          const token: NFT = player.inventory.pop()!; // add players most recent token to the cache
          if (!depositBox.has(HASH)) { // check if the hash does not have a deposit box already
            depositBox.set(
              HASH,
              [token],
            );
          } else {
            const dBox = depositBox.get(HASH)!;
            dBox?.push(token);
            depositBox.set(HASH, dBox);
          }
          document.getElementById("recent")!.textContent =
            `Player deposited token: {${token.i}:${token.j}:${token.serial}}`;
          handleGenericInteration();
        });

      popupDiv.querySelector<HTMLButtonElement>("#withdrawal")!
        .addEventListener("click", () => {
          const dBox = depositBox.get(HASH);
          if (dBox !== undefined && dBox.length > 0) { // if tokens exist in this caches deposit box
            const token = dBox.pop()!;
            player.inventory.push(token); // give player a token
            depositBox.set(HASH, dBox);
            document.getElementById("recent")!.textContent =
              `Player withdrew token: {${token.i}:${token.j}:${token.serial}}`;
            handleGenericInteration();
          } else {
            alert("No Token in Cache");
          }
        });

      popupDiv
        .querySelector<HTMLButtonElement>("#generate")!
        .addEventListener("click", () => {
          if (thisCache.tokenCount! <= 0) { // can this cache still mint?
            alert("No Tokens Available for Mint");
            return;
          }
          thisCache.tokenCount--; // mint one
          const nft: NFT = {
            i: IHASH.toString(),
            j: JHASH.toString(),
            serial: UUID,
          };
          document.getElementById("recent")!.textContent =
            `Player generated token: {${nft.i}:${nft.j}:${nft.serial}}`;
          player.inventory.push(nft);
          UUID++; // increment id for next mint
          handleGenericInteration();
        });

      return popupDiv;
    });
  } catch (e) {
    console.log(e);
  }
  return rect;
}

function generateCache() {
  const layer = leaflet.layerGroup<leaflet.Rectangle>();
  layer.addTo(map);
  // Look around the player's neighborhood for caches to spawn
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      // If location i,j is lucky enough, spawn a cache!
      if (
        luck(
          [i + player.marker.getLatLng().lat, j + player.marker.getLatLng().lat]
            .toString(),
        ) < CACHE_SPAWN_PROBABILITY
      ) {
        const rect = spawnCache(i, j);
        rect.addTo(layer);
      }
    }
  }
  visualChunks.push(layer);
  if (visualChunks.length >= 2) {
    const chunkToDelete = visualChunks.shift() as leaflet.LayerGroup;
    chunkToDelete.clearLayers(); // garbage collection will snag this now
  }
}

function movePlayerCommand(direction: DirectionCommand) {
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
  player.location.current = player.marker.getLatLng();
  // derived from formula d = sqrt((x2-x1)^2 + (y2-y1)^2)
  const getDistance = (x1: number, y1: number, x2: number, y2: number) => {
    const xDiff = x2 - x1;
    const yDiff = y2 - y1;
    return Number(Math.sqrt(xDiff * xDiff + yDiff * yDiff).toFixed(5));
  };

  const { current, previous } = player.location;
  const dist = getDistance(
    current.lat,
    current.lng,
    previous.lat,
    previous.lng,
  );
  if (dist > 0.0005) {
    previous.lat = current.lat;
    previous.lng = current.lng;
    generateCache();
  }
  player.line.addLatLng(player.location.current);
  map.panTo(player.marker.getLatLng());
  saveToLocalStorage();
}

function saveToLocalStorage() {
  localStorage.setItem("cache", JSON.stringify(Array.from(caches.entries())));
  localStorage.setItem(
    "depositBox",
    JSON.stringify(Array.from(depositBox.entries())),
  );
  localStorage.setItem("inventory", JSON.stringify(player.inventory));
  localStorage.setItem("location", JSON.stringify(player.location));
  localStorage.setItem("poly", JSON.stringify(player.line.getLatLngs()));
}

function initPlayer(): Player {
  let inventory: Inventory = [];
  let location: PlayerLocation = {
    current: SPAWN,
    previous: SPAWN,
  };
  const polyLine = leaflet.polyline([location.current], { color: "blue" })
    .addTo(map);
  const savedInventory = localStorage.getItem("inventory");
  const savedLocation = localStorage.getItem("location");
  const savedPolyline = localStorage.getItem("poly");

  if (savedInventory) {
    console.log("found inventory in localStorage");
    const parsed = JSON.parse(savedInventory);
    inventory = [...parsed];
  }
  if (savedLocation) {
    console.log("found a location in localStorage");
    const parsed = JSON.parse(savedLocation);
    location = { ...parsed };
  }
  if (savedPolyline) {
    console.log("found a polyline");
    const parsed = JSON.parse(savedPolyline);
    polyLine.setLatLngs([...parsed]);
  }

  return {
    marker: leaflet.marker(location.current),
    line: polyLine,
    inventory: inventory,
    location: location,
  } as Player;
}

function loadExistingCaches(): [
  Map<CellHash, Cell>,
  Map<CellHash, DepositBox>,
] {
  let caches = new Map<CellHash, Cell>(); // caches we generate
  let depositBox = new Map<CellHash, DepositBox>(); // e

  const savedCache = localStorage.getItem("cache");
  const savedDepositBox = localStorage.getItem("depositBox");
  if (savedCache) {
    console.log("found cache in localStorage");
    caches = new Map(JSON.parse(savedCache));
  }
  if (savedDepositBox) {
    console.log("found depositbox in localStorage");
    depositBox = new Map(JSON.parse(savedDepositBox));
  }
  return [caches, depositBox];
}

document.getElementById("reset")?.addEventListener("click", () => {
  const input = prompt(
    "Are you sure you want to reset the game? This is permanent (a long time!) and cannot be reversed",
  );
  if (input !== "y") {
    return;
  }
  caches.clear();
  depositBox.clear();
  player.inventory.length = 0;
  player.line.setLatLngs([]);
  localStorage.clear();
  for (const x of visualChunks) {
    x.clearLayers();
  }
  visualChunks.length = 0;
  document.getElementById("coins")!.innerHTML = player.inventory.length
    .toString();
  document.getElementById("recent")!.innerHTML = "";
  generateCache();
});

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

function main() {
  // here is where we would load stuff from local storage

  //  then we can set player and go!
  player.marker.bindTooltip("You are here!");
  player.marker.addTo(map);
  map.panTo(player.marker.getLatLng());
  generateCache();
}

main();
