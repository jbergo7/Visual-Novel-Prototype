// components/save_load_popup.js
export default class SaveLoadPopup {
  constructor(core) {
    this.core = core;
    this.visible = false;
    this.mode = "save"; // "save" or "load"
    this.hoverButton = { slot: -1, type: null };
    this.closeHover = false;

    // 10 save slots placeholder
    this.slots = Array(10)
      .fill(null)
      .map((_, i) => ({
        id: i,
        screenshot: null,
        header: i === 0 ? "Autosave" : "Slot " + i,
        date: "",
        data: null,
      }));

    this._moveHandler = (e) => this.onMouseMove(e);
    this._clickHandler = (e) => this.onClick(e);

    this.core.canvas.addEventListener("mousemove", this._moveHandler);
    this.core.canvas.addEventListener("click", this._clickHandler);

    this.loadAllSlots();
  }

  // -----------------------------
  // OPEN/CLOSE
  // -----------------------------
  open(mode = "save") {
    this.visible = false; // hide popup first
    //this.core.inputLocked = true;

    this.mode = mode;
    this.loadAllSlots();

    // Wait 2 frames to guarantee menu popup is removed AND scene is redrawn
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Now capture CLEAN scene
        this.prePopupScreenshot = this.core.canvas.toDataURL(
          "image/jpeg",
          0.07
        );

        // Now show the popup
        this.visible = true;
      });
    });
  }

  close() {
    this.visible = false;
    //this.core.inputLocked = false;
  }

  dispose() {
    this.core.canvas.removeEventListener("mousemove", this._moveHandler);
    this.core.canvas.removeEventListener("click", this._clickHandler);
  }

  // -----------------------------
  // LOAD SLOT DATA FROM LOCALSTORAGE
  // -----------------------------
  loadAllSlots() {
    this.slots.forEach((slot, i) => {
      const saved = localStorage.getItem("vn_save_slot_" + i);
      if (saved) {
        const data = JSON.parse(saved);
        slot.date = data.timestamp || "";
        slot.data = data;

        if (data.screenshot) {
          const img = new Image();
          img.src = data.screenshot;
          slot.screenshot = img; // store the Image(), not the base64 string
        } else {
          slot.screenshot = null;
        }
      } else {
        slot.date = "";
        slot.screenshot = null;
        slot.data = null;
      }
    });
  }

  // -----------------------------
  // MOUSE MOVE
  // -----------------------------
  onMouseMove(e) {
    if (!this.visible) return;

    const rect = this.core.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const canvas = this.core.canvas;

    this.hoverButton = { slot: -1, type: null };
    this.closeHover = false;

    // CLOSE BUTTON
    const closeSize = canvas.width * 0.03;
    const closeX = canvas.width * 0.88;
    const closeY = canvas.height * 0.05;

    if (
      x >= closeX &&
      x <= closeX + closeSize &&
      y >= closeY &&
      y <= closeY + closeSize
    ) {
      this.closeHover = true;
      return;
    }

    // CARD GRID
    const cols = 5;
    const cardW = canvas.width * 0.16;
    const cardH = canvas.height * 0.33;
    const gapX = canvas.width * 0.015;
    const gapY = canvas.height * 0.03;
    const startX = canvas.width * 0.05;
    const startY = canvas.height * 0.17;

    this.slots.forEach((slot, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = startX + col * (cardW + gapX);
      const by = startY + row * (cardH + gapY);

      // BUTTONS
      const btnH = cardH * 0.12;
      const btnBottomPadding = cardH * 0.03;
      const btnY = by + cardH - btnH - btnBottomPadding;

      const btnCount = 3;
      const btnSpacing = (cardW - 24) * 0.03;
      const totalBtnWidth = cardW - 24 - btnSpacing * (btnCount - 1);
      const btnW = totalBtnWidth / btnCount;

      ["Save", "Load", "Delete"].forEach((label, idx) => {
        const btnX = bx + 12 + idx * (btnW + btnSpacing);
        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
          this.hoverButton = { slot: i, type: label };
        }
      });
    });
  }

  // -----------------------------
  // CLICK
  // -----------------------------
  onClick(e) {
    if (!this.visible) return;

    // 🔥 block the click from reaching Scene.js
    e.stopImmediatePropagation();
    e.preventDefault();

    if (this.closeHover) {
      this.close();
      return;
    }

    const { slot, type } = this.hoverButton;
    if (slot !== -1 && type) {
      if (type === "Save") this.saveSlot(slot);
      else if (type === "Load") this.loadSlot(slot);
      else if (type === "Delete") this.deleteSlot(slot);
    }
  }

  // -----------------------------
  // SAVE SLOT
  // -----------------------------
  saveSlot(index) {
    const slotKey = "vn_save_slot_" + index;

    const screenshotBase64 = this.prePopupScreenshot;
    const timestamp = new Date().toLocaleString();

    const saveData = {
      timestamp,
      screenshot: screenshotBase64,
      gameState: structuredClone(this.core.gameState),
      characters: structuredClone(this.core.characters),
    };

    localStorage.setItem(slotKey, JSON.stringify(saveData));

    // PRELOAD the image into the slot for rendering
    const img = new Image();
    img.src = screenshotBase64;

    this.slots[index].date = timestamp;
    this.slots[index].screenshot = img;
    this.slots[index].data = saveData;

    console.log(`Saved slot ${index}`);
  }

  // -----------------------------
  // LOAD SLOT + AUTO CONTINUE GAME
  // -----------------------------
  async loadSlot(index) {
    const slot = this.slots[index].data;

    if (!slot) {
      console.warn("Slot empty!");
      return;
    }

    console.log(`Loading slot ${index}`, slot);

    // Restore game state + characters
    this.core.gameState = structuredClone(slot.gameState);
    this.core.characters = structuredClone(slot.characters);
    this.core.currentCharacter =
      this.core.characters.find((ch) => ch.default === true) ||
      this.core.characters[0];

    // -----------------------------------------
    // 🔥 HARD-CODED RESUME LOGIC
    // -----------------------------------------
    const gs = this.core.gameState;

    // ⚡ Load BACKGROUND if active
    if (gs.currentBackground?.active) {
      const { Background } = await import("../background.js");
      const bg = new Background(this.core, gs.currentBackground.target);
      await bg.load();
      // Close popup first
      this.close();
      this.core.setActiveScene(bg);
      return;
    }

    // ⚡ Load SCENE if active
    if (gs.currentScene?.active) {
      const { Scene } = await import("../scene.js");
      const scene = new Scene(this.core, gs.currentScene.target);
      await scene.load();

      const savedIndex =
        typeof gs.currentScene.dialogues === "number"
          ? gs.currentScene.dialogues
          : 0;

      // restore line pointer
      scene.currentLine = savedIndex;
      scene.resumeIndex = savedIndex;
      // Close popup first
      this.core.setActiveScene(scene);
      this.close();
      return;
    }

    console.warn("⚠️ No scene or background active in save file!");
  }

  // -----------------------------
  // DELETE
  // -----------------------------
  deleteSlot(index) {
    const slotKey = "vn_save_slot_" + index;
    localStorage.removeItem(slotKey);

    this.slots[index].date = "";
    this.slots[index].screenshot = null;
    this.slots[index].data = null;

    console.log(`Deleted slot ${index}`);
  }

  // -----------------------------
  // DRAW BUTTON
  // -----------------------------
  drawButton(ctx, x, y, w, h, label, isHover) {
    let disabled = false;
    if (this.mode === "save" && label === "Load") disabled = true;
    if (this.mode === "load" && label === "Save") disabled = true;

    ctx.fillStyle = disabled
      ? "rgba(255,255,255,0.08)"
      : isHover
      ? "rgba(255,255,255,0.35)"
      : "rgba(255,255,255,0.2)";

    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = disabled ? "rgba(255,255,255,0.5)" : "#fff";
    ctx.font = `${h * 0.6}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  // -----------------------------
  // RENDER
  // -----------------------------
  render(ctx) {
    if (!this.visible) return;

    const canvas = this.core.canvas;

    // BG
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // TITLE
    ctx.fillStyle = "#fff";
    ctx.font = `${canvas.height * 0.045}px Arial`;
    ctx.textAlign = "left";
    const titleText = this.mode === "save" ? "Save Game" : "Load Game";
    ctx.fillText(titleText, canvas.width * 0.05, canvas.height * 0.07);

    // CLOSE BUTTON
    const closeSize = canvas.width * 0.03;
    const closeX = canvas.width * 0.88;
    const closeY = canvas.height * 0.05;
    ctx.fillStyle = this.closeHover ? "red" : "white";
    ctx.fillRect(closeX, closeY, closeSize, closeSize);
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${closeSize * 0.7}px Arial`;
    ctx.fillText("X", closeX + closeSize / 2, closeY + closeSize / 2);

    // CARD GRID
    const cols = 5;
    const cardW = canvas.width * 0.16;
    const cardH = canvas.height * 0.33;
    const gapX = canvas.width * 0.015;
    const gapY = canvas.height * 0.03;
    const startX = canvas.width * 0.05;
    const startY = canvas.height * 0.17;

    this.slots.forEach((slot, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = startX + col * (cardW + gapX);
      const by = startY + row * (cardH + gapY);

      // Card Background
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(bx, by, cardW, cardH);

      // Header
      const headerH = cardH * 0.12;
      ctx.fillStyle = "#fff";
      ctx.font = `${headerH * 0.8}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(slot.header, bx + cardW / 2, by + 8);

      // Thumbnail
      const thumbH = cardH * 0.55;
      const thumbY = by + headerH + 8;
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(bx + 12, thumbY, cardW - 24, thumbH - 12);

      if (slot.screenshot instanceof Image) {
        ctx.drawImage(
          slot.screenshot,
          bx + 12,
          thumbY,
          cardW - 24,
          thumbH - 12
        );
      } else {
        ctx.fillStyle = "#fff";
        ctx.font = `${thumbH * 0.14}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Empty", bx + cardW / 2, thumbY + (thumbH - 12) / 2);
      }

      // Buttons
      const btnH = cardH * 0.12;
      const btnBottomPadding = cardH * 0.03;
      const btnY = by + cardH - btnH - btnBottomPadding;

      const btnCount = 3;
      const btnSpacing = (cardW - 24) * 0.03;
      const totalBtnWidth = cardW - 24 - btnSpacing * (btnCount - 1);
      const btnW = totalBtnWidth / btnCount;

      ["Save", "Load", "Delete"].forEach((label, idx) => {
        const btnX = bx + 12 + idx * (btnW + btnSpacing);
        const isHover =
          this.hoverButton.slot === i && this.hoverButton.type === label;
        this.drawButton(ctx, btnX, btnY, btnW, btnH, label, isHover);
      });

      // Middle timestamp text
      const spaceTop = thumbY + thumbH - 12;
      const spaceBottom = btnY;
      const middleY = spaceTop + (spaceBottom - spaceTop) / 2;
      ctx.fillStyle = "#fff";
      ctx.font = `${btnH * 0.6}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(slot.date, bx + cardW / 2, middleY);
    });
  }
}
