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

    // 💰 Apply money changes
    if (typeof current.money === "number" && current.money !== 0) {
      c.money += current.money;
      const amount = Math.abs(current.money);
      const message =
        current.money < 0 ? `-$${amount} Money` : `+$${amount} Money`;
      const color = current.money < 0 ? "red" : "green";
      this.popupNotif?.show(message, color);
      console.log(`${c.name} money updated: ${c.money}`);
    }

    // ⚡ Apply energy changes
    if (current.energy !== undefined) {
      const prevEnergy = c.energy;
      const maxEnergy = c.max_energy ?? Infinity;

      // ✅ Special case: "reset"
      if (current.energy === "reset") {
        c.energy = maxEnergy;
        this.popupNotif?.show("Energy Restored", "green");
        console.log(`${c.name} energy reset: ${c.energy}/${maxEnergy}`);
        return;
      }

      // ✅ Numeric add/subtract
      if (typeof current.energy === "number" && current.energy !== 0) {
        // Already full before adding
        if (current.energy > 0 && prevEnergy >= maxEnergy) {
          this.popupNotif?.show("Max Energy Reached", "green");
          console.log(`${c.name} is already at max energy.`);
          return;
        }

        c.energy += current.energy;

        // Enforce cap
        if (c.energy > maxEnergy) c.energy = maxEnergy;
        if (c.energy < 0) c.energy = 0;

        const diff = c.energy - prevEnergy;
        const amount = Math.abs(diff);

        if (amount > 0) {
          const message = diff < 0 ? `-${amount} Energy` : `+${amount} Energy`;
          const color = diff < 0 ? "red" : "green";
          this.popupNotif?.show(message, color);
        }

        // Just reached max after adding
        if (
          current.energy > 0 &&
          c.energy === maxEnergy &&
          prevEnergy < maxEnergy
        ) {
          this.popupNotif?.show("Max Energy Reached", "green");
        }

        console.log(`${c.name} energy updated: ${c.energy}/${maxEnergy}`);
      }
    }
  }

  /**
   * Adjusts the max energy of the character.
   * Positive value increases cap, negative decreases (not below current energy).
   */
  modifyMaxEnergy(amount) {
    const c = this.core.currentCharacter;
    if (!c) return;

    if (typeof amount !== "number" || amount === 0) return;

    c.max_energy = Math.max(0, (c.max_energy || 0) + amount);

    // Adjust current energy if it exceeds new max
    if (c.energy > c.max_energy) {
      c.energy = c.max_energy;
    }

    const msg =
      amount > 0 ? `+${amount} Max Energy` : `${amount} Max Energy Reduced`;
    const color = amount > 0 ? "green" : "red";
    this.popupNotif?.show(msg, color);

    console.log(
      `${c.name} max energy changed: ${c.max_energy}, current: ${c.energy}`
    );
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
