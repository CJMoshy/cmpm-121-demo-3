interface NFT {
  i: string;
  j: string;
  serial: number;
}

type Hash = string;
type Inventory = NFT[];
type DepositBox = NFT[]; // stack

interface Player {
  coins: number;
  //deno-lint-ignore no-explicit-any
  marker: any; // leaflet types not exist
  inventory: Inventory;
}
