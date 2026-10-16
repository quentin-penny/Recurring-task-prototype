(function () {
  const pad = (n) => String(n).padStart(2, "0");

  const D = {
    today() {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    },
    iso(d) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },
    parse(iso) {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d);
    },
    todayIso() {
      return D.iso(D.today());
    },
    fmt(iso) {
      if (!iso) return "";
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y}`;
    },
    parseFr(text) {
      const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
      if (!match) return null;
      const [, dd, mm, yyyy] = match;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      const valid =
        date.getFullYear() === Number(yyyy) &&
        date.getMonth() === Number(mm) - 1 &&
        date.getDate() === Number(dd);
      return valid ? D.iso(date) : null;
    },
    addDays(iso, n) {
      const d = D.parse(iso);
      d.setDate(d.getDate() + n);
      return D.iso(d);
    },
    daysInMonth(y, m) {
      return new Date(y, m + 1, 0).getDate();
    },
    addMonths(iso, n, targetDay) {
      const d = D.parse(iso);
      const day = targetDay || d.getDate();
      const total = d.getFullYear() * 12 + d.getMonth() + n;
      const y = Math.floor(total / 12);
      const m = total % 12;
      return D.iso(new Date(y, m, Math.min(day, D.daysInMonth(y, m))));
    },
    diffDays(aIso, bIso) {
      return Math.round((D.parse(aIso) - D.parse(bIso)) / 86400000);
    },
  };

  const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

  const FREQUENCIES = [
    { value: "never", label: "Jamais" },
    { value: "weekly", label: "Toutes les semaines" },
    { value: "monthly", label: "Tous les mois" },
    { value: "quarterly", label: "Tous les trois mois" },
    { value: "semiannual", label: "Tous les six mois" },
    { value: "yearly", label: "Tous les ans" },
  ];

  const FREQUENCY_ADJECTIVES = {
    weekly: "hebdomadaire",
    monthly: "mensuelle",
    quarterly: "trimestrielle",
    semiannual: "semestrielle",
    yearly: "annuelle",
  };

  const TABLE_ADJECTIVES = {
    weekly: "Hebdomadaire",
    monthly: "Mensuelle",
    quarterly: "Trimestrielle",
    semiannual: "Semestrielle",
    yearly: "Annuelle",
  };

  const CTA_LABELS = {
    never: "Créer une tâche",
    weekly: "Créer la tâche hebdomadaire",
    monthly: "Créer la tâche mensuelle",
    quarterly: "Créer la tâche trimestrielle",
    semiannual: "Créer la tâche semestrielle",
    yearly: "Créer la tâche annuelle",
  };

  const LEAD_OPTIONS = [0, 1, 2, 3, 4, 5, 7, 10, 14].map((n) => ({
    value: String(n),
    label: n === 0 ? "Le jour de l'échéance" : n === 1 ? "1 jour avant l'échéance" : `${n} jours avant l'échéance`,
  }));

  const WEEKDAY_OPTIONS = WEEKDAYS.map((name, i) => ({
    value: String(i),
    label: name.charAt(0).toUpperCase() + name.slice(1),
  }));

  const MONTH_DAY_OPTIONS = [
    ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
    { value: "last", label: "Dernier jour du mois" },
  ];

  const USERS = [
    { id: "u1", name: "Jean-Marie La Caisse", initials: "JM", color: "var(--ui-decorative-violet-mid)" },
    { id: "u2", name: "Camille Martin", initials: "CM", color: "var(--ui-decorative-green-mid)" },
    { id: "u3", name: "Sofia Benali", initials: "SB", color: "var(--ui-decorative-orange-mid)" },
    { id: "u4", name: "Hugo Lambert", initials: "HL", color: "var(--ui-decorative-blue-mid)" },
    { id: "u5", name: "Alice Bernard", initials: "AB", color: "var(--ui-decorative-pink-mid)" },
  ];

  const ROLES = [
    { value: "r1", label: "Chef de mission" },
    { value: "r2", label: "Collaborateur comptable" },
    { value: "r3", label: "Assistant comptable" },
    { value: "r4", label: "Responsable qualité" },
  ];

  const CLIENTS = [
    "Abeille Consulting",
    "Boulangerie de la Paix",
    "Café des Artisans",
    "Domaine des Vins",
    "Acme Inc.",
    "Boulangerie du bon matin",
    "Atelier Nord",
    "Studio Hélios",
  ];

  const BILLABLE_TASKS = [
    "1.1.1 Révision",
    "1.1.2 Établissement des comptes annuels",
    "1.2.1 Tenue comptable",
    "2.1.1 Déclarations fiscales",
  ];

  const MISSION_TYPES = [
    { value: "Production comptable", color: "blue" },
    { value: "Révision", color: "violet" },
    { value: "Fiscalité", color: "yellow" },
    { value: "Social", color: "green" },
    { value: "Conseil", color: "pink" },
  ];

  const FISCAL_YEARS = ["2024", "2025", "2026", "2027"];

  const STATUSES = [
    { value: "todo", label: "À faire" },
    { value: "doing", label: "En cours" },
    { value: "blocked", label: "Bloquées" },
    { value: "done", label: "Finalisées" },
  ];

  const STATUS_LABELS = { todo: "À faire", doing: "En cours", blocked: "Bloquée", done: "Finalisée" };

  const Schedule = {
    firstDue(cfg, fromIso) {
      if (cfg.frequency === "weekly") {
        const from = D.parse(fromIso);
        const current = (from.getDay() + 6) % 7;
        const delta = (cfg.weekday - current + 7) % 7;
        return D.addDays(fromIso, delta);
      }
      if (cfg.frequency === "monthly") {
        const from = D.parse(fromIso);
        const pick = (y, m) =>
          cfg.monthDay === "last"
            ? D.daysInMonth(y, m)
            : Math.min(Number(cfg.monthDay), D.daysInMonth(y, m));
        const thisMonth = D.iso(new Date(from.getFullYear(), from.getMonth(), pick(from.getFullYear(), from.getMonth())));
        if (thisMonth >= fromIso) return thisMonth;
        return Schedule.nextDue(cfg, thisMonth);
      }
      return cfg.anchor;
    },
    nextDue(cfg, prevIso) {
      switch (cfg.frequency) {
        case "weekly":
          return D.addDays(prevIso, 7);
        case "monthly": {
          const next = D.addMonths(prevIso, 1, cfg.monthDay === "last" ? 31 : Number(cfg.monthDay));
          return next;
        }
        case "quarterly":
          return D.addMonths(prevIso, 3, D.parse(cfg.anchor).getDate());
        case "semiannual":
          return D.addMonths(prevIso, 6, D.parse(cfg.anchor).getDate());
        case "yearly":
          return D.addMonths(prevIso, 12, D.parse(cfg.anchor).getDate());
        default:
          return prevIso;
      }
    },
    previousDue(cfg, dueIso) {
      switch (cfg.frequency) {
        case "weekly":
          return D.addDays(dueIso, -7);
        case "monthly":
          return D.addMonths(dueIso, -1, cfg.monthDay === "last" ? 31 : Number(cfg.monthDay));
        case "quarterly":
          return D.addMonths(dueIso, -3, D.parse(cfg.anchor).getDate());
        case "semiannual":
          return D.addMonths(dueIso, -6, D.parse(cfg.anchor).getDate());
        case "yearly":
          return D.addMonths(dueIso, -12, D.parse(cfg.anchor).getDate());
        default:
          return dueIso;
      }
    },
    label(cfg) {
      switch (cfg.frequency) {
        case "weekly":
          return `Tous les ${WEEKDAYS[cfg.weekday]}s`;
        case "monthly":
          return cfg.monthDay === "last" ? "Le dernier jour de chaque mois" : `Le ${cfg.monthDay} de chaque mois`;
        case "quarterly":
          return "Tous les trois mois";
        case "semiannual":
          return "Tous les six mois";
        case "yearly":
          return "Tous les ans";
        default:
          return "Jamais";
      }
    },
    tooltip(cfg) {
      switch (cfg.frequency) {
        case "weekly":
          return `Toutes les semaines le ${WEEKDAYS[cfg.weekday]}`;
        case "monthly":
          return cfg.monthDay === "last" ? "Tous les mois le dernier jour" : `Tous les mois le ${cfg.monthDay}`;
        default:
          return Schedule.label(cfg);
      }
    },
    editLabel(cfg) {
      switch (cfg.frequency) {
        case "weekly":
          return "Chaque semaine, le";
        case "monthly":
          return "Chaque mois, le";
        case "quarterly":
          return "Tous les trois mois, à partir du";
        case "semiannual":
          return "Tous les six mois, à partir du";
        default:
          return "Tous les ans, à partir du";
      }
    },
  };

  const Format = {
    estimate(value) {
      if (!value) return "";
      const [h, m] = value.split(":");
      return `${Number(h)}h${m}`;
    },
    estimateLong(value) {
      if (!value) return "00h00min";
      const [h, m] = value.split(":");
      return `${h}h${m}min`;
    },
    minutes(value) {
      if (!value) return 0;
      const [h, m] = value.split(":").map(Number);
      return h * 60 + m;
    },
    hoursTotal(minutes) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m ? `${h}H${pad(m)}` : `${h}H`;
    },
    relativeDeadline(iso) {
      const diff = D.diffDays(iso, D.todayIso());
      if (diff === -1) return "Hier";
      if (diff === 0) return "Aujourd'hui";
      if (diff === 1) return "Demain";
      return D.fmt(iso);
    },
  };

  window.PROTO = {
    D,
    pad,
    WEEKDAYS,
    FREQUENCIES,
    FREQUENCY_ADJECTIVES,
    TABLE_ADJECTIVES,
    CTA_LABELS,
    LEAD_OPTIONS,
    WEEKDAY_OPTIONS,
    MONTH_DAY_OPTIONS,
    USERS,
    ROLES,
    CLIENTS,
    BILLABLE_TASKS,
    MISSION_TYPES,
    FISCAL_YEARS,
    STATUSES,
    STATUS_LABELS,
    Schedule,
    Format,
  };
})();
