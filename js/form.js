(function () {
  const P = window.PROTO;
  const { D, Schedule } = P;
  const { icon, esc, Menu, Modal, selectHTML, dateInputHTML, timeInputHTML } = window.UI;
  const APP = window.APP;

  const INFO_TEXT = "La première tâche est créée maintenant. La suivante apparaît à l'échéance de la précédente.";
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function defaults(ctx) {
    return {
      ctx,
      title: "",
      description: "",
      clients: [],
      assignee: { kind: "user", id: APP.CURRENT_USER },
      frequency: ctx === "recurring" ? "monthly" : "never",
      weekday: "0",
      monthDay: "21",
      leadDays: "4",
      anchor: "",
      todoBefore: "",
      dueDate: "",
      estimate: "",
      fiscalYear: String(D.today().getFullYear()),
      billable: "",
      mission: "",
      timeMode: "time",
    };
  }

  function chipsHTML(form) {
    return form.clients
      .map((name) => `<span class="ds-chip">${esc(name)}<button type="button" data-action="remove-client" data-client="${esc(name)}" aria-label="Retirer ${esc(name)}">${icon("close", 14)}</button></span>`)
      .join("");
  }

  function clientsHTML(form) {
    return `<div class="ds-field" id="clients-field">
      <label class="ds-label" for="cf-clients">Client(s)<span data-tooltip="Une tâche est créée pour chaque client sélectionné." tabindex="0" role="img" aria-label="Une tâche est créée pour chaque client sélectionné." style="display:flex">${icon("info_outline", 14)}</span></label>
      <div class="ds-chips" id="clients-chips">${chipsHTML(form)}</div>
      <div class="ds-select-wrap">
        <input id="cf-clients" class="ds-input ds-select" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-autocomplete="list" autocomplete="off" placeholder="Choisir..." aria-describedby="clients-hint">
        <span class="ds-select__caret">${icon("arrow_drop_down", 20)}</span>
      </div>
      <div class="ds-hint" id="clients-hint">Une tâche sera créée pour chaque client.</div>
      <div class="ds-feedback ds-feedback--danger" data-error role="alert" hidden></div>
    </div>`;
  }

  function assigneeSlotHTML(form) {
    const isUser = form.assignee.kind === "user";
    const options = isUser ? P.USERS.map((user) => ({ value: user.id, label: user.name })) : P.ROLES;
    return `${selectHTML({ name: "assigneeValue", id: "cf-assignee", value: form.assignee.id, options, clearable: true, placeholder: isUser ? "Sélectionner un utilisateur" : "Sélectionner un rôle", ariaLabel: isUser ? "Utilisateur assigné" : "Rôle assigné" })}
      ${isUser ? `<div class="ds-feedback ds-feedback--warning">${icon("warning", 14)}<span>Si l'utilisateur n'a pas accès à une entreprise, la tâche vous sera assignée en tant que créateur.</span></div>` : ""}
      <div class="ds-feedback ds-feedback--danger" data-error role="alert" hidden></div>`;
  }

  function deadlineHTML(form) {
    const alert = `<div class="ds-alert" role="note">${icon("info", 16)}<span>${INFO_TEXT}</span></div>`;
    const lead = selectHTML({ name: "leadDays", id: "cf-lead", label: "À finaliser (en interne)", value: form.leadDays, options: P.LEAD_OPTIONS });
    switch (form.frequency) {
      case "never":
        return `<div class="form-row">${dateInputHTML({ name: "dueDate", id: "cf-due", label: "Échéance", value: form.dueDate })}${dateInputHTML({ name: "todoBefore", id: "cf-todo", label: "À faire avant", value: form.todoBefore })}</div>`;
      case "weekly":
        return `<div class="form-row">${selectHTML({ name: "weekday", id: "cf-weekday", label: "Chaque semaine, le", value: form.weekday, options: P.WEEKDAY_OPTIONS })}${lead}</div>${alert}`;
      case "monthly":
        return `<div class="form-row">${selectHTML({ name: "monthDay", id: "cf-monthday", label: "Chaque mois, le", value: form.monthDay, options: P.MONTH_DAY_OPTIONS })}${lead}</div>${alert}`;
      default:
        return `<div class="form-row">${dateInputHTML({ name: "anchor", id: "cf-anchor", label: Schedule.editLabel(form), value: form.anchor })}${dateInputHTML({ name: "todoBefore", id: "cf-todo", label: "À finaliser (en interne)", value: form.todoBefore })}</div>${alert}`;
    }
  }

  function frequencyOptions(form) {
    return P.FREQUENCIES.filter((item) => form.ctx === "task" || item.value !== "never");
  }

  function formHTML(form) {
    const title = form.ctx === "recurring" ? "Nouvelle tâche récurrente" : "Nouvelle tâche";
    return `<div class="ds-modal">
      <div class="ds-modal__header"><h2 class="ds-modal__title" id="create-title">${title}</h2><button type="button" class="ds-btn ds-btn--tertiary ds-btn--icon" data-action="close-modal" aria-label="Fermer">${icon("close", 20)}</button></div>
      <form class="ds-modal__body" id="create-form" novalidate>
        <section class="form-section" aria-labelledby="sec-instructions">
          <h3 class="form-section__title" id="sec-instructions">Instructions</h3>
          <div class="ds-field"><label class="ds-label" for="cf-title">Titre</label><input id="cf-title" class="ds-input" data-field="title" maxlength="120" autocomplete="off" data-autofocus><div class="ds-feedback ds-feedback--danger" data-error role="alert" hidden></div></div>
          <div class="ds-field"><label class="ds-label" for="cf-desc">Détails</label><textarea id="cf-desc" class="ds-input ds-textarea" data-field="description"></textarea></div>
          ${clientsHTML(form)}
        </section>
        <section class="form-section" aria-labelledby="sec-assign">
          <h3 class="form-section__title" id="sec-assign">Assigner</h3>
          <div class="ds-field">
            <span class="ds-label" id="assign-label">Assigner</span>
            <div class="assign-row">
              <div class="ds-btngroup ds-btngroup--assign" role="group" aria-labelledby="assign-label">
                <button type="button" class="ds-btngroup__item" data-action="assignee-kind" data-kind="user" aria-pressed="true">Utilisateur</button>
                <button type="button" class="ds-btngroup__item" data-action="assignee-kind" data-kind="role" aria-pressed="false">Rôle</button>
              </div>
              <div class="assign-slot" id="assign-slot">${assigneeSlotHTML(form)}</div>
            </div>
          </div>
        </section>
        <section class="form-section" aria-labelledby="sec-deadline">
          <h3 class="form-section__title" id="sec-deadline">Échéance</h3>
          ${selectHTML({ name: "frequency", id: "cf-frequency", label: "Répéter", value: form.frequency, options: frequencyOptions(form) })}
          <div class="form-section" id="deadline-slot" style="margin-top:0">${deadlineHTML(form)}</div>
        </section>
        <section class="form-section" aria-labelledby="sec-planning">
          <div class="form-section__head">
            <h3 class="form-section__title" id="sec-planning">Planification et analyse</h3>
            <div class="ds-btngroup" role="group" aria-label="Mode de saisie">
              <button type="button" class="ds-btngroup__item" data-action="time-mode" data-mode="time" aria-pressed="true">${icon("timer", 16)}Saisie des temps</button>
              <button type="button" class="ds-btngroup__item" data-action="time-mode" data-mode="simple" aria-pressed="false">Simplifiée</button>
            </div>
          </div>
          <div class="form-row">
            ${timeInputHTML({ name: "estimate", id: "cf-estimate", label: `Temps estimé (hh:mm)${icon("timer", 14)}`, value: form.estimate })}
            ${selectHTML({ name: "fiscalYear", id: "cf-year", label: "Millésime", value: form.fiscalYear, options: P.FISCAL_YEARS.map((year) => ({ value: year, label: year })) })}
          </div>
          ${selectHTML({ name: "billable", id: "cf-billable", label: "Tâche à facturer", value: form.billable, options: P.BILLABLE_TASKS.map((item) => ({ value: item, label: item })), placeholder: "Sélectionner une tâche", hint: "Pré-remplit la saisie du temps pour analyser la profitabilité." })}
          ${selectHTML({ name: "mission", id: "cf-mission", label: "Type de mission", value: form.mission, options: P.MISSION_TYPES.map((item) => ({ value: item.value, label: item.value })), clearable: true, placeholder: "Sélectionner un type", hint: "Permet de filtrer et d'analyser la charge prévue." })}
        </section>
      </form>
      <div class="ds-modal__footer">
        <button type="button" class="ds-btn ds-btn--secondary" data-action="close-modal">Annuler</button>
        <button type="button" class="ds-btn ds-btn--primary" id="create-cta" data-action="submit-create">${P.CTA_LABELS[form.frequency]}</button>
      </div>
    </div>`;
  }

  function errorHost(dialog, name) {
    let node;
    if (name === "title") node = dialog.querySelector('[data-field="title"]');
    else if (name === "clients") node = dialog.querySelector("#cf-clients");
    else if (name === "assigneeValue") node = dialog.querySelector("#cf-assignee");
    else node = dialog.querySelector(`[data-name="${name}"]`);
    if (!node) return null;
    return name === "assigneeValue" ? dialog.querySelector("#assign-slot") : node.closest(".ds-field");
  }

  function showError(dialog, name, message) {
    const host = errorHost(dialog, name);
    if (!host) return null;
    const error = host.querySelector("[data-error]");
    error.hidden = false;
    error.innerHTML = `${icon("error_outline", 14)}<span>${esc(message)}</span>`;
    const control = host.querySelector("input:not(.ds-date__native), button.ds-select");
    if (control) control.setAttribute("aria-invalid", "true");
    return control;
  }

  function clearError(dialog, name) {
    const host = errorHost(dialog, name);
    if (!host) return;
    const error = host.querySelector("[data-error]");
    if (error) {
      error.hidden = true;
      error.innerHTML = "";
    }
    host.querySelectorAll("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));
  }

  function textOf(dialog, name) {
    const holder = dialog.querySelector(`[data-name="${name}"]`);
    if (!holder) return "";
    const input = holder.matches("input") ? holder : holder.querySelector("input[data-mask]");
    return input ? input.value : "";
  }

  function validate(dialog, form) {
    const errors = [];
    const add = (name, message) => errors.push([name, message]);
    if (!form.title.trim()) add("title", "Saisissez un titre.");
    if (!form.clients.length) add("clients", "Sélectionnez au moins un client.");
    if (form.assignee.kind === "role" && !form.assignee.id) add("assigneeValue", "Sélectionnez un rôle.");
    const dateProblem = (name, required) => {
      const text = textOf(dialog, name);
      if (!text) return required ? "Saisissez une date." : null;
      return D.parseFr(text) ? null : "Saisissez une date valide (JJ/MM/AAAA).";
    };
    if (form.frequency === "never") {
      const dueProblem = dateProblem("dueDate", false);
      const todoProblem = dateProblem("todoBefore", false);
      if (dueProblem) add("dueDate", dueProblem);
      if (todoProblem) add("todoBefore", todoProblem);
      if (!dueProblem && !todoProblem && form.dueDate && form.todoBefore && form.todoBefore > form.dueDate) add("todoBefore", "Cette date doit précéder l'échéance.");
    } else if (form.frequency !== "weekly" && form.frequency !== "monthly") {
      const anchorProblem = dateProblem("anchor", true);
      const todoProblem = dateProblem("todoBefore", true);
      if (anchorProblem) add("anchor", anchorProblem);
      if (todoProblem) add("todoBefore", todoProblem);
      if (!anchorProblem && !todoProblem && form.todoBefore > form.anchor) add("todoBefore", "Cette date doit précéder l'échéance.");
    }
    const estimateText = textOf(dialog, "estimate");
    if (estimateText && !form.estimate) add("estimate", "Saisissez une durée valide (hh:mm).");
    return errors;
  }

  function bind(dialog, form) {
    const slot = dialog.querySelector("#deadline-slot");
    const chips = dialog.querySelector("#clients-chips");
    const clientInput = dialog.querySelector("#cf-clients");
    let clientMenu = null;

    const clientItems = (query) =>
      P.CLIENTS.filter((name) => normalize(name).includes(normalize(query))).map((name) => ({ value: name, label: name, checked: form.clients.includes(name) }));

    const openClients = () => {
      if (clientMenu && clientMenu.el) {
        clientMenu.setItems(clientItems(clientInput.value));
        return;
      }
      clientMenu = new Menu({
        anchor: clientInput,
        items: clientItems(clientInput.value),
        multi: true,
        focusMenu: false,
        label: "Clients",
        onSelect: (item) => toggleClient(item.value),
        onClose: () => {
          clientMenu = null;
        },
      });
      clientMenu.open();
    };

    const toggleClient = (name) => {
      form.clients = form.clients.includes(name) ? form.clients.filter((item) => item !== name) : [...form.clients, name];
      chips.innerHTML = chipsHTML(form);
      clientInput.value = "";
      clearError(dialog, "clients");
      if (clientMenu && clientMenu.el) clientMenu.setItems(clientItems(""));
    };

    clientInput.addEventListener("focus", openClients);
    clientInput.addEventListener("click", openClients);
    clientInput.addEventListener("input", openClients);
    clientInput.addEventListener("keydown", (event) => {
      const open = clientMenu && clientMenu.el;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (open) clientMenu.move(1);
        else openClients();
      } else if (event.key === "ArrowUp" && open) {
        event.preventDefault();
        clientMenu.move(-1);
      } else if (event.key === "Enter" && open) {
        event.preventDefault();
        clientMenu.activate();
      } else if (event.key === "Escape" && open) {
        event.stopPropagation();
        clientMenu.close(false);
      } else if (event.key === "Tab" && open) {
        clientMenu.close(false);
      } else if (event.key === "Backspace" && !clientInput.value && form.clients.length) {
        toggleClient(form.clients[form.clients.length - 1]);
      }
    });

    const refreshFrequency = () => {
      slot.innerHTML = deadlineHTML(form);
      dialog.querySelector("#create-cta").textContent = P.CTA_LABELS[form.frequency];
    };

    dialog.addEventListener("input", (event) => {
      const field = event.target.dataset && event.target.dataset.field;
      if (field === "title") {
        form.title = event.target.value;
        clearError(dialog, "title");
      } else if (field === "description") {
        form.description = event.target.value;
      }
    });

    dialog.addEventListener("ds-change", (event) => {
      const { name, value } = event.detail;
      if (name === "assigneeValue") {
        form.assignee = { kind: form.assignee.kind, id: value };
        clearError(dialog, "assigneeValue");
        return;
      }
      form[name] = value;
      clearError(dialog, name);
      if (name === "frequency") {
        form.anchor = "";
        form.todoBefore = "";
        refreshFrequency();
      }
    });

    dialog.addEventListener("click", (event) => {
      const el = event.target.closest("[data-action]");
      if (!el) return;
      const action = el.dataset.action;
      if (action === "remove-client") {
        toggleClient(el.dataset.client);
        clientInput.focus();
      } else if (action === "assignee-kind") {
        form.assignee = { kind: el.dataset.kind, id: el.dataset.kind === "user" ? APP.CURRENT_USER : "" };
        dialog.querySelectorAll('[data-action="assignee-kind"]').forEach((button) => button.setAttribute("aria-pressed", String(button === el)));
        dialog.querySelector("#assign-slot").innerHTML = assigneeSlotHTML(form);
      } else if (action === "time-mode") {
        form.timeMode = el.dataset.mode;
        dialog.querySelectorAll('[data-action="time-mode"]').forEach((button) => button.setAttribute("aria-pressed", String(button === el)));
      } else if (action === "submit-create") {
        submit(dialog, form);
      }
    });

    dialog.querySelector("#create-form").addEventListener("submit", (event) => {
      event.preventDefault();
      submit(dialog, form);
    });
  }

  function submit(dialog, form) {
    dialog.querySelectorAll("[data-error]").forEach((node) => {
      node.hidden = true;
      node.innerHTML = "";
    });
    dialog.querySelectorAll("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));
    const errors = validate(dialog, form);
    if (errors.length) {
      let first = null;
      errors.forEach(([name, message]) => {
        const control = showError(dialog, name, message);
        if (!first) first = control;
      });
      if (first) first.focus();
      return;
    }
    const created = APP.createFromForm(form);
    Modal.close(false);
    APP.render(true);
    APP.announceCreation(form, created, form.ctx === "recurring");
  }

  APP.openCreate = function (ctx) {
    Modal.closeAll();
    const form = defaults(ctx);
    Modal.open({
      html: formHTML(form),
      labelledBy: "create-title",
      onMount: (dialog) => bind(dialog, form),
    });
  };
})();
