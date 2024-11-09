interface NFT {
  i: string;
  j: string;
  serial: number;
}

type CellHash = string;

type Inventory = NFT[];
type DepositBox = NFT[];

interface Player {
  //deno-lint-ignore no-explicit-any
  marker: any; // leaflet types not exist
  inventory: Inventory;
}
