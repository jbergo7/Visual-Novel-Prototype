// stats_manager.js
export class StatsManager {
  constructor(core) {
    this.core = core;
    this.popupNotif = core.popupNotif; // shared popup system from core
  }

  /**
   * Applies stat changes (money/energy) to the current character.
   * Automatically triggers popup notifications.
   */
  applyStats(current) {
    const c = this.core.currentCharacter;
    if (!c) return;

    // Apply money changes
    if (typeof current.money === "number" && current.money !== 0) {
      c.money += current.money;
      const amount = Math.abs(current.money);
      const message =
        current.money < 0 ? `-$${amount} Money` : `+$${amount} Money`;
      const color = current.money < 0 ? "red" : "green";
      this.popupNotif?.show(message, color);
      console.log(`${c.name} money updated: ${c.money}`);
    }

    // Apply energy changes
    if (typeof current.energy === "number" && current.energy !== 0) {
      c.energy += current.energy;
      const amount = Math.abs(current.energy);
      const message =
        current.energy < 0 ? `-${amount} Energy` : `+${amount} Energy`;
      const color = current.energy < 0 ? "red" : "green";
      this.popupNotif?.show(message, color);
      console.log(`${c.name} energy updated: ${c.energy}`);
    }
  }

  /**
   * Checks if a character has enough resources before performing an action.
   * Returns an object: { enough: boolean, message: string|null }
   */
  checkResources(cost) {
    const c = this.core.currentCharacter;
    if (!c) return { enough: false, message: "No character loaded" };

    if (typeof cost.energy === "number" && c.energy + cost.energy < 0) {
      return { enough: false, message: "Not Enough Energy" };
    }

    if (typeof cost.money === "number" && c.money + cost.money < 0) {
      return { enough: false, message: "Not Enough Money" };
    }

    return { enough: true, message: null };
  }
}
