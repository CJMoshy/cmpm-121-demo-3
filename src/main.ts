// @deno-types="npm:@types/leaflet@^1.9.14"

import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

import { makeLatLng } from "./wrapper.ts";
import MapService from "./wrapper.ts";
// define list of spawn points for player

const GAME_CONFIG = {
  spawnLocations: {
    NULL_ISLAND: makeLatLng(0, 0),
    OAKES_CLASSROOM: makeLatLng(36.98949379578401, -122.06277128548504),
  },
  GAMEPLAY_ZOOM_LEVEL: 19,
  TILE_DEGREES: 1e-4,
  NEIGHBORHOOD_SIZE: 8,
  CACHE_SPAWN_PROBABILITY: 0.05,
};

const SPAWN = GAME_CONFIG.spawnLocations.OAKES_CLASSROOM;

const mService = new MapService(document);
// create the map with leaflet
const map = mService.loadMap({
  spawn: SPAWN,
  zoom: GAME_CONFIG.GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAME_CONFIG.GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAME_CONFIG.GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// caches hold deposit boxes which deal with coins
// token count maps each cache with the ammount of tokens it can mint
// deposit boxes are only created when user deposits a coin
const [caches, tokenCounts, depositBox] = loadExistingCaches();

const visualChunks = mService.initChunkSystem();

// load player from local storage if exists
const player: Player = initPlayer();
let geoLocale: boolean = false;
let windowOpen: boolean = false;

// simple ui stuff for user
const coinCountUI = document.querySelector<HTMLDivElement>("#coins")!;
coinCountUI.innerHTML = player.inventory.length.toString();

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  // Convert cell numbers into lat/lng bounds
  const bounds = mService.getLatLngBounds(i, j, GAME_CONFIG.TILE_DEGREES);

  // brace made me this... generate random color hex
  // I replaced it with luck to deterministically generate the colors, random colors each time
  // ws proving to be too confusing
  console.log(i, j);
  const randomColor = () => (
    "#" +
    Array.from(
      { length: 6 },
      () =>
        "0123456789ABCDEF"[Math.floor(luck([i, j].toString() + "HELPER") * 16)],
    ).join("")
  );
  const rect = mService.getRect(bounds, randomColor);

  //store info about cache so we can give it statefulness ONLY IF IT HAS NOT BEEN MADE
  const IHASH = Math.floor(bounds.getCenter().lat / GAME_CONFIG.TILE_DEGREES);
  const JHASH = Math.floor(bounds.getCenter().lng / GAME_CONFIG.TILE_DEGREES);
  const HASH = IHASH.toString() + JHASH.toString();

  // cell has not been made yet
  if (caches.has(HASH) === false) {
    const cell = {
      i: IHASH,
      j: JHASH,
    };
    caches.set(HASH, cell);
    tokenCounts.set(
      HASH,
      Math.floor(luck([i, j, "initialValue"].toString()) * 25) + 1,
    );
  }

  // Handle interactions with the cache
  try {
    rect.bindPopup(() => {
      windowOpen = true;
      // The popup offers a description and buttons
      const thisCache = caches.get(HASH);
      if (!thisCache) throw new Error("Queried cache not found in database");

      const popupDiv = document.createElement("div");
      popupDiv.innerHTML = `
    <div id='wrapper'>
      <div>
        Cache Location: ${IHASH} lat  ${JHASH} lng
        <br>
        Available Tokens for Mint: 
        <span id="value">
          ${tokenCounts.get(HASH)?.toString()}
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
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          tokenCounts.get(HASH)!.toString();
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
          if (tokenCounts.get(HASH)! <= 0) { // can this cache still mint?
            alert("No Tokens Available for Mint");
            return;
          }
          tokenCounts.set(HASH, tokenCounts.get(HASH)! - 1);
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
  rect.getPopup()?.on("remove", () => {
    windowOpen = false;
  });
  return rect;
}

function generateCache() {
  const layer = mService.getLayerGroup();
  layer.addTo(map);
  // Look around the player's neighborhood for caches to spawn
  const playerCell: Cell = {
    i: Math.floor(player.marker.getLatLng().lat / GAME_CONFIG.TILE_DEGREES),
    j: Math.floor(player.marker.getLatLng().lng / GAME_CONFIG.TILE_DEGREES),
  };

  console.log(playerCell);
  for (
    let i = -GAME_CONFIG.NEIGHBORHOOD_SIZE;
    i < GAME_CONFIG.NEIGHBORHOOD_SIZE;
    i++
  ) {
    for (
      let j = -GAME_CONFIG.NEIGHBORHOOD_SIZE;
      j < GAME_CONFIG.NEIGHBORHOOD_SIZE;
      j++
    ) {
      // If location i,j is lucky enough, spawn a cache!
      const currentCell = {
        i: i + playerCell.i,
        j: j + playerCell.j,
      };
      if (
        luck(
          [currentCell.i, currentCell.j]
            .toString(),
        ) < GAME_CONFIG.CACHE_SPAWN_PROBABILITY
      ) {
        const rect = spawnCache(currentCell.i, currentCell.j);
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
      player.marker.setLatLng(makeLatLng(lat + GAME_CONFIG.TILE_DEGREES, lng));
      break;
    case "down":
      player.marker.setLatLng(makeLatLng(lat - GAME_CONFIG.TILE_DEGREES, lng));
      break;
    case "left":
      player.marker.setLatLng(makeLatLng(lat, lng - GAME_CONFIG.TILE_DEGREES));
      break;
    case "right":
      player.marker.setLatLng(makeLatLng(lat, lng + GAME_CONFIG.TILE_DEGREES));
      break;
  }
  player.location.current = makeLatLng(lat, lng);

  generateCache();
  player.line.addLatLng(player.location.current);
  map.panTo(player.marker.getLatLng());
  saveToLocalStorage();
}

function saveToLocalStorage() {
  localStorage.setItem("cache", JSON.stringify(Array.from(caches.entries())));
  localStorage.setItem(
    "tokenCount",
    JSON.stringify(Array.from(tokenCounts.entries())),
  );
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
  const polyLine = mService.getPolyline(location)
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
    marker: mService.getMarker(location),
    line: polyLine,
    inventory: inventory,
    location: location,
  } as Player;
}

function loadExistingCaches(): InitialCache {
  let caches = new Map<CellHash, Cell>(); // caches we generate
  let tokenCounts = new Map<CellHash, number>(); // each cache can mint some coins
  let depositBox = new Map<CellHash, DepositBox>(); // e

  const savedCache = localStorage.getItem("cache");
  const savedTokens = localStorage.getItem("tokenCount");
  const savedDepositBox = localStorage.getItem("depositBox");
  if (savedCache) {
    console.log("found cache in localStorage");
    caches = new Map(JSON.parse(savedCache));
  }
  if (savedTokens) {
    console.log("fond a token count associated with a cache");
    tokenCounts = new Map(JSON.parse(savedTokens));
  }
  if (savedDepositBox) {
    console.log("found depositbox in localStorage");
    depositBox = new Map(JSON.parse(savedDepositBox));
  }
  return [caches, tokenCounts, depositBox];
}

let intervalID: number | undefined;
document.getElementById("toggle")?.addEventListener("click", () => {
  geoLocale = !geoLocale;
  if (geoLocale && navigator.geolocation) {
    document.getElementById("controls")!.style.visibility = "hidden";
    clearInterval(intervalID);
    // Get the current position
    intervalID = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Access the latitude and longitude coordinates
          const { latitude, longitude } = position.coords;
          console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
          if (!windowOpen) {
            player.marker.setLatLng(makeLatLng(latitude, longitude));
            player.location.current = makeLatLng(
              player.marker.getLatLng().lat,
              player.marker.getLatLng().lng,
            );
            player.line.addLatLng(player.location.current);
            map.panTo(player.marker.getLatLng());
            generateCache();
          }
          saveToLocalStorage();
        },
        (error) => {
          alert(error.message);
          clearInterval(intervalID);
          intervalID = undefined;
        },
      );
    }, 1000);
  } else if (!geoLocale) {
    document.getElementById("controls")!.style.visibility = "visible";
    clearInterval(intervalID);
    intervalID = undefined;
  }
});

document.getElementById("reset")?.addEventListener("click", () => {
  const input = confirm(
    "[Warning] \nThis is permanent action and cannot be reversed\nAll game state will be reset",
  );
  if (!input) {
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
