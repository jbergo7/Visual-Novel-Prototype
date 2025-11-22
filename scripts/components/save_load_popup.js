// components/save_load_popup.js
export default class SaveLoadPopup {
  constructor(core) {
    this.core = core;
    this.visible = false;
    this.mode = "save"; // "save" or "load"
    this.hoverButton = { slot: -1, type: null };
    this.closeHover = false;

    // ----------------------------------------------------
    // 🔥 REUSABLE MODAL STATE
    // ----------------------------------------------------
    this.modal = {
      visible: false,
      message: "", // The text to display (e.g. "Overwrite?", "Delete?")
      subMessage: "", // Additional info (e.g. "(Slot 1)")
      onConfirm: null, // Function to run when the user clicks YES
      hoverYes: false,
      hoverNo: false,
    };

    // A. Declare number of slots
    this.totalSlots = 30;

    // B. Layout-based calculation: 2 rows * 5 columns
    const SLOTS_ROWS = 2;
    const SLOTS_COLS = 5;

    this.slotsPerPage = SLOTS_ROWS * SLOTS_COLS; // 10
    this.totalPages = Math.ceil(this.totalSlots / this.slotsPerPage);
    this.currentPage = 1;

    this.slots = Array(this.slotsPerPage)
      .fill(null)
      .map((_, i) => ({
        id: i,
        screenshot: null,
        header: "Slot " + i,
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
    this.visible = false;
    this.modal.visible = false; // Reset modal

    this.mode = mode;
    this.loadAllSlots();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.prePopupScreenshot = this.core.canvas.toDataURL(
          "image/jpeg",
          0.07
        );
        this.visible = true;
      });
    });
  }

  close() {
    this.visible = false;
    this.modal.visible = false;
  }

  dispose() {
    this.core.canvas.removeEventListener("mousemove", this._moveHandler);
    this.core.canvas.removeEventListener("click", this._clickHandler);
  }

  // -----------------------------
  // LOAD SLOT DATA
  // -----------------------------
  loadAllSlots() {
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const start = (this.currentPage - 1) * this.slotsPerPage;
    const end = Math.min(start + this.slotsPerPage, this.totalSlots);
    const slotsToRender = end - start;

    this.slots = Array(slotsToRender)
      .fill(null)
      .map((_, i) => {
        const slotIndex = start + i;
        const slot = {
          id: slotIndex,
          screenshot: null,
          header: slotIndex === 0 ? "Autosave" : "Slot " + slotIndex,
          date: "",
          data: null,
        };

        const saved = localStorage.getItem("vn_save_slot_" + slotIndex);

        if (saved) {
          const data = JSON.parse(saved);
          slot.date = data.timestamp || "";
          slot.data = data;

          if (data.screenshot) {
            const img = new Image();
            img.src = data.screenshot;
            slot.screenshot = img;
          }
        }
        return slot;
      });
  }

  // -----------------------------
  // 🛠️ HELPER: TEXT WRAPPING
  // -----------------------------
  // Splits long text into a lines array based on maxWidth
  getLines(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  // -----------------------------
  // 🛠️ HELPER: CALCULATE MODAL LAYOUT
  // -----------------------------
  // This calculates the size and positions to keep drawing and mouse detection consistent
  getModalLayout(ctx, canvas) {
    const modalW = canvas.width * 0.4;
    const padding = modalW * 0.1;

    // Fonts
    const fontSize = canvas.height * 0.03; // Base text size
    ctx.font = `${fontSize}px Arial`;

    // Wrap text logic
    const maxTextWidth = modalW - padding * 2;
    const textLines = this.getLines(ctx, this.modal.message, maxTextWidth);

    // Submessage (optional)
    const subMsgLines = this.modal.subMessage
      ? this.getLines(ctx, this.modal.subMessage, maxTextWidth)
      : [];

    // Calculate Heights
    const lineHeight = fontSize * 1.5;
    const textBlockH = (textLines.length + subMsgLines.length) * lineHeight;

    const btnH = canvas.height * 0.05;
    const btnGap = canvas.height * 0.04; // gap between text and buttons

    // 🔥 DYNAMIC HEIGHT CALCULATION
    // Padding Top + Text Block + Gap + Button Height + Padding Bottom
    const modalH = padding + textBlockH + btnGap + btnH + padding;

    const modalX = (canvas.width - modalW) / 2;
    const modalY = (canvas.height - modalH) / 2;

    // Button Positions
    const btnW = modalW * 0.3;
    const btnY = modalY + modalH - padding - btnH; // Anchor to bottom padding
    const yesX = modalX + modalW * 0.15;
    const noX = modalX + modalW - btnW - modalW * 0.15;

    return {
      modalX,
      modalY,
      modalW,
      modalH,
      textLines,
      subMsgLines,
      lineHeight,
      btnX: { yes: yesX, no: noX },
      btnY,
      btnW,
      btnH,
      padding,
    };
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

    // --- Modal Hover Logic (Reusable) ---
    if (this.modal.visible) {
      this.modal.hoverYes = false;
      this.modal.hoverNo = false;

      const ctx = canvas.getContext("2d"); // Need ctx for measurement
      const layout = this.getModalLayout(ctx, canvas);

      if (
        x >= layout.btnX.yes &&
        x <= layout.btnX.yes + layout.btnW &&
        y >= layout.btnY &&
        y <= layout.btnY + layout.btnH
      ) {
        this.modal.hoverYes = true;
      } else if (
        x >= layout.btnX.no &&
        x <= layout.btnX.no + layout.btnW &&
        y >= layout.btnY &&
        y <= layout.btnY + layout.btnH
      ) {
        this.modal.hoverNo = true;
      }
      return; // Block interaction with slots underneath
    }

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

    // CARD GRID (Standard hover logic)
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

      const btnH = cardH * 0.12;
      const btnBottomPadding = cardH * 0.03;
      const btnY = by + cardH - btnH - btnBottomPadding;

      const btnCount = 3;
      const btnSpacing = (cardW - 24) * 0.03;
      const totalBtnWidth = cardW - 24 - btnSpacing * (btnCount - 1);
      const btnW = totalBtnWidth / btnCount;

      ["Save", "Load", "Delete"].forEach((label, idx) => {
        const btnX = bx + 12 + idx * (btnW + btnSpacing);

        if (label === "Save" && this.mode === "load") return;
        if (label === "Load" && this.mode === "save") return;
        if (label === "Delete" && !slot.data) return;

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

    e.stopImmediatePropagation();
    e.preventDefault();

    const rect = this.core.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const canvas = this.core.canvas;

    // --- Modal Click Logic (Reusable) ---
    if (this.modal.visible) {
      if (this.modal.hoverYes && this.modal.onConfirm) {
        this.modal.onConfirm(); // Run the stored action
        this.modal.visible = false;
      } else if (this.modal.hoverNo) {
        this.modal.visible = false; // Just close
      }
      return;
    }

    if (this.closeHover) {
      this.close();
      return;
    }

    // PAGINATION
    const btnW = canvas.width * 0.12;
    const btnH = canvas.height * 0.06;
    const btnY = canvas.height * 0.93;
    const prevX = canvas.width * 0.3;
    const nextX = canvas.width * 0.58;

    if (x >= prevX && x <= prevX + btnW && y >= btnY && y <= btnY + btnH) {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadAllSlots();
      }
      return;
    }

    if (x >= nextX && x <= nextX + btnW && y >= btnY && y <= btnY + btnH) {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.loadAllSlots();
      }
      return;
    }

    // SLOT BUTTONS
    const { slot, type } = this.hoverButton;
    if (slot !== -1 && type) {
      const realIndex = this.slots[slot].id;
      const s = this.slots[slot];

      if (type === "Save" && this.mode === "load") return;
      if (type === "Load" && this.mode === "save") return;
      if (type === "Delete" && !s.data) return;

      if (type === "Save") {
        // 🔥 OVERWRITE CHECK
        if (s.data) {
          this.showModal(
            "This slot already contains data. Do you want to overwrite it?",
            `(Slot ${realIndex})`,
            () => this._executeSave(realIndex)
          );
        } else {
          this._executeSave(realIndex);
        }
      } else if (type === "Load") {
        this.loadSlot(realIndex);
      } else if (type === "Delete") {
        // 🔥 DELETE CONFIRMATION
        this.showModal(
          "Are you sure you want to delete this saved data? This cannot be undone.",
          `(Slot ${realIndex})`,
          () => this._executeDelete(realIndex)
        );
      }
    }
  }

  // -----------------------------
  // SHOW MODAL HELPER
  // -----------------------------
  showModal(message, subMessage, onConfirm) {
    this.modal.message = message;
    this.modal.subMessage = subMessage;
    this.modal.onConfirm = onConfirm;
    this.modal.visible = true;
    this.modal.hoverYes = false;
    this.modal.hoverNo = false;
  }

  // -----------------------------
  // ACTION: SAVE
  // -----------------------------
  _executeSave(index) {
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

    const currentSlot = this.slots.find((s) => s.id === index);
    if (currentSlot) {
      const img = new Image();
      img.src = screenshotBase64;
      currentSlot.date = timestamp;
      currentSlot.screenshot = img;
      currentSlot.data = saveData;
    } else {
      this.loadAllSlots();
    }
    console.log(`Saved slot ${index}`);
  }

  // -----------------------------
  // ACTION: DELETE (Refactored to private)
  // -----------------------------
  _executeDelete(index) {
    const slotKey = "vn_save_slot_" + index;
    localStorage.removeItem(slotKey);

    const currentSlot = this.slots.find((s) => s.id === index);
    if (currentSlot) {
      currentSlot.date = "";
      currentSlot.screenshot = null;
      currentSlot.data = null;
    } else {
      this.loadAllSlots();
    }
    console.log(`Deleted slot ${index}`);
  }

  // Public Delete wrapper (triggers modal if called externally, though onClick handles UI)
  deleteSlot(index) {
    this.showModal("Delete this slot?", `(Slot ${index})`, () =>
      this._executeDelete(index)
    );
  }

  // -----------------------------
  // LOAD LOGIC (Standard)
  // -----------------------------
  async loadSlot(index) {
    const currentSlot = this.slots.find((s) => s.id === index);
    const slot = currentSlot ? currentSlot.data : null;

    if (!slot) return;

    this.core.gameState = structuredClone(slot.gameState);
    this.core.characters = structuredClone(slot.characters);
    this.core.currentCharacter =
      this.core.characters.find((ch) => ch.default === true) ||
      this.core.characters[0];

    const gs = this.core.gameState;

    if (gs.currentBackground?.active) {
      const { Background } = await import("../background.js");
      const bg = new Background(this.core, gs.currentBackground.target);
      await bg.load();
      this.close();
      this.core.setActiveScene(bg);
      return;
    }

    if (gs.currentScene?.active) {
      const { Scene } = await import("../scene.js");
      const scene = new Scene(this.core, gs.currentScene.target);
      await scene.load();
      const savedIndex =
        typeof gs.currentScene.dialogues === "number"
          ? gs.currentScene.dialogues
          : 0;
      scene.currentLine = savedIndex;
      scene.resumeIndex = savedIndex;
      this.core.setActiveScene(scene);
      this.close();
      return;
    }
  }

  drawButton(ctx, x, y, w, h, label, isHover, slot) {
    let disabled = false;
    if (this.mode === "save" && label === "Load") disabled = true;
    if (this.mode === "load" && label === "Save") disabled = true;
    if (label === "Delete" && !slot.data) disabled = true;

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
  // DRAW MODAL (Dynamic)
  // -----------------------------
  drawModal(ctx, canvas) {
    // 1. Get calculated layout
    const layout = this.getModalLayout(ctx, canvas);
    const {
      modalX,
      modalY,
      modalW,
      modalH,
      textLines,
      subMsgLines,
      lineHeight,
      btnX,
      btnY,
      btnW,
      btnH,
      padding,
    } = layout;

    // 2. Dim Background
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Modal Box
    ctx.fillStyle = "rgba(20,20,20,1)";
    ctx.fillRect(modalX, modalY, modalW, modalH);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(modalX, modalY, modalW, modalH);

    // 4. Render Text Lines
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#fff";
    // Use the same font size used in calculation
    const fontSize = canvas.height * 0.03;
    ctx.font = `${fontSize}px Arial`;

    let textCursorY = modalY + padding; // Start pushing text from top padding

    // Main Message
    textLines.forEach((line) => {
      ctx.fillText(line, modalX + modalW / 2, textCursorY);
      textCursorY += lineHeight;
    });

    // Sub Message (Grey)
    if (subMsgLines.length > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      // Slightly smaller font for sub message? Optional, but keeps simple here
      subMsgLines.forEach((line) => {
        ctx.fillText(line, modalX + modalW / 2, textCursorY);
        textCursorY += lineHeight;
      });
    }

    // 5. Buttons (Positions calculated in layout)
    ctx.textBaseline = "middle"; // Reset for buttons

    // Yes Button
    ctx.fillStyle = this.modal.hoverYes
      ? "rgba(50,150,50,0.7)"
      : "rgba(50,150,50,0.5)";
    ctx.fillRect(btnX.yes, btnY, btnW, btnH);
    ctx.fillStyle = "#fff";
    ctx.font = `${btnH * 0.6}px Arial`;
    ctx.fillText("YES", btnX.yes + btnW / 2, btnY + btnH / 2);

    // No Button
    ctx.fillStyle = this.modal.hoverNo
      ? "rgba(150,50,50,0.7)"
      : "rgba(150,50,50,0.5)";
    ctx.fillRect(btnX.no, btnY, btnW, btnH);
    ctx.fillStyle = "#fff";
    ctx.font = `${btnH * 0.6}px Arial`;
    ctx.fillText("NO", btnX.no + btnW / 2, btnY + btnH / 2);
  }

  render(ctx) {
    if (!this.visible) return;
    const canvas = this.core.canvas;

    // BG
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Standard Rendering (Pagination, Title, Grid) - same as before
    // PAGINATION
    const btnW = canvas.width * 0.12;
    const btnH = canvas.height * 0.06;
    const btnY = canvas.height * 0.93;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${btnH * 0.45}px Arial`;

    const prevX = canvas.width * 0.3;
    const nextX = canvas.width * 0.58;

    ctx.fillStyle =
      this.currentPage > 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(prevX, btnY, btnW, btnH);
    ctx.fillStyle = "#fff";
    ctx.fillText("Prev", prevX + btnW / 2, btnY + btnH / 2);

    ctx.fillStyle =
      this.currentPage < this.totalPages
        ? "rgba(255,255,255,0.2)"
        : "rgba(255,255,255,0.05)";
    ctx.fillRect(nextX, btnY, btnW, btnH);
    ctx.fillStyle = "#fff";
    ctx.fillText("Next", nextX + btnW / 2, btnY + btnH / 2);

    ctx.fillStyle = "#fff";
    ctx.fillText(
      `Page ${this.currentPage} / ${this.totalPages}`,
      canvas.width * 0.5,
      btnY + btnH / 2
    );

    // TITLE
    ctx.fillStyle = "#fff";
    ctx.font = `${canvas.height * 0.045}px Arial`;
    ctx.textAlign = "left";
    const titleText = this.mode === "save" ? "Save Game" : "Load Game";
    ctx.fillText(titleText, canvas.width * 0.05, canvas.height * 0.07);

    // CLOSE
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

    // GRID
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

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(bx, by, cardW, cardH);

      const headerH = cardH * 0.12;
      ctx.fillStyle = "#fff";
      ctx.font = `${headerH * 0.8}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(slot.header, bx + cardW / 2, by + 8);

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
        this.drawButton(ctx, btnX, btnY, btnW, btnH, label, isHover, slot);
      });

      const spaceTop = thumbY + thumbH - 12;
      const spaceBottom = btnY;
      const middleY = spaceTop + (spaceBottom - spaceTop) / 2;
      ctx.fillStyle = "#fff";
      ctx.font = `${btnH * 0.6}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(slot.date, bx + cardW / 2, middleY);
    });

    // 🔥 DRAW MODAL OVERLAY
    if (this.modal.visible) {
      this.drawModal(ctx, canvas);
    }
  }
}
