type CellHash = string;
type MoveCommand = "up" | "down" | "left" | "right";
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
  //deno-lint-ignore no-explicit-any
  marker: any; // leaflet types not exist
  inventory: Inventory;
}
