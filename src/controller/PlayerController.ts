// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import { makeLatLng } from "./MapService.ts";
import MapService from "./MapService.ts";
import CacheManager from "./CacheManager.ts";
import { GAME_CONFIG } from "../main.ts";

export default class PlayerController {
  public inventory: Inventory;
  public location: PlayerLocation;
  public marker: leaflet.Marker;
  public polyLine: leaflet.Polyline;
  public static mService: MapService;
  public static mRef: leaflet.Map;
  public static cacheM: CacheManager;

  constructor(spawn: LatLng) {
    this.inventory = [];
    this.location = {
      current: spawn,
      previous: spawn,
    };
    this.marker = PlayerController.mService.initMarker(this.location);

    this.polyLine = PlayerController.mService.getPolyline(this.location)
      .addTo(PlayerController.mRef);

    const savedInventory = localStorage.getItem("inventory");
    const savedLocation = localStorage.getItem("location");
    const savedPolyline = localStorage.getItem("poly");

    if (savedInventory) {
      console.log("found inventory in localStorage");
      const parsed = JSON.parse(savedInventory);
      this.inventory = [...parsed];
      console.log(this.inventory);
    }
    if (savedLocation) {
      console.log("found a location in localStorage");
      const parsed = JSON.parse(savedLocation);
      this.location = { ...parsed };
      this.marker.setLatLng(this.location.current);
    }
    if (savedPolyline) {
      console.log("found a polyline");
      const parsed = JSON.parse(savedPolyline);
      this.polyLine.setLatLngs([...parsed]);
    }
  }

  savePlayerState() {
    console.log("saving inv", this.inventory);
    localStorage.setItem("inventory", JSON.stringify(this.inventory));
    localStorage.setItem("location", JSON.stringify(this.location));
    localStorage.setItem("poly", JSON.stringify(this.polyLine.getLatLngs()));
  }

  movePlayerCommand(direction: DirectionCommand) {
    const { lat, lng } = this.marker.getLatLng();
    switch (direction) {
      case "up":
        this.marker.setLatLng(
          makeLatLng(lat + GAME_CONFIG.TILE_DEGREES, lng),
        );
        break;
      case "down":
        this.marker.setLatLng(
          makeLatLng(lat - GAME_CONFIG.TILE_DEGREES, lng),
        );
        break;
      case "left":
        this.marker.setLatLng(
          makeLatLng(lat, lng - GAME_CONFIG.TILE_DEGREES),
        );
        break;
      case "right":
        this.marker.setLatLng(
          makeLatLng(lat, lng + GAME_CONFIG.TILE_DEGREES),
        );
        break;
    }
    this.location.current = makeLatLng(lat, lng);

    PlayerController.cacheM.generateCache(
      PlayerController.mRef,
    );
    this.polyLine.addLatLng(this.location.current);
    PlayerController.mRef.panTo(this.marker.getLatLng());
    PlayerController.cacheM.saveToLocalStorage();
    this.savePlayerState();
  }
}
