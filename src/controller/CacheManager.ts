// CacheManager.ts
import leaflet from "leaflet";
import "../leafletWorkaround.ts";
import luck from "../luck.ts";
import UIManager from "./UIManager.ts";
import { GAME_CONFIG } from "../main.ts";
import MapService from "./MapService.ts";
import PlayerController from "./PlayerController.ts";
type CacheState = {
  caches: Map<CellHash, Cell>;
  tokenCounts: Map<CellHash, number>;
  depositBox: Map<CellHash, DepositBox>;
};

export default class CacheManager {
  public caches: Map<CellHash, Cell>;
  public tokenCounts: Map<CellHash, number>;
  public depositBox: Map<CellHash, DepositBox>;
  private player: PlayerController;
  private mService: MapService;

  constructor(
    existingState: CacheState | null = null,
    mService: MapService,
    player: PlayerController,
  ) {
    this.mService = mService;
    this.player = player;
    if (existingState) {
      this.caches = existingState.caches;
      this.tokenCounts = existingState.tokenCounts;
      this.depositBox = existingState.depositBox;
    } else {
      this.caches = new Map();
      this.tokenCounts = new Map();
      this.depositBox = new Map();
    }
  }

  static loadExistingCaches(): CacheState {
    const savedCache = JSON.parse(localStorage.getItem("cache") || "[]");
    const savedTokens = JSON.parse(localStorage.getItem("tokenCount") || "[]");
    const savedDepositBox = JSON.parse(
      localStorage.getItem("depositBox") || "[]",
    );
    return {
      caches: new Map(savedCache),
      tokenCounts: new Map(savedTokens),
      depositBox: new Map(savedDepositBox),
    };
  }

  saveToLocalStorage(): void {
    localStorage.setItem(
      "cache",
      JSON.stringify(Array.from(this.caches.entries())),
    );
    localStorage.setItem(
      "tokenCount",
      JSON.stringify(Array.from(this.tokenCounts.entries())),
    );
    localStorage.setItem(
      "depositBox",
      JSON.stringify(Array.from(this.depositBox.entries())),
    );
  }

  addCache(bounds: leaflet.LatLngBounds, i: number, j: number): CellHash {
    const IHASH = Math.floor(bounds.getCenter().lat / GAME_CONFIG.TILE_DEGREES);
    const JHASH = Math.floor(bounds.getCenter().lng / GAME_CONFIG.TILE_DEGREES);
    const HASH = IHASH.toString() + JHASH.toString();

    if (!this.caches.has(HASH)) {
      const cell = { i: IHASH, j: JHASH };
      this.caches.set(HASH, cell);
      this.tokenCounts.set(
        HASH,
        Math.floor(luck([i, j, "initialValue"].toString()) * 25) + 1,
      );
    }

    return HASH;
  }

  spawnCache(i: number, j: number): leaflet.Rectangle {
    // Convert cell numbers into lat/lng bounds
    const bounds = this.mService.getLatLngBounds(
      i,
      j,
      GAME_CONFIG.TILE_DEGREES,
    );

    // brace made me this... generate random color hex
    // I replaced it with luck to deterministically generate the colors, random colors each time
    // ws proving to be too confusing
    console.log(i, j);
    const randomColor = () => (
      "#" +
      Array.from(
        { length: 6 },
        () =>
          "0123456789ABCDEF"[
            Math.floor(luck([i, j].toString() + "HELPER") * 16)
          ],
      ).join("")
    );
    const rect = this.mService.getRect(bounds, randomColor);

    //store info about cache so we can give it statefulness ONLY IF IT HAS NOT BEEN MADE
    const IHASH = Math.floor(bounds.getCenter().lat / GAME_CONFIG.TILE_DEGREES);
    const JHASH = Math.floor(bounds.getCenter().lng / GAME_CONFIG.TILE_DEGREES);
    const HASH = IHASH.toString() + JHASH.toString();

    // cell has not been made yet
    if (this.caches.has(HASH) === false) {
      const cell = {
        i: IHASH,
        j: JHASH,
      };
      this.caches.set(HASH, cell);
      this.tokenCounts.set(
        HASH,
        Math.floor(luck([i, j, "initialValue"].toString()) * 25) + 1,
      );
    }

    // Handle interactions with the cache
    try {
      rect.bindPopup(() =>
        UIManager.createPopup(
          IHASH.toString(),
          JHASH.toString(),
          HASH,
          this,
          this.player,
        )
      );
    } catch (e) {
      console.log(e);
    }
    rect.getPopup()?.on("remove", () => {
      UIManager.windowOpen = false;
    });
    return rect;
  }

  generateCache(
    map: leaflet.Map,
  ): void {
    const layer = this.mService.getLayerGroup();
    layer.addTo(map);
    // Look around the player's neighborhood for caches to spawn
    const playerCell: Cell = {
      i: Math.floor(
        this.player.marker.getLatLng().lat / GAME_CONFIG.TILE_DEGREES,
      ),
      j: Math.floor(
        this.player.marker.getLatLng().lng / GAME_CONFIG.TILE_DEGREES,
      ),
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
          const rect = this.spawnCache(currentCell.i, currentCell.j);
          rect.addTo(layer);
        }
      }
    }
    UIManager.visualChunks.push(layer);
    if (UIManager.visualChunks.length >= 2) {
      const chunkToDelete = UIManager.visualChunks
        .shift() as leaflet.LayerGroup;
      chunkToDelete.clearLayers(); // garbage collection will snag this now
    }
    // ... (move generate cache logic here)
  }
}
