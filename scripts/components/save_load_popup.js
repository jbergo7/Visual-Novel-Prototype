// components/save_load_popup.js
export default class SaveLoadPopup {
  constructor(core) {
    this.core = core;
    this.visible = false;

    // Each of the 10 slots will store:
    // { name, timestamp, data } or null for empty
    this.slots = new Array(10).fill(null);

    this.hoverSlot = -1;
    this.hoverButton = null; // { slotIndex, buttonId }

    this._moveHandler = (e) => this.onMouseMove(e);
    this._clickHandler = (e) => this.onClick(e);

    this.core.canvas.addEventListener("mousemove", this._moveHandler);
    this.core.canvas.addEventListener("click", this._clickHandler);
  }

  dispose() {
    this.core.canvas.removeEventListener("mousemove", this._moveHandler);
    this.core.canvas.removeEventListener("click", this._clickHandler);
  }

  open() {
    this.visible = true;
  }

  close() {
    this.visible = false;
    this.hoverSlot = -1;
    this.hoverButton = null;
  }

  /** For external integration */
  loadSlots(dataArray) {
    // Expecting array of 10 items (null or slotData)
    this.slots = dataArray;
  }

  /** For external integration */
  getSlots() {
    return this.slots;
  }

  /** Save handler (external logic) */
  onSaveSlot(slotIndex) {
    const date = new Date();
    this.slots[slotIndex] = {
      name: `Save Slot ${slotIndex + 1}`,
      timestamp: date.toLocaleString(),
      data: this.core.getFullSaveData(), // user-defined method
    };
  }

  /** Load handler */
  onLoadSlot(slotIndex) {
    if (!this.slots[slotIndex]) return;
    this.core.loadFullSaveData(this.slots[slotIndex].data);
    this.close();
  }

  /** Delete handler */
  onDeleteSlot(slotIndex) {
    this.slots[slotIndex] = null;
  }

  // -----------------------------
  // EVENT HANDLING
  // -----------------------------
  onMouseMove(e) {
    if (!this.visible) {
      this.hoverSlot = -1;
      this.hoverButton = null;
      return;
    }

    const rect = this.core.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const canvas = this.core.canvas;

    this.hoverSlot = -1;
    this.hoverButton = null;

    const cols = 2;
    const rows = 5;
    const total = cols * rows;

    const cardW = canvas.width * 0.35;
    const cardH = canvas.height * 0.15;
    const gapX = canvas.width * 0.05;
    const gapY = canvas.height * 0.03;

    const startX = canvas.width * 0.1;
    const startY = canvas.height * 0.1;

    for (let i = 0; i < total; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      // slot hover
      if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + cardH) {
        this.hoverSlot = i;

        // check buttons inside slot
        const btnY = cy + cardH - 35;
        const btnW = 60;
        const btnH = 25;

        const btns = [
          { id: "save", bx: cx + 20 },
          { id: "load", bx: cx + 20 + btnW + 10 },
          { id: "delete", bx: cx + 20 + (btnW + 10) * 2 },
        ];

        for (const b of btns) {
          if (x >= b.bx && x <= b.bx + btnW && y >= btnY && y <= btnY + btnH) {
            this.hoverButton = { slot: i, id: b.id };
            return;
          }
        }
      }
    }
  }

  onClick(e) {
    if (!this.visible) return;
    if (!this.hoverButton) return;

    const { slot, id } = this.hoverButton;

    switch (id) {
      case "save":
        this.onSaveSlot(slot);
        break;
      case "load":
        this.onLoadSlot(slot);
        break;
      case "delete":
        this.onDeleteSlot(slot);
        break;
    }
  }

  // -----------------------------
  // RENDER
  // -----------------------------
  render(ctx) {
    if (!this.visible) return;

    const canvas = this.core.canvas;

    // Dim background
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cols = 2;
    const rows = 5;
    const cardW = canvas.width * 0.35;
    const cardH = canvas.height * 0.15;
    const gapX = canvas.width * 0.05;
    const gapY = canvas.height * 0.03;

    const startX = canvas.width * 0.1;
    const startY = canvas.height * 0.1;

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `${canvas.height * 0.025}px Arial`;

    for (let i = 0; i < 10; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      // background
      ctx.fillStyle =
        this.hoverSlot === i
          ? "rgba(255,255,255,0.15)"
          : "rgba(255,255,255,0.08)";
      ctx.fillRect(cx, cy, cardW, cardH);

      // rectangle preview
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.strokeRect(cx + 10, cy + 10, 100, 60);

      // slot details
      const slot = this.slots[i];
      if (slot) {
        ctx.fillStyle = "#fff";
        ctx.fillText(slot.name, cx + 120, cy + 10);
        ctx.fillText(slot.timestamp, cx + 120, cy + 40);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText("Empty Slot", cx + 120, cy + 10);
      }

      // buttons (Save, Load, Delete)
      const btnY = cy + cardH - 35;
      const btnW = 60;
      const btnH = 25;

      const buttons = [
        { id: "save", label: "Save" },
        { id: "load", label: "Load" },
        { id: "delete", label: "Del" },
      ];

      buttons.forEach((b, idx) => {
        const bx = cx + 20 + idx * (btnW + 10);

        ctx.fillStyle =
          this.hoverButton &&
          this.hoverButton.slot === i &&
          this.hoverButton.id === b.id
            ? "rgba(255,255,255,0.3)"
            : "rgba(255,255,255,0.15)";
        ctx.fillRect(bx, btnY, btnW, btnH);

        ctx.fillStyle = "#fff";
        ctx.font = `${canvas.height * 0.022}px Arial`;
        ctx.fillText(b.label, bx + 10, btnY + 3);
      });
    }
  }
}
