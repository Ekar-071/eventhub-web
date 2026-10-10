// Client web d'EventHub : HTML/JS natif, aucun framework nécessaire.
const $ = (id) => document.getElementById(id);
const state = { token: sessionStorage.getItem("token"), email: sessionStorage.getItem("email") };

const apiBase = () => $("apiUrl").value.replace(/\/+$/, "");

function show(text, ok = true) {
  const el = $("message");
  el.textContent = text; // textContent : pas d'injection HTML
  el.className = "rounded px-3 py-2 text-sm " + (ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800");
}

async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(apiBase() + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(", ") : data.detail;
    throw new Error(detail || `Erreur ${res.status}`);
  }
  return data;
}

function renderSession() {
  const logged = Boolean(state.token);
  $("authSection").classList.toggle("hidden", logged);
  $("createSection").classList.toggle("hidden", !logged);
  $("logoutBtn").classList.toggle("hidden", !logged);
  $("userBadge").classList.toggle("hidden", !logged);
  $("userBadge").textContent = state.email || "";
}

function eventCard(ev) {
  const li = document.createElement("li");
  li.className = "bg-white rounded-lg shadow p-4 flex flex-col gap-1";
  const title = document.createElement("h3");
  title.className = "font-semibold";
  title.textContent = ev.title;
  const meta = document.createElement("p");
  meta.className = "text-sm text-slate-500";
  meta.textContent = `${new Date(ev.starts_at).toLocaleString("fr-FR")} · ${ev.location || "Lieu à préciser"}`;
  const desc = document.createElement("p");
  desc.className = "text-sm";
  desc.textContent = ev.description;
  const count = document.createElement("p");
  count.className = "text-sm font-medium";
  count.textContent = `${ev.registrations_count} / ${ev.capacity} inscrits`;
  li.append(title, meta, desc, count);
  if (state.token) {
    const btn = document.createElement("button");
    btn.className = "mt-2 self-start bg-indigo-600 text-white rounded px-3 py-1 text-sm";
    btn.textContent = "S'inscrire";
    btn.addEventListener("click", async () => {
      try {
        await api(`/events/${ev.id}/register`, { method: "POST" });
        show("Inscription confirmée");
        loadEvents();
      } catch (e) { show(e.message, false); }
    });
    li.append(btn);
  }
  return li;
}

async function loadEvents() {
  try {
    const q = encodeURIComponent($("search").value.trim());
    const events = await api(`/events${q ? `?q=${q}` : ""}`);
    $("events").replaceChildren(...events.map(eventCard));
    if (!events.length) $("events").textContent = "Aucun événement.";
  } catch (e) { show(`Impossible de joindre l'API : ${e.message}`, false); }
}

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const action = e.submitter.dataset.action;
  const creds = { email: $("email").value, password: $("password").value };
  try {
    if (action === "register") await api("/auth/register", { method: "POST", body: creds });
    const { access_token } = await api("/auth/login", { method: "POST", body: creds });
    state.token = access_token;
    state.email = creds.email;
    sessionStorage.setItem("token", access_token);
    sessionStorage.setItem("email", creds.email);
    $("password").value = "";
    show(action === "register" ? "Compte créé, vous êtes connecté" : "Connecté");
    renderSession();
    loadEvents();
  } catch (err) { show(err.message, false); }
});

$("eventForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/events", {
      method: "POST",
      body: {
        title: $("title").value,
        location: $("location").value,
        description: $("description").value,
        starts_at: $("startsAt").value,
        capacity: Number($("capacity").value),
      },
    });
    e.target.reset();
    show("Événement publié");
    loadEvents();
  } catch (err) { show(err.message, false); }
});

$("logoutBtn").addEventListener("click", () => {
  state.token = state.email = null;
  sessionStorage.clear();
  renderSession();
  loadEvents();
});

let timer;
$("search").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(loadEvents, 300); });
$("apiUrl").addEventListener("change", loadEvents);

renderSession();
loadEvents();
