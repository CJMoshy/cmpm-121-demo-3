import { LatLng, Marker } from "types/leaflet";

declare global {
  type CellHash = string;
  interface Cell {
    readonly i: number;
    readonly j: number;
  }

  interface NFT {
    i: string;
    j: string;
    serial: number;
  }
  type Inventory = NFT[];
  type DepositBox = NFT[];

  interface Player {
    marker: Marker;
    inventory: Inventory;
    location: {
      current: LatLng;
      previous: LatLng;
    };
  }

  type MoveCommand = "up" | "down" | "left" | "right";
}
