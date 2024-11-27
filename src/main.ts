// @deno-types="npm:@types/leaflet@^1.9.14"

import "./style.css";
import { makeLatLng } from "./controller/MapService.ts";
import MapService from "./controller/MapService.ts";
import CacheManager from "./controller/CacheManager.ts";
import UIManager from "./controller/UIManager.ts";
import PlayerController from "./controller/PlayerController.ts";

export const GAME_CONFIG = {
  spawnLocations: {
    NULL_ISLAND: makeLatLng(0, 0), // replaced leaflet lat lng with generic function
    OAKES_CLASSROOM: makeLatLng(36.98949379578401, -122.06277128548504),
  },
  GAMEPLAY_ZOOM_LEVEL: 19,
  TILE_DEGREES: 1e-4,
  NEIGHBORHOOD_SIZE: 8,
  CACHE_SPAWN_PROBABILITY: 0.05,
};

function main() {
  const SPAWN = GAME_CONFIG.spawnLocations.OAKES_CLASSROOM;

  // map service provider is now wrapped in its own class to reduce coupling
  const mService = new MapService(document);

  // the controllers still often need references to the other controllers and parts of them, so all these references are public static

  // create the map with the mapService provider (leaflet)
  const map = mService.loadMap({
    spawn: SPAWN,
    zoom: GAME_CONFIG.GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAME_CONFIG.GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAME_CONFIG.GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false,
  });

  // simple ui stuff for user
  // all of this exists statically on the UI manager
  // this pattern was suggested by brace, and while I understand it,
  // I likely would have passed more into the constructor
  const UIManagerInstance = new UIManager(
    document.querySelector<HTMLDivElement>("#coins")!,
    mService.initChunkSystem(),
  );

  // load player
  const player = new PlayerController(SPAWN, mService, map);

  //TODO FIX
  let geoLocale: boolean = false;

  // following SOLID here, Single responsibility means delegating different/unrelated parts of the program to different modules
  const cacheM = new CacheManager(
    CacheManager.loadExistingCaches(),
    mService,
    player,
    UIManagerInstance,
  );

  player.setCacheManager(cacheM);
  UIManagerInstance.setCoinCountUI(player.inventory);
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
            if (!UIManagerInstance.windowOpen) {
              player.marker.setLatLng(makeLatLng(latitude, longitude));
              player.location.current = makeLatLng(
                player.marker.getLatLng().lat,
                player.marker.getLatLng().lng,
              );
              player.polyLine.addLatLng(player.location.current);
              map.panTo(player.marker.getLatLng());
              cacheM.generateCache(
                map,
              );
            }
            cacheM.saveToLocalStorage();
            player.savePlayerState();
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
    cacheM.caches.clear();
    cacheM.depositBox.clear();
    player.inventory.length = 0;
    player.polyLine.setLatLngs([]);
    localStorage.clear();
    for (const x of UIManagerInstance.getVisualChunks()) {
      x.clearLayers();
    }
    UIManagerInstance.getVisualChunks().length = 0;
    document.getElementById("coins")!.innerHTML = player.inventory.length
      .toString();
    document.getElementById("recent")!.innerHTML = "";
    cacheM.generateCache(
      map,
    );
  });

  document.getElementById("up")?.addEventListener("click", () => {
    player.movePlayerCommand("up");
  });

  document.getElementById("down")?.addEventListener("click", () => {
    player.movePlayerCommand("down");
  });

  document.getElementById("left")?.addEventListener("click", () => {
    player.movePlayerCommand("left");
  });

  document.getElementById("right")?.addEventListener("click", () => {
    player.movePlayerCommand("right");
  });

  player.marker.bindTooltip("You are here!");
  player.marker.addTo(map);
  map.panTo(player.marker.getLatLng());
  cacheM.generateCache(
    map,
  );
}

main();
