// @deno-types="npm:@types/leaflet@^1.9.14"

import leaflet from "leaflet";
import "../leafletWorkaround.ts";
import CacheManager from "./CacheManager.ts";
import PlayerController from "./PlayerController.ts";

export default class UIManager {
  public static coinCountUI: HTMLDivElement;
  public static windowOpen: boolean;
  public static visualChunks: leaflet.LayerGroup[];
  static createPopup(
    IHASH: string,
    JHASH: string,
    HASH: string,
    cacheManager: CacheManager,
    player: PlayerController,
  ): HTMLDivElement {
    this.windowOpen = true;
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div id='wrapper'>
        <div>
          Cache Location: ${IHASH} lat  ${JHASH} lng
          <br>
          Available Tokens for Mint: 
          <span id="value">
            ${cacheManager.tokenCounts.get(HASH)?.toString()}
          </span>
        </div>
        <div>
          Available Unique Tokens: 
          <span id='tokens'>
          ${cacheManager.depositBox.get(HASH)?.length || 0}
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
        cacheManager.tokenCounts.get(HASH)!.toString();
      popupDiv.querySelector<HTMLSpanElement>("#tokens")!.innerHTML =
        (cacheManager.depositBox.get(HASH)?.length)?.toString() || "0";

      this.coinCountUI.innerHTML = `${player.inventory.length}`;
    };
    // and then encapsulate that function and the save into one helper as its called on each interaction
    const handleGenericInteration = () => {
      updateUserCoinView();
      cacheManager.saveToLocalStorage();
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
        if (!cacheManager.depositBox.has(HASH)) { // check if the hash does not have a deposit box already
          cacheManager.depositBox.set(
            HASH,
            [token],
          );
        } else {
          const dBox = cacheManager.depositBox.get(HASH)!;
          dBox?.push(token);
          cacheManager.depositBox.set(HASH, dBox);
        }
        document.getElementById("recent")!.textContent =
          `Player deposited token: {${token.i}:${token.j}:${token.serial}}`;
        handleGenericInteration();
      });

    popupDiv.querySelector<HTMLButtonElement>("#withdrawal")!
      .addEventListener("click", () => {
        const dBox = cacheManager.depositBox.get(HASH);
        if (dBox !== undefined && dBox.length > 0) { // if tokens exist in this caches deposit box
          const token = dBox.pop()!;
          player.inventory.push(token); // give player a token
          cacheManager.depositBox.set(HASH, dBox);
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
        if (cacheManager.tokenCounts.get(HASH)! <= 0) { // can this cache still mint?
          alert("No Tokens Available for Mint");
          return;
        }
        cacheManager.tokenCounts.set(
          HASH,
          cacheManager.tokenCounts.get(HASH)! - 1,
        );
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
  }
}
