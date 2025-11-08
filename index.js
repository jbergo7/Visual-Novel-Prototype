import { GameCore } from "./scripts/gamecore.js";
import { TitleScreen } from "./scripts/titlescreen.js";

window.addEventListener("load", async () => {
  const core = new GameCore("gameCanvas");
  await core.initialize();

  // Load Title Screen
  const title = new TitleScreen(core);
  core.setActiveScene(title);
});
