export default class SaveLoad {
  constructor() {}
  /**
   * @param {Object} core - Ipinasa ang core object dito.
   */
  autosave(core) {
    const slotKey = "vn_save_slot_0";
    const timestamp = new Date().toLocaleString();
    // Delay to next frame so siguradong rendered ang scene
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const screenshotBase64 = core.canvas.toDataURL("image/jpeg", 0.07);

        const saveData = {
          timestamp,
          screenshot: screenshotBase64,
          gameState: structuredClone(core.gameState),
          characters: structuredClone(core.characters),
        };

        localStorage.setItem(slotKey, JSON.stringify(saveData));
      });
    });
  }
}
