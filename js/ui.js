(function () {
  const { D } = window.PROTO;

  let uidCounter = 0;
  const uid = (prefix = "f") => `${prefix}-${++uidCounter}`;

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function icon(name, size = 16, cls = "") {
    const body = window.ICONS[name];
    if (!body) return "";
    return `<svg class="ds-icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusables(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  class Menu {
    static current = null;

    constructor(options) {
      this.anchor = options.anchor;
      this.items = options.items || [];
      this.selected = options.selected ?? null;
      this.multi = Boolean(options.multi);
      this.matchWidth = options.matchWidth !== false;
      this.focusMenu = options.focusMenu !== false;
      this.align = options.align || "start";
      this.label = options.label || "";
      this.emptyText = options.emptyText || "Aucun résultat";
      this.onSelect = options.onSelect || (() => {});
      this.onClose = options.onClose || (() => {});
      this.highlighted = -1;
    }

    open() {
      if (Menu.current) Menu.current.close(false);
      Menu.current = this;
      this.el = document.createElement("div");
      this.el.className = "ds-menu";
      this.el.setAttribute("role", "listbox");
      this.el.tabIndex = -1;
      if (this.label) this.el.setAttribute("aria-label", this.label);
      if (this.multi) this.el.setAttribute("aria-multiselectable", "true");
      document.getElementById("portal").appendChild(this.el);

      const selectedIndex = this.items.findIndex((item) => item.value === this.selected);
      this.highlighted = selectedIndex >= 0 ? selectedIndex : this.items.findIndex((item) => !item.disabled);
      this.renderItems();
      this.position();

      this.onDown = (event) => {
        if (!this.el.contains(event.target) && !this.anchor.contains(event.target)) this.close(false);
      };
      this.onScroll = (event) => {
        if (!this.el || this.el.contains(event.target)) return;
        const rect = this.anchor.getBoundingClientRect();
        const visible = rect.bottom > 0 && rect.top < window.innerHeight;
        if (visible) this.position();
        else this.close(false);
      };
      document.addEventListener("mousedown", this.onDown, true);
      window.addEventListener("scroll", this.onScroll, true);
      window.addEventListener("resize", this.onScroll);

      this.el.addEventListener("mousedown", (event) => {
        if (!this.focusMenu) event.preventDefault();
      });
      this.el.addEventListener("click", (event) => {
        const item = event.target.closest("[data-index]");
        if (item) this.choose(Number(item.dataset.index));
      });
      this.el.addEventListener("mousemove", (event) => {
        const item = event.target.closest("[data-index]");
        if (!item) return;
        const index = Number(item.dataset.index);
        if (index !== this.highlighted) {
          this.highlighted = index;
          this.updateHighlight(false);
        }
      });
      this.el.addEventListener("keydown", (event) => this.handleKey(event));

      this.anchor.setAttribute("aria-expanded", "true");
      if (this.focusMenu) this.el.focus({ preventScroll: true });
      this.scrollToHighlighted();
      return this;
    }

    renderItems() {
      if (!this.items.length) {
        this.el.innerHTML = `<div class="ds-menu__empty">${esc(this.emptyText)}</div>`;
        return;
      }
      this.el.innerHTML = this.items
        .map((item, index) => {
          const selected = this.multi ? item.checked : item.value === this.selected;
          const check = this.multi
            ? `<span class="ds-check" data-checked="${selected ? "true" : "false"}">${selected ? icon("check", 14) : ""}</span>`
            : "";
          const sub = item.sublabel ? `<span class="ds-menu__sub">${esc(item.sublabel)}</span>` : "";
          return `<div class="ds-menu__item" role="option" id="${this.id(index)}" data-index="${index}" aria-selected="${selected ? "true" : "false"}"${item.disabled ? ' aria-disabled="true"' : ""}>${check}<span class="ds-menu__text"><span class="ds-menu__label">${esc(item.label)}</span>${sub}</span></div>`;
        })
        .join("");
      this.updateHighlight(false);
    }

    id(index) {
      this.baseId = this.baseId || uid("opt");
      return `${this.baseId}-${index}`;
    }

    setItems(items) {
      this.items = items;
      if (this.highlighted >= items.length) this.highlighted = items.length - 1;
      if (this.highlighted < 0) this.highlighted = items.findIndex((item) => !item.disabled);
      const top = this.el.scrollTop;
      this.renderItems();
      this.el.scrollTop = top;
      this.position();
    }

    position() {
      const rect = this.anchor.getBoundingClientRect();
      if (this.matchWidth) {
        this.el.style.width = `${rect.width}px`;
      }
      const height = this.el.offsetHeight;
      const width = this.el.offsetWidth;
      let top = rect.bottom + 4;
      if (top + height > window.innerHeight - 8 && rect.top - 4 - height > 8) top = rect.top - 4 - height;
      let left = this.align === "end" ? rect.right - width : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      this.el.style.top = `${top}px`;
      this.el.style.left = `${left}px`;
    }

    updateHighlight(scroll = true) {
      this.el.querySelectorAll("[data-index]").forEach((node) => {
        node.dataset.highlighted = Number(node.dataset.index) === this.highlighted ? "true" : "false";
      });
      const node = this.el.querySelector(`[data-index="${this.highlighted}"]`);
      if (node) this.anchor.setAttribute("aria-activedescendant", node.id);
      if (scroll) this.scrollToHighlighted();
    }

    scrollToHighlighted() {
      const node = this.el && this.el.querySelector(`[data-index="${this.highlighted}"]`);
      if (node) node.scrollIntoView({ block: "nearest" });
    }

    move(delta) {
      const count = this.items.length;
      if (!count) return;
      let index = this.highlighted;
      for (let step = 0; step < count; step += 1) {
        index = (index + delta + count) % count;
        if (!this.items[index].disabled) break;
      }
      this.highlighted = index;
      this.updateHighlight();
    }

    activate() {
      if (this.highlighted >= 0) this.choose(this.highlighted);
    }

    choose(index) {
      const item = this.items[index];
      if (!item || item.disabled) return;
      this.onSelect(item);
      if (!this.multi) this.close(true);
    }

    handleKey(event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.move(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.move(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        this.highlighted = this.items.findIndex((item) => !item.disabled);
        this.updateHighlight();
      } else if (event.key === "End") {
        event.preventDefault();
        this.highlighted = this.items.length - 1;
        this.updateHighlight();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.activate();
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
      } else if (event.key === "Tab") {
        this.close(true);
      }
    }

    close(returnFocus) {
      if (!this.el) return;
      document.removeEventListener("mousedown", this.onDown, true);
      window.removeEventListener("scroll", this.onScroll, true);
      window.removeEventListener("resize", this.onScroll);
      this.el.remove();
      this.el = null;
      if (Menu.current === this) Menu.current = null;
      this.anchor.setAttribute("aria-expanded", "false");
      this.anchor.removeAttribute("aria-activedescendant");
      if (returnFocus && this.focusMenu) this.anchor.focus({ preventScroll: true });
      this.onClose();
    }
  }

  function selectHTML(o) {
    const id = o.id || uid("sel");
    const options = o.options || [];
    const current = options.find((option) => option.value === o.value);
    const text = current ? esc(current.label) : `<span class="ds-select__placeholder">${esc(o.placeholder || "Sélectionner")}</span>`;
    const clearable = Boolean(o.clearable);
    const sizeClass = o.size === "sm" ? " ds-input--sm" : "";
    const label = o.label ? `<label class="ds-label" id="${id}-label" for="${id}">${o.label}</label>` : "";
    const hint = o.hint ? `<div class="ds-hint" id="${id}-hint">${esc(o.hint)}</div>` : "";
    const labelledBy = o.label ? `${id}-label ${id}` : id;
    return `<div class="ds-field"${o.fieldAttrs || ""}>
      ${label}
      <div class="ds-select-wrap" data-select data-name="${esc(o.name)}" data-value="${esc(o.value ?? "")}" data-options="${esc(JSON.stringify(options))}" data-placeholder="${esc(o.placeholder || "Sélectionner")}">
        <button type="button" id="${id}" class="ds-input ds-select${sizeClass}${clearable ? " ds-select--clearable" : ""}" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="${labelledBy}"${o.hint ? ` aria-describedby="${id}-hint"` : ""}${o.ariaLabel ? ` aria-label="${esc(o.ariaLabel)}"` : ""}><span class="ds-select__value">${text}</span></button>
        ${clearable ? `<button type="button" class="ds-select__clear" data-select-clear aria-label="Effacer"${o.value ? "" : " hidden"}>${icon("close", 16)}</button>` : ""}
        <span class="ds-select__caret">${icon("arrow_drop_down", 20)}</span>
      </div>
      ${hint}
    </div>`;
  }

  function setSelectValue(wrap, value, silent = false) {
    const options = JSON.parse(wrap.dataset.options);
    const option = options.find((item) => item.value === value);
    wrap.dataset.value = value;
    const text = wrap.querySelector(".ds-select__value");
    text.innerHTML = option ? esc(option.label) : `<span class="ds-select__placeholder">${esc(wrap.dataset.placeholder)}</span>`;
    const clear = wrap.querySelector("[data-select-clear]");
    if (clear) clear.hidden = !value;
    if (!silent) wrap.dispatchEvent(new CustomEvent("ds-change", { bubbles: true, detail: { name: wrap.dataset.name, value } }));
  }

  function openSelect(trigger) {
    const wrap = trigger.closest("[data-select]");
    const options = JSON.parse(wrap.dataset.options);
    new Menu({
      anchor: trigger,
      items: options,
      selected: wrap.dataset.value,
      label: trigger.getAttribute("aria-label") || "",
      onSelect: (item) => setSelectValue(wrap, item.value),
    }).open();
  }

  document.addEventListener("click", (event) => {
    const clear = event.target.closest("[data-select-clear]");
    if (clear) {
      const wrap = clear.closest("[data-select]");
      setSelectValue(wrap, "");
      wrap.querySelector(".ds-select").focus();
      return;
    }
    const trigger = event.target.closest("button.ds-select");
    if (trigger) {
      if (trigger.getAttribute("aria-expanded") === "true") return;
      openSelect(trigger);
    }
  });

  document.addEventListener("keydown", (event) => {
    const trigger = event.target.closest && event.target.closest("button.ds-select");
    if (trigger && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      if (trigger.getAttribute("aria-expanded") !== "true") openSelect(trigger);
    }
  });

  function dateInputHTML(o) {
    const id = o.id || uid("date");
    const label = o.label ? `<label class="ds-label" for="${id}">${o.label}</label>` : "";
    const hint = o.hint ? `<div class="ds-hint">${esc(o.hint)}</div>` : "";
    return `<div class="ds-field">
      ${label}
      <div class="ds-date" data-name="${esc(o.name)}">
        <button type="button" class="ds-date__icon" data-date-open aria-label="Ouvrir le calendrier" tabindex="-1">${icon("calendar_today", 20)}</button>
        <input id="${id}" class="ds-input${o.size === "sm" ? " ds-input--sm" : ""}" data-mask="date" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="JJ/MM/AAAA" value="${esc(o.value ? D.fmt(o.value) : "")}"${o.ariaLabel ? ` aria-label="${esc(o.ariaLabel)}"` : ""}>
        <input type="date" class="ds-date__native" tabindex="-1" aria-hidden="true" value="${esc(o.value || "")}">
      </div>
      ${hint}
      <div class="ds-feedback ds-feedback--danger" data-error hidden></div>
    </div>`;
  }

  function timeInputHTML(o) {
    const id = o.id || uid("time");
    return `<div class="ds-field">
      <label class="ds-label" for="${id}">${o.label}</label>
      <input id="${id}" class="ds-input" data-mask="time" data-name="${esc(o.name)}" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="hh:mm" value="${esc(o.value || "")}">
      <div class="ds-feedback ds-feedback--danger" data-error hidden></div>
    </div>`;
  }

  function maskDate(raw) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  }

  function maskTime(raw) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  }

  function emitInput(input, value) {
    const holder = input.closest("[data-name]");
    input.dispatchEvent(new CustomEvent("ds-change", { bubbles: true, detail: { name: holder.dataset.name, value } }));
  }

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (!input.matches || !input.matches("input[data-mask]")) return;
    input.removeAttribute("aria-invalid");
    if (input.dataset.mask === "date") {
      input.value = maskDate(input.value);
      const iso = D.parseFr(input.value);
      const native = input.parentElement.querySelector(".ds-date__native");
      if (native) native.value = iso || "";
      emitInput(input, iso || "");
    } else {
      input.value = maskTime(input.value);
      const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(input.value);
      emitInput(input, valid ? input.value : "");
    }
  });

  document.addEventListener("focusout", (event) => {
    const input = event.target;
    if (!input.matches || !input.matches("input[data-mask]") || !input.value) return;
    if (input.dataset.mask === "time") {
      const digits = input.value.replace(/\D/g, "");
      if (digits.length === 1 || digits.length === 2) {
        input.value = `${digits.padStart(2, "0")}:00`;
        emitInput(input, input.value);
      }
    }
    const valid =
      input.dataset.mask === "date" ? Boolean(D.parseFr(input.value)) : /^([01]\d|2[0-3]):[0-5]\d$/.test(input.value);
    if (!valid) input.setAttribute("aria-invalid", "true");
  });

  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-date-open]");
    if (!open) return;
    const native = open.parentElement.querySelector(".ds-date__native");
    if (native && native.showPicker) {
      native.style.pointerEvents = "auto";
      native.showPicker();
    }
  });

  document.addEventListener("change", (event) => {
    const native = event.target;
    if (!native.matches || !native.matches(".ds-date__native")) return;
    const text = native.parentElement.querySelector("input[data-mask]");
    text.value = native.value ? D.fmt(native.value) : "";
    text.removeAttribute("aria-invalid");
    emitInput(text, native.value);
  });

  const tooltip = {
    el: null,
    target: null,
    show(target) {
      const text = target.dataset.tooltip;
      if (!text) return;
      this.hide();
      this.target = target;
      this.el = document.createElement("div");
      this.el.className = "ds-tooltip";
      this.el.setAttribute("role", "tooltip");
      this.el.textContent = text;
      document.body.appendChild(this.el);
      const rect = target.getBoundingClientRect();
      const width = this.el.offsetWidth;
      const height = this.el.offsetHeight;
      let top = rect.bottom + 6;
      if (top + height > window.innerHeight - 8) top = rect.top - height - 6;
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8));
      this.el.style.top = `${top}px`;
      this.el.style.left = `${left}px`;
    },
    hide() {
      if (this.el) this.el.remove();
      this.el = null;
      this.target = null;
    },
  };

  document.addEventListener("mouseover", (event) => {
    const target = event.target.closest && event.target.closest("[data-tooltip]");
    if (target && target !== tooltip.target) tooltip.show(target);
    else if (!target) tooltip.hide();
  });
  document.addEventListener("focusin", (event) => {
    const target = event.target.closest && event.target.closest("[data-tooltip]");
    if (target) tooltip.show(target);
    else tooltip.hide();
  });
  document.addEventListener("mousedown", () => tooltip.hide());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") tooltip.hide();
  });
  window.addEventListener("scroll", () => tooltip.hide(), true);

  const toast = (options) => {
    const host = document.getElementById("toasts");
    const duration = options.duration || 10000;
    const el = document.createElement("div");
    const type = options.type || "success";
    el.className = `ds-toast ds-toast--${type}`;
    el.style.setProperty("--toast-duration", `${duration}ms`);
    const iconName = type === "success" ? "check" : type === "danger" ? "priority_high" : "info";
    const actions = (options.actions || [])
      .map((action, index) => `<button type="button" class="ds-btn ds-btn--sm ${action.kind === "secondary" ? "ds-btn--secondary" : "ds-btn--tertiary"}" data-toast-action="${index}">${esc(action.label)}</button>`)
      .join("");
    el.innerHTML = `
      <div class="ds-toast__row">
        <span class="ds-toast__icon">${icon(iconName, 16)}</span>
        <p class="ds-toast__title">${esc(options.title)}</p>
        <button type="button" class="ds-btn ds-btn--tertiary ds-btn--icon ds-btn--sm" data-toast-close aria-label="Fermer la notification">${icon("close", 16)}</button>
      </div>
      ${options.content ? `<p class="ds-toast__content">${esc(options.content)}</p>` : ""}
      ${actions ? `<div class="ds-toast__actions">${actions}</div>` : ""}
      <div class="ds-toast__progress"></div>`;
    while (host.children.length >= 3) host.firstElementChild.remove();
    host.appendChild(el);
    let timer = null;
    const dismiss = () => {
      clearTimeout(timer);
      el.remove();
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(dismiss, duration);
    };
    arm();
    el.addEventListener("mouseenter", () => clearTimeout(timer));
    el.addEventListener("mouseleave", () => {
      el.querySelector(".ds-toast__progress").remove();
      timer = setTimeout(dismiss, 4000);
    });
    el.addEventListener("click", (event) => {
      if (event.target.closest("[data-toast-close]")) return dismiss();
      const actionButton = event.target.closest("[data-toast-action]");
      if (actionButton) {
        const action = options.actions[Number(actionButton.dataset.toastAction)];
        dismiss();
        if (action.onClick) action.onClick();
      }
    });
    return dismiss;
  };

  const Modal = {
    stack: [],
    open(options) {
      const overlay = document.createElement("div");
      overlay.className = "ds-modal-overlay";
      overlay.innerHTML = options.html;
      const dialog = overlay.querySelector(".ds-modal");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      if (options.labelledBy) dialog.setAttribute("aria-labelledby", options.labelledBy);
      const entry = { overlay, dialog, onClose: options.onClose, previousFocus: document.activeElement };
      this.stack.push(entry);
      document.getElementById("modals").appendChild(overlay);
      overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          Modal.close();
        } else if (event.key === "Tab") {
          const nodes = focusables(dialog);
          if (!nodes.length) return;
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      });
      if (options.onMount) options.onMount(dialog);
      const initial = dialog.querySelector("[data-autofocus]") || focusables(dialog)[0];
      if (initial) initial.focus({ preventScroll: true });
      return entry;
    },
    top() {
      return this.stack[this.stack.length - 1];
    },
    close(restoreFocus = true) {
      const entry = this.stack.pop();
      if (!entry) return;
      if (Menu.current) Menu.current.close(false);
      entry.overlay.remove();
      if (entry.onClose) entry.onClose();
      if (restoreFocus && entry.previousFocus && document.contains(entry.previousFocus)) entry.previousFocus.focus({ preventScroll: true });
    },
    closeAll() {
      while (this.stack.length) this.close(false);
    },
  };

  function avatarHTML(user, size) {
    if (!user) return `<span class="ds-avatar ds-avatar--empty${size === "md" ? " ds-avatar--md" : ""}">${icon("person", size === "md" ? 20 : 16)}</span>`;
    return `<span class="ds-avatar${size === "md" ? " ds-avatar--md" : ""}" style="--avatar-bg:${user.color}" aria-hidden="true">${esc(user.initials)}</span>`;
  }

  window.UI = {
    uid,
    esc,
    icon,
    Menu,
    Modal,
    selectHTML,
    setSelectValue,
    dateInputHTML,
    timeInputHTML,
    avatarHTML,
    toast,
    focusables,
  };
})();
