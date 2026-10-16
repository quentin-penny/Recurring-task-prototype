(function () {
  const P = window.PROTO;
  const { D, Schedule, Format } = P;
  const { icon, esc, Menu, Modal, avatarHTML, toast, selectHTML, dateInputHTML } = window.UI;

  const CURRENT_USER = "u1";

  const state = {
    route: "tasks",
    search: "",
    tasks: [],
    series: [],
    seq: 0,
    sortDir: "asc",
    protoHidden: false,
    examplesLoaded: false,
  };

  const userById = (id) => P.USERS.find((user) => user.id === id);
  const seriesById = (id) => state.series.find((item) => item.id === id);
  const taskById = (id) => state.tasks.find((item) => item.id === id);
  const missionColor = (value) => (P.MISSION_TYPES.find((m) => m.value === value) || {}).color || "blue";
  const todayIso = () => D.todayIso();

  function makeTask(base) {
    state.seq += 1;
    return {
      id: `t${state.seq}`,
      seq: state.seq,
      status: "todo",
      createdBy: CURRENT_USER,
      description: "",
      due: "",
      todoBefore: "",
      estimate: "",
      spent: "",
      seriesId: null,
      urgent: false,
      ...base,
    };
  }

  function makeSeries(base) {
    return { id: `s${Date.now()}${Math.floor(Math.random() * 1000)}${state.series.length}`, ...base };
  }

  function seedBoard() {
    const base = { title: "Déclaration de TVA", description: "Préparer la TVA et envoyer", estimate: "02:30", assignee: { kind: "user", id: "u2" }, mission: "Fiscalité", fiscalYear: "2026", billable: "2.1.1 Déclarations fiscales" };
    const today = todayIso();
    [
      { client: "Acme Inc.", status: "done", due: D.addDays(today, -20), todoBefore: D.addDays(today, -24) },
      { client: "Acme Inc.", status: "done", due: D.addDays(today, -14), todoBefore: D.addDays(today, -18) },
      { client: "Acme Inc.", status: "done", due: D.addDays(today, -9), todoBefore: D.addDays(today, -12) },
      { client: "Acme Inc.", status: "done", due: D.addDays(today, -6), todoBefore: D.addDays(today, -8) },
      { client: "Acme Inc.", status: "blocked", due: D.addDays(today, 6), todoBefore: D.addDays(today, 3) },
      { client: "Boulangerie de l'excellent matin", status: "doing", due: D.addDays(today, 9), todoBefore: D.addDays(today, 5) },
    ].forEach((extra) => state.tasks.push(makeTask({ ...base, ...extra })));
  }

  function seedSeries(spec, pastCount) {
    const series = makeSeries({
      active: true,
      createdBy: CURRENT_USER,
      weekday: 0,
      monthDay: "21",
      anchor: "",
      leadDays: 4,
      ...spec,
    });
    const common = {
      title: series.title,
      description: series.description,
      client: series.client,
      assignee: series.assignee,
      estimate: series.estimate,
      fiscalYear: series.fiscalYear,
      billable: series.billable,
      mission: series.mission,
      seriesId: series.id,
    };
    const currentDue = Schedule.firstDue(series, todayIso());
    const dues = [currentDue];
    for (let i = 0; i < pastCount; i += 1) dues.unshift(Schedule.previousDue(series, dues[0]));
    dues.forEach((due, index) => {
      const isCurrent = index === dues.length - 1;
      const task = makeTask({
        ...common,
        due,
        todoBefore: D.addDays(due, -series.leadDays),
        status: isCurrent ? "todo" : "done",
        spent: isCurrent ? spec.spent || "" : "",
      });
      if (isCurrent) series.currentTaskId = task.id;
      state.tasks.push(task);
    });
    state.series.push(series);
  }

  function loadExamples() {
    if (state.examplesLoaded) return;
    state.examplesLoaded = true;
    const year = D.today().getFullYear();
    seedSeries(
      { title: "Déclaration TVA", description: "Révision complète des écritures de TVA avant le dépôt de la déclaration.", client: "Acme Inc.", assignee: { kind: "user", id: "u1" }, frequency: "weekly", weekday: 0, leadDays: 4, estimate: "01:00", spent: "00:45", mission: "Fiscalité", fiscalYear: String(year), billable: "2.1.1 Déclarations fiscales" },
      2,
    );
    seedSeries(
      { title: "Clôture mensuelle", description: "Rapprochement bancaire et lettrage des comptes de tiers.", client: "Boulangerie de la Paix", assignee: { kind: "user", id: "u2" }, frequency: "monthly", monthDay: "5", leadDays: 3, estimate: "02:30", mission: "Production comptable", fiscalYear: String(year), billable: "1.2.1 Tenue comptable" },
      2,
    );
    seedSeries(
      { title: "Bilan annuel", description: "Préparation des comptes annuels et des liasses fiscales.", client: "Café des Artisans", assignee: { kind: "user", id: "u3" }, frequency: "yearly", anchor: `${year}-12-31`, leadDays: 14, estimate: "08:00", mission: "Révision", fiscalYear: String(year), billable: "1.1.2 Établissement des comptes annuels" },
      1,
    );
  }

  function advanceSeries() {
    const active = state.series.filter((item) => item.active);
    active.forEach((series) => {
      const current = taskById(series.currentTaskId);
      const due = Schedule.nextDue(series, current.due);
      const next = makeTask({
        title: series.title,
        description: series.description,
        client: series.client,
        assignee: series.assignee,
        estimate: series.estimate,
        fiscalYear: series.fiscalYear,
        billable: series.billable,
        mission: series.mission,
        seriesId: series.id,
        due,
        todoBefore: D.addDays(due, -series.leadDays),
      });
      state.tasks.push(next);
      series.currentTaskId = next.id;
    });
    return active.length;
  }

  function virtualOccurrence(series, due) {
    return {
      id: `v-${series.id}-${due}`,
      virtual: true,
      title: series.title,
      description: series.description,
      client: series.client,
      assignee: series.assignee,
      estimate: series.estimate,
      fiscalYear: series.fiscalYear,
      billable: series.billable,
      mission: series.mission,
      seriesId: series.id,
      status: "todo",
      due,
      todoBefore: D.addDays(due, -series.leadDays),
      spent: "",
      urgent: false,
    };
  }

  function matchesSearch(task) {
    const query = state.search.trim().toLowerCase();
    return !query || task.title.toLowerCase().includes(query);
  }

  function sidenavHTML() {
    const imgItem = (file, label) => `<li><button type="button" class="sidenav__item"><img src="assets/${file}" alt="" width="20" height="20"><span>${label}</span></button></li>`;
    const iconItem = (name, label) => `<li><button type="button" class="sidenav__item">${icon(name, 20)}<span>${label}</span></button></li>`;
    return `<nav class="sidenav" aria-label="Navigation principale">
      <div class="sidenav__bg" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="sidenav__brand"><img src="assets/logo.svg" alt="" width="20" height="20"><span aria-hidden="true">/</span><span>Mon Cabinet</span></div>
      <ul class="sidenav__list">
        ${imgItem("nav-production.svg", "Production")}
        ${imgItem("nav-portefeuille.svg", "Portefeuille")}
        ${imgItem("nav-utilisateurs.svg", "Utilisateurs")}
        ${iconItem("account_balance", "Banques")}
        ${iconItem("timer", "Gestion interne")}
        ${imgItem("nav-imports.svg", "Imports")}
        ${imgItem("nav-exports.svg", "Exports")}
        ${iconItem("settings", "Paramètres")}
      </ul>
      <div class="sidenav__spacer"></div>
      <ul class="sidenav__list">${iconItem("help", "Aide et support")}</ul>
    </nav>`;
  }

  function topbarHTML() {
    return `<header class="topbar">
      <div class="topbar__company"><span class="topbar__logo" aria-hidden="true">DUPONT</span><span>Dupont &amp; Associés</span></div>
      <div class="ds-select-wrap topbar__select-wrap"><button type="button" class="ds-input topbar__select" aria-label="Sélectionner une entreprise">Sélectionner une entreprise...</button><span class="ds-select__caret">${icon("arrow_drop_down", 20)}</span></div>
      <div class="topbar__right">${icon("campaign", 20)}${avatarHTML(userById(CURRENT_USER))}</div>
    </header>`;
  }

  function filterButtons(items) {
    return items.map(([name, label]) => `<button type="button" class="ds-filter">${icon(name, 16)}${label}</button>`).join("");
  }

  function searchHTML() {
    return `<div class="ds-search">${icon("search", 16)}<input id="search" class="ds-input ds-input--sm" type="search" placeholder="Titre de la tâche..." aria-label="Rechercher une tâche par titre" value="${esc(state.search)}"></div>`;
  }

  function tasksPageHTML() {
    return `
      <header class="page-header">
        <div class="page-header__top">
          <h1 class="page-title" id="page-title" tabindex="-1">Tâches</h1>
          <div class="page-header__actions">
            <button type="button" class="ds-btn ds-btn--secondary" data-action="go-recurring">Gérer les tâches récurrentes</button>
            <button type="button" class="ds-btn ds-btn--primary" data-action="new-task">${icon("add", 16)}Nouvelle tâche</button>
          </div>
        </div>
        <p class="page-desc">Créez et suivez l'avancée des tâches dans le cabinet. <a class="ds-link" href="#/tasks" data-action="noop">En savoir plus ${icon("open_in_new", 14)}</a></p>
      </header>
      <div class="toolbar">
        ${searchHTML()}
        <div class="toolbar__filters">${filterButtons([["person", "Assignée à"], ["domain", "Client"], ["event_available", "À faire avant"], ["calendar_today", "Échéance"], ["local_offer", "Catégorie"], ["label", "Statut"]])}</div>
        <div class="ds-btngroup ds-btngroup--icon" role="group" aria-label="Mode d'affichage">
          <button type="button" class="ds-btngroup__item" aria-pressed="true" aria-label="Vue kanban">${icon("grid_view", 16)}</button>
          <button type="button" class="ds-btngroup__item" aria-pressed="false" aria-label="Vue liste" disabled data-tooltip="Non inclus dans ce prototype">${icon("view_list", 16)}</button>
        </div>
      </div>
      <div class="board" id="region">${boardHTML()}</div>`;
  }

  function boardHTML() {
    return P.STATUSES.map((status) => {
      const tasks = state.tasks.filter((task) => task.status === status.value && matchesSearch(task)).sort((a, b) => b.seq - a.seq);
      const minutes = tasks.reduce((sum, task) => sum + Format.minutes(task.estimate), 0);
      const countClass = { todo: "", doing: " ds-pill--info", blocked: " ds-pill--warning", done: " ds-pill--success" }[status.value];
      const add = status.value === "todo" ? `<button type="button" class="col__add" data-action="new-task" aria-label="Ajouter une tâche">${icon("add", 16)}</button>` : "";
      return `<section class="col" aria-label="${status.label}">
        <div class="col__head">
          <h2 class="col__title">${status.label}</h2>
          <div class="col__meta"><span class="ds-pill">${icon("hourglass_empty", 12)}${Format.hoursTotal(minutes)}</span><span class="ds-pill${countClass}">${tasks.length}</span>${add}</div>
        </div>
        <div class="col__cards">${tasks.map(cardHTML).join("")}</div>
      </section>`;
    }).join("");
  }

  function cardHTML(task) {
    const user = task.assignee.kind === "user" ? userById(task.assignee.id) : null;
    const series = task.seriesId ? seriesById(task.seriesId) : null;
    const date = task.todoBefore || task.due;
    const late = Boolean(date) && task.status !== "done" && date < todayIso();
    const datePill = date ? `<span class="ds-pill${late ? " ds-pill--late" : ""}">${icon("calendar_today", 12)}${late ? Format.relativeDeadline(date) : D.fmt(date)}</span>` : "";
    const estimate = task.estimate ? `<span class="ds-pill">${icon("hourglass_empty", 12)}${Format.estimate(task.estimate)}</span>` : "";
    const loop = series ? `<span class="ds-pill" data-tooltip="${esc(Schedule.tooltip(series))}">${icon("loop", 12)}<span class="sr-only">Tâche récurrente : ${esc(Schedule.tooltip(series))}</span></span>` : "";
    return `<button type="button" class="card" data-action="open-task" data-id="${task.id}" data-status="${task.status}">
      <span class="card__top">${avatarHTML(user)}${datePill}${estimate}${loop}</span>
      <span class="card__title">${esc(task.title)}</span>
      <span class="card__desc">${esc(task.description)}</span>
      <span class="card__client">${icon("domain", 16)}<span>${esc(task.client)}</span></span>
      <span class="card__drag">${icon("drag_indicator", 16)}</span>
    </button>`;
  }

  function recurringPageHTML() {
    const header = `
      <header class="page-header page-header--s">
        <nav class="ds-breadcrumb" aria-label="Fil d'Ariane"><button type="button" data-action="go-tasks">Tâches</button>${icon("chevron_right", 16)}<span aria-current="page">Tâches récurrentes</span></nav>
        <div class="page-header__top">
          <div class="page-header__title">
            <button type="button" class="ds-btn ds-btn--secondary ds-btn--icon ds-btn--sm" data-action="go-tasks" aria-label="Retour aux tâches">${icon("arrow_back", 16)}</button>
            <h1 class="page-title" id="page-title" tabindex="-1">Tâches récurrentes</h1>
          </div>
          <button type="button" class="ds-btn ds-btn--primary" data-action="new-recurring">${icon("add", 16)}Nouvelle tâche récurrente</button>
        </div>
      </header>`;
    if (!state.series.length) {
      return `${header}<div class="empty" id="region">
        <div class="empty__box">
          <img src="assets/empty-state.svg" alt="" width="160" height="158">
          <div><h2 class="empty__title">Planifiez vos tâches récurrentes</h2><p class="empty__text">La fréquence est définie une fois. Les occurrences à venir sont ajoutées à vos tâches.</p></div>
          <button type="button" class="ds-btn ds-btn--primary ds-btn--block" data-action="new-recurring">Nouvelle tâche récurrente</button>
        </div>
      </div>`;
    }
    return `${header}
      <div class="toolbar">
        ${searchHTML()}
        <div class="toolbar__filters">${filterButtons([["person", "Assignée à"], ["domain", "Client"], ["loop", "Récurrence"], ["local_offer", "Catégorie"]])}</div>
        <button type="button" class="ds-btn ds-btn--secondary ds-btn--sm">${icon("view_week", 16)}Personnaliser</button>
      </div>
      <div class="list-wrap" id="region">${listHTML()}</div>`;
  }

  const LIST_COLUMNS = "48px minmax(160px,1.2fr) minmax(200px,1.5fr) 100px 100px minmax(150px,1fr) 130px 160px 110px minmax(180px,1.2fr) minmax(140px,1fr) 150px";

  function listHTML() {
    const rows = state.series
      .filter((item) => item.active && matchesSearch(item))
      .map((item) => ({ series: item, task: taskById(item.currentTaskId) }))
      .sort((a, b) => (state.sortDir === "asc" ? a.task.due.localeCompare(b.task.due) : b.task.due.localeCompare(a.task.due)));
    const head = (label, extra = "") => `<div class="ds-table__head${extra}" role="columnheader">${label}</div>`;
    const body = rows.length
      ? rows.map(({ series, task }) => rowHTML(series, task)).join("")
      : `<div class="ds-table__row" style="--cols:1fr"><div class="ds-table__cell" role="cell">Aucune tâche récurrente ne correspond à votre recherche.</div></div>`;
    const total = rows.length;
    return `<div class="list-scroll">
      <div class="ds-table" role="table" aria-label="Tâches récurrentes">
        <div role="rowgroup"><div class="ds-table__row ds-table__row--head" role="row" style="--cols:${LIST_COLUMNS}">
          <div class="ds-table__head" role="columnheader"><input type="checkbox" aria-label="Tout sélectionner"></div>
          ${head("Tâche")}${head("Description")}${head("Assignée à")}${head("Créée par")}${head("Dossier comptable")}${head("Récurrence")}
          <div class="ds-table__head ds-table__head--right" role="columnheader" aria-sort="${state.sortDir === "asc" ? "ascending" : "descending"}"><button type="button" class="ds-table__head ds-table__head--right" data-action="sort-due" style="padding:0;height:auto">Prochaine échéance${icon("unfold_more", 16)}</button></div>
          ${head("Est. (hh:mm)", " ds-table__head--right")}${head("Tâche à facturer")}${head("Client")}${head("Type de mission")}
        </div></div>
        <div class="ds-table__body" role="rowgroup">${body}</div>
      </div>
    </div>
    <div class="list-footer">
      <span>25 éléments par page</span>
      <div class="ds-pagination"><span class="ds-pagination__info">${total ? `1-${total} sur ${total}` : "0 sur 0"}</span>
        <button type="button" class="ds-page-btn" disabled aria-label="Page précédente">${icon("chevron_right", 16, "flip")}</button>
        <button type="button" class="ds-page-btn" aria-current="page">1</button>
        <button type="button" class="ds-page-btn" disabled aria-label="Page suivante">${icon("chevron_right", 16)}</button>
      </div>
    </div>`;
  }

  function rowHTML(series, task) {
    const user = task.assignee.kind === "user" ? userById(task.assignee.id) : null;
    const creator = userById(series.createdBy);
    return `<div class="ds-table__row" role="row" tabindex="0" data-action="open-series" data-id="${series.id}" style="--cols:${LIST_COLUMNS}" aria-label="${esc(series.title)}, ${esc(series.client)}">
      <div class="ds-table__cell cell-check" role="cell"><input type="checkbox" data-stop aria-label="Sélectionner ${esc(series.title)}"></div>
      <div class="ds-table__cell" role="cell">${esc(series.title)}</div>
      <div class="ds-table__cell" role="cell">${esc(series.description)}</div>
      <div class="ds-table__cell" role="cell"><span class="cell-flex">${avatarHTML(user)}</span></div>
      <div class="ds-table__cell" role="cell"><span class="cell-flex">${avatarHTML(creator)}</span></div>
      <div class="ds-table__cell" role="cell">${esc(series.client)}</div>
      <div class="ds-table__cell" role="cell">${P.TABLE_ADJECTIVES[series.frequency]}</div>
      <div class="ds-table__cell ds-table__cell--right" role="cell"><span class="cell-link">${D.fmt(task.due)}</span></div>
      <div class="ds-table__cell ds-table__cell--right" role="cell">${esc(series.estimate || "")}</div>
      <div class="ds-table__cell" role="cell">${esc(series.billable || "")}</div>
      <div class="ds-table__cell" role="cell">${esc(series.client)}</div>
      <div class="ds-table__cell" role="cell">${series.mission ? `<span class="ds-deco ds-deco--${missionColor(series.mission)}">${icon("local_offer", 12)}${esc(series.mission)}</span>` : ""}</div>
    </div>`;
  }

  function protoBarHTML() {
    if (state.protoHidden) return "";
    return `<div class="proto" role="region" aria-label="Outils du prototype">
      <span class="proto__label">Prototype</span>
      <button type="button" data-action="proto-examples"${state.examplesLoaded ? " disabled" : ""}>Charger des exemples</button>
      <button type="button" data-action="proto-advance"${state.series.some((s) => s.active) ? "" : " disabled"}>Passer à l'échéance suivante</button>
      <button type="button" data-action="proto-reset">Réinitialiser</button>
      <button type="button" class="proto__close" data-action="proto-hide" aria-label="Masquer les outils du prototype">${icon("close", 14)}</button>
    </div>`;
  }

  function render(focusTitle = false) {
    document.getElementById("app").innerHTML = `${sidenavHTML()}<div class="main">${topbarHTML()}<main class="page">${state.route === "tasks" ? tasksPageHTML() : recurringPageHTML()}</main></div>`;
    document.getElementById("proto").innerHTML = protoBarHTML();
    document.title = state.route === "tasks" ? "Tâches · Prototype" : "Tâches récurrentes · Prototype";
    if (focusTitle) {
      const title = document.getElementById("page-title");
      if (title) title.focus({ preventScroll: true });
    }
  }

  function refreshRegion() {
    const region = document.getElementById("region");
    if (!region) return;
    if (state.route === "tasks") region.innerHTML = boardHTML();
    else if (state.series.length) region.innerHTML = listHTML();
  }

  function navigate(route) {
    const hash = route === "tasks" ? "#/tasks" : "#/tasks/recurring";
    if (location.hash === hash) {
      state.route = route;
      Modal.closeAll();
      render(true);
    } else {
      location.hash = hash;
    }
  }

  function refreshAfterChange() {
    const search = document.activeElement && document.activeElement.id === "search";
    render();
    if (search) {
      const input = document.getElementById("search");
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function assigneeHTML(assignee) {
    if (assignee.kind === "user") {
      const user = userById(assignee.id);
      return `${avatarHTML(user)}<span>${esc(user.name)}</span>`;
    }
    const role = P.ROLES.find((item) => item.value === assignee.id);
    return `${avatarHTML(null)}<span>${esc(role ? role.label : "Rôle")}</span>`;
  }

  function occurrenceItems(view) {
    const series = view.series;
    const current = taskById(series.currentTaskId);
    const past = state.tasks
      .filter((task) => task.seriesId === series.id && task.id !== current.id && task.due < current.due)
      .sort((a, b) => a.due.localeCompare(b.due));
    const upcoming = virtualOccurrence(series, Schedule.nextDue(series, current.due));
    const fmtItem = (task, tag) => ({ value: task.id, label: task.title, sublabel: `${D.fmt(task.due)} · ${tag}`, task });
    return [...past.map((task) => fmtItem(task, "Passée")), fmtItem(current, "En cours"), fmtItem(upcoming, "À venir")];
  }

  function taskModalInner(view) {
    const { task, series, ctx } = view;
    const readonly = Boolean(task.virtual);
    const draftTitle = view.draft.title ?? task.title;
    const draftDesc = view.draft.description ?? task.description;
    const flag = ctx === "task" && !readonly ? `<button type="button" class="ds-btn ds-btn--tertiary ds-btn--icon ds-btn--sm flag-btn" data-action="toggle-urgent" aria-pressed="${task.urgent}" aria-label="Marquer comme urgente" data-tooltip="Marquer comme urgente">${icon("flag", 16)}</button>` : "";
    const trash = series ? `<button type="button" class="ds-btn ds-btn--tertiary ds-btn--danger ds-btn--icon" data-action="delete-series" aria-label="Supprimer la récurrence" data-tooltip="Supprimer la récurrence">${icon("delete", 20)}</button>` : "";
    const prop = (name, label, value, cls = "") => `<div class="prop ${cls}"><div class="prop__label">${icon(name, 16)}<span>${label}</span></div><div class="prop__value">${value}</div></div>`;
    const statusValue = ctx === "task"
      ? readonly
        ? `<span class="status-pill">${P.STATUS_LABELS[task.status]}</span>`
        : `<button type="button" class="status-pill" data-action="change-status" aria-haspopup="listbox" aria-expanded="false" aria-label="Statut : ${P.STATUS_LABELS[task.status]}">${P.STATUS_LABELS[task.status]}${icon("arrow_drop_down", 16)}</button>`
      : "";
    const estimateValue = `<span>${task.estimate ? Format.estimateLong(task.estimate) : "Aucun"}</span>${ctx === "task" && task.spent ? `<span class="ds-pill">${icon("timer", 12)}${Format.estimateLong(task.spent)}</span>` : ""}`;

    return `
      <div class="task-modal__header">
        ${flag}
        <nav class="ds-breadcrumb" aria-label="Fil d'Ariane"><span>${esc(task.client)}</span>${icon("chevron_right", 16)}<span id="task-modal-title" aria-current="page"><strong>${esc(task.title)}</strong></span></nav>
        ${trash}
        <button type="button" class="ds-btn ds-btn--tertiary ds-btn--icon" data-action="close-modal" aria-label="Fermer">${icon("close", 20)}</button>
      </div>
      <div class="task-modal__body">
        <div class="task-modal__left">
          <div class="source-card"><div class="source-card__label">Dossier comptable</div><div class="source-card__value">${esc(task.client)}</div></div>
          <div class="ds-field"><label class="ds-label" for="tm-title">Titre</label><input id="tm-title" class="ds-input" maxlength="120" data-field="tm-title" value="${esc(draftTitle)}"${readonly ? " readonly" : ""}></div>
          <div class="ds-field ds-field--grow"><label class="ds-label" for="tm-desc">Détails</label><textarea id="tm-desc" class="ds-input ds-textarea" data-field="tm-description"${readonly ? " readonly" : ""}>${esc(draftDesc)}</textarea></div>
          ${readonly ? "" : `<button type="button" class="ds-btn ds-btn--primary" data-action="save-task" style="align-self:flex-start" disabled>${icon("check", 16)}Sauvegarder</button>`}
        </div>
        <div class="task-modal__right">
          ${prop("person", "Assignée à", assigneeHTML(task.assignee))}
          ${prop("domain", "Client", `<span class="client-link"><span>{PCF} ${esc(task.client)}</span>${icon("open_in_new", 16)}</span>`)}
          ${ctx === "task" ? prop("label", "Statut", statusValue) : ""}
          ${prop("calendar_today", "Échéance", `<span>${task.due ? D.fmt(task.due) : "Aucune"}</span>`)}
          ${prop("event_available", "À faire avant", `<span>${task.todoBefore ? D.fmt(task.todoBefore) : "Aucune"}</span>`)}
          ${recurrenceRowHTML(view)}
          ${prop("timer", "Temps estimé", estimateValue)}
          ${prop("local_offer", "Catégorie", task.mission ? `<span class="ds-deco ds-deco--${missionColor(task.mission)}">${icon("local_offer", 12)}${esc(task.mission)}</span>` : "<span>Aucune</span>")}
          ${prop("receipt_long", "Tâche factu.", `<span>${esc(task.billable || "Aucune")}</span>`)}
        </div>
      </div>`;
  }

  function recurrenceRowHTML(view) {
    const { series } = view;
    if (!series) {
      return `<div class="prop"><div class="prop__label">${icon("loop", 16)}<span>Récurrence</span></div><div class="prop__value"><span>Jamais</span></div></div>`;
    }
    if (view.editing) {
      let control;
      if (series.frequency === "weekly") {
        control = selectHTML({ name: "rec-edit", id: "rec-edit", value: String(series.weekday), options: P.WEEKDAY_OPTIONS, size: "sm", ariaLabel: "Jour de la semaine" });
      } else if (series.frequency === "monthly") {
        control = selectHTML({ name: "rec-edit", id: "rec-edit", value: series.monthDay, options: P.MONTH_DAY_OPTIONS, size: "sm", ariaLabel: "Jour du mois" });
      } else {
        control = dateInputHTML({ name: "rec-edit-anchor", id: "rec-edit", value: series.anchor, size: "sm", ariaLabel: "Date de départ" });
      }
      return `<div class="prop prop--edit prop--recurrence">
        <div class="prop__label">${icon("loop", 16)}<span>Récurrence</span></div>
        <div class="prop__edit-row">
          <div style="flex:1;min-width:0">
            <div class="ds-label" style="margin-bottom:4px">${Schedule.editLabel(series)}<span data-tooltip="La fréquence ne peut pas être modifiée après la création." tabindex="0" role="img" aria-label="La fréquence ne peut pas être modifiée après la création." style="display:flex">${icon("info_outline", 14)}</span></div>
            ${control}
          </div>
          <button type="button" class="ds-btn ds-btn--secondary ds-btn--icon" data-action="cancel-recurrence-edit" aria-label="Annuler la modification">${icon("close", 16)}</button>
        </div>
      </div>`;
    }
    const readonlyView = view.task.virtual;
    return `<div class="prop prop--recurrence">
      <div class="prop__label">${icon("loop", 16)}<span>Récurrence</span></div>
      <div class="prop__value"><span>${esc(Schedule.label(series))}</span></div>
      <div class="prop__actions">
        <button type="button" class="ds-btn ds-btn--tertiary ds-btn--icon ds-btn--sm" data-action="show-occurrences" aria-haspopup="listbox" aria-expanded="false" aria-label="Voir les occurrences" data-tooltip="Voir les occurrences">${icon("format_list_bulleted", 16)}</button>
        ${readonlyView ? "" : `<button type="button" class="ds-btn ds-btn--tertiary ds-btn--icon ds-btn--sm" data-action="edit-recurrence" aria-label="Modifier la récurrence" data-tooltip="Modifier la récurrence">${icon("edit", 16)}</button>`}
      </div>
    </div>`;
  }

  let activeView = null;

  function openTaskModal(task, ctx) {
    Modal.closeAll();
    const series = task.seriesId ? seriesById(task.seriesId) : null;
    activeView = { task, series, ctx, editing: false, draft: {} };
    Modal.open({
      html: `<div class="ds-modal task-modal">${taskModalInner(activeView)}</div>`,
      labelledBy: "task-modal-title",
      onClose: () => {
        activeView = null;
      },
    });
  }

  function rerenderTaskModal(focusSelector) {
    const top = Modal.top();
    if (!top || !activeView) return;
    if (Menu.current) Menu.current.close(false);
    top.dialog.innerHTML = taskModalInner(activeView);
    const target = focusSelector && top.dialog.querySelector(focusSelector);
    if (target) target.focus({ preventScroll: true });
  }

  function openSeries(id) {
    const series = seriesById(id);
    if (!series) return;
    openTaskModal(taskById(series.currentTaskId), "series");
  }

  function openDeleteModal(series) {
    Modal.closeAll();
    Modal.open({
      html: `<div class="ds-modal ds-modal--sm" data-delete="${series.id}">
        <div class="ds-modal__header"><h2 class="ds-modal__title" id="delete-title">Supprimer la récurrence</h2><button type="button" class="ds-btn ds-btn--tertiary ds-btn--icon" data-action="close-modal" aria-label="Fermer">${icon("close", 20)}</button></div>
        <div class="ds-modal__body">
          <p class="delete-modal__text">Aucune nouvelle tâche ne sera créée après cette date.</p>
          <div class="delete-modal__fields">
            ${dateInputHTML({ name: "lastDue", id: "last-due", label: "Dernière échéance", value: todayIso() })}
            <button type="button" class="ds-switch" role="switch" aria-checked="false" data-action="toggle-delete-all"><span class="ds-switch__track"></span><span>Supprimer toutes les tâches déjà créées</span></button>
          </div>
        </div>
        <div class="ds-modal__footer">
          <button type="button" class="ds-btn ds-btn--secondary" data-action="close-modal">Annuler</button>
          <button type="button" class="ds-btn ds-btn--danger ds-btn--primary" data-action="confirm-delete">Supprimer la récurrence</button>
        </div>
      </div>`,
      labelledBy: "delete-title",
    });
  }

  function confirmDelete() {
    const top = Modal.top();
    const series = seriesById(top.dialog.dataset.delete);
    const input = top.dialog.querySelector('[data-mask="date"]');
    const error = top.dialog.querySelector("[data-error]");
    if (!D.parseFr(input.value)) {
      input.setAttribute("aria-invalid", "true");
      error.hidden = false;
      error.innerHTML = `${icon("error_outline", 14)}<span>Saisissez une date valide.</span>`;
      input.focus();
      return;
    }
    const deleteAll = top.dialog.querySelector('[role="switch"]').getAttribute("aria-checked") === "true";
    state.series = state.series.filter((item) => item.id !== series.id);
    if (deleteAll) state.tasks = state.tasks.filter((task) => task.seriesId !== series.id);
    else state.tasks.forEach((task) => { if (task.seriesId === series.id) task.seriesId = null; });
    Modal.closeAll();
    render(true);
    toast({ type: "danger", title: "Récurrence supprimée", content: `${series.title} ne générera plus de nouvelles tâches` });
  }

  function saveTask() {
    const top = Modal.top();
    const title = top.dialog.querySelector("#tm-title").value.trim();
    const description = top.dialog.querySelector("#tm-desc").value;
    if (!title) {
      top.dialog.querySelector("#tm-title").setAttribute("aria-invalid", "true");
      top.dialog.querySelector("#tm-title").focus();
      return;
    }
    const { task, series, ctx } = activeView;
    task.title = title;
    task.description = description;
    if (series && series.currentTaskId === task.id) {
      series.title = title;
      series.description = description;
    }
    activeView.draft = {};
    render();
    rerenderTaskModal();
    toast({ type: "success", title: "Modifications enregistrées", content: ctx === "series" ? "La récurrence utilisera ce titre et ces détails." : `${title} a été mise à jour.` });
  }

  function applyRecurrenceEdit(value) {
    const { series } = activeView;
    if (series.frequency === "weekly") series.weekday = Number(value);
    else if (series.frequency === "monthly") series.monthDay = value;
    else series.anchor = value;
    const current = taskById(series.currentTaskId);
    let content = "Les prochaines tâches suivront ce nouveau rythme.";
    if (current.status === "todo") {
      current.due = Schedule.firstDue(series, todayIso());
      current.todoBefore = D.addDays(current.due, -series.leadDays);
      content = `Prochaine échéance : ${D.fmt(current.due)}.`;
    }
    activeView.task = current;
    activeView.editing = false;
    render();
    rerenderTaskModal('[data-action="edit-recurrence"]');
    toast({ type: "success", title: "Récurrence modifiée", content });
  }

  function openOccurrences(button) {
    const items = occurrenceItems(activeView);
    new Menu({
      anchor: button,
      items,
      selected: activeView.task.virtual ? items.find((item) => item.task.id === activeView.task.id)?.value : activeView.task.id,
      matchWidth: false,
      align: "end",
      label: "Occurrences",
      onSelect: (item) => openTaskModal(item.task, "task"),
    }).open();
  }

  function openStatusMenu(button) {
    new Menu({
      anchor: button,
      items: P.STATUSES.map((status) => ({ value: status.value, label: status.label })),
      selected: activeView.task.status,
      matchWidth: false,
      label: "Statut",
      onSelect: (item) => {
        activeView.task.status = item.value;
        render();
        rerenderTaskModal('[data-action="change-status"]');
      },
    }).open();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-stop]")) return;
    const el = event.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    switch (action) {
      case "noop":
        event.preventDefault();
        break;
      case "go-recurring":
        navigate("recurring");
        break;
      case "go-tasks":
        navigate("tasks");
        break;
      case "new-task":
        window.APP.openCreate("task");
        break;
      case "new-recurring":
        window.APP.openCreate("recurring");
        break;
      case "open-task":
        openTaskModal(taskById(el.dataset.id), "task");
        break;
      case "open-series":
        openSeries(el.dataset.id);
        break;
      case "sort-due":
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        refreshRegion();
        document.querySelector('[data-action="sort-due"]').focus();
        break;
      case "close-modal":
        Modal.close();
        break;
      case "toggle-urgent":
        activeView.task.urgent = !activeView.task.urgent;
        el.setAttribute("aria-pressed", String(activeView.task.urgent));
        break;
      case "change-status":
        openStatusMenu(el);
        break;
      case "show-occurrences":
        if (el.getAttribute("aria-expanded") !== "true") openOccurrences(el);
        break;
      case "edit-recurrence":
        activeView.editing = true;
        rerenderTaskModal("#rec-edit");
        break;
      case "cancel-recurrence-edit":
        activeView.editing = false;
        rerenderTaskModal('[data-action="edit-recurrence"]');
        break;
      case "delete-series":
        openDeleteModal(activeView.series);
        break;
      case "toggle-delete-all":
        el.setAttribute("aria-checked", String(el.getAttribute("aria-checked") !== "true"));
        break;
      case "confirm-delete":
        confirmDelete();
        break;
      case "save-task":
        saveTask();
        break;
      case "proto-examples":
        loadExamples();
        render();
        toast({ type: "info", title: "Exemples chargés", content: "Trois tâches récurrentes ont été ajoutées." });
        break;
      case "proto-advance": {
        const count = advanceSeries();
        render();
        toast({ type: "info", title: "Échéance suivante atteinte", content: `${count} nouvelle${count > 1 ? "s" : ""} occurrence${count > 1 ? "s ont été créées" : " a été créée"}.` });
        break;
      }
      case "proto-reset":
        location.reload();
        break;
      case "proto-hide":
        state.protoHidden = true;
        document.getElementById("proto").innerHTML = "";
        break;
      default:
        break;
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches && event.target.matches('.ds-table__row[data-action="open-series"]')) {
      event.preventDefault();
      openSeries(event.target.dataset.id);
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.id === "search") {
      state.search = target.value;
      refreshRegion();
      return;
    }
    if (!target.dataset || !activeView) return;
    if (target.dataset.field === "tm-title" || target.dataset.field === "tm-description") {
      const key = target.dataset.field === "tm-title" ? "title" : "description";
      activeView.draft[key] = target.value;
      target.removeAttribute("aria-invalid");
      const top = Modal.top();
      const save = top && top.dialog.querySelector('[data-action="save-task"]');
      if (save) {
        const changed = (activeView.draft.title ?? activeView.task.title) !== activeView.task.title || (activeView.draft.description ?? activeView.task.description) !== activeView.task.description;
        save.disabled = !changed;
      }
    }
  });

  document.addEventListener("ds-change", (event) => {
    const { name, value } = event.detail;
    if (name === "rec-edit" && activeView && activeView.editing) applyRecurrenceEdit(value);
    if (name === "rec-edit-anchor" && activeView && activeView.editing && value) applyRecurrenceEdit(value);
  });

  function createFromForm(form) {
    const created = [];
    const assignee = form.assignee.kind === "role" ? form.assignee : { kind: "user", id: form.assignee.id || CURRENT_USER };
    form.clients.forEach((client) => {
      const common = {
        title: form.title.trim(),
        description: form.description,
        client,
        assignee,
        estimate: form.estimate,
        fiscalYear: form.fiscalYear,
        billable: form.billable,
        mission: form.mission,
      };
      if (form.frequency === "never") {
        created.push(makeTask({ ...common, due: form.dueDate, todoBefore: form.todoBefore }));
        return;
      }
      const hasDateLead = form.frequency !== "weekly" && form.frequency !== "monthly";
      const leadDays = hasDateLead ? D.diffDays(form.anchor, form.todoBefore) : Number(form.leadDays);
      const series = makeSeries({
        ...common,
        active: true,
        createdBy: CURRENT_USER,
        frequency: form.frequency,
        weekday: Number(form.weekday),
        monthDay: form.monthDay,
        anchor: form.anchor,
        leadDays,
      });
      const due = Schedule.firstDue(series, todayIso());
      const task = makeTask({ ...common, due, todoBefore: D.addDays(due, -leadDays), seriesId: series.id });
      series.currentTaskId = task.id;
      state.series.push(series);
      state.tasks.push(task);
      created.push(task);
    });
    return created;
  }

  function announceCreation(form, created, fromList) {
    const count = created.length;
    const recurring = form.frequency !== "never";
    const adjective = recurring && !fromList ? ` ${P.FREQUENCY_ADJECTIVES[form.frequency]}` : "";
    let title;
    if (!recurring) title = count > 1 ? `${count} tâches créées` : "Tâche créée";
    else title = count > 1 ? `${count} tâches récurrentes créées` : `Tâche récurrente${adjective} créée`;
    const content = count > 1 ? "Une tâche a été créée pour chaque client." : `${created[0].title} a été créée.`;
    const actions = [{ label: "Ignorer", kind: "tertiary" }];
    if (count === 1) actions.push({ label: "Voir la tâche", kind: "secondary", onClick: () => openTaskModal(taskById(created[0].id), "task") });
    else if (state.route !== "tasks") actions.push({ label: "Voir les tâches", kind: "secondary", onClick: () => navigate("tasks") });
    toast({ type: "success", title, content, actions });
  }

  window.APP = {
    state,
    CURRENT_USER,
    userById,
    createFromForm,
    announceCreation,
    render,
    todayIso,
    init() {
      state.route = location.hash.startsWith("#/tasks/recurring") ? "recurring" : "tasks";
      if (!location.hash) history.replaceState(null, "", "#/tasks");
      seedBoard();
      render();
      window.addEventListener("hashchange", () => {
        state.route = location.hash.startsWith("#/tasks/recurring") ? "recurring" : "tasks";
        Modal.closeAll();
        render(true);
      });
    },
  };
})();
