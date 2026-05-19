const authSubtitle = document.getElementById("authSubtitle");
const authStateTitle = document.getElementById("authStateTitle");
const authStatusGrid = document.getElementById("authStatusGrid");
const quotaCard = document.getElementById("quotaCard");
const planList = document.getElementById("planList");
const planSelect = document.getElementById("planSelect");
const logoutBtn = document.getElementById("logoutBtn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

let currentPlans = [];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message || payload?.message || `Erreur ${response.status}`);
  }
  return payload;
}

function renderStatusCards(user, quota) {
  authStatusGrid.innerHTML = `
    <article class="auth-status-card">
      <span>Utilisateur</span>
      <strong>${escapeHtml(user?.username || user?.email || "Invite")}</strong>
      <em>${escapeHtml(user?.email || "Pas encore connecte")}</em>
    </article>
    <article class="auth-status-card">
      <span>Role</span>
      <strong>${escapeHtml(user?.role || "Aucun")}</strong>
      <em>${escapeHtml(user?.status || "inactif")}</em>
    </article>
    <article class="auth-status-card">
      <span>Plan</span>
      <strong>${escapeHtml(user?.planKey || "free")}</strong>
      <em>${escapeHtml(user?.subscriptionStatus || "n/a")}</em>
    </article>
    <article class="auth-status-card">
      <span>Quota</span>
      <strong>${quota?.unlimited ? "Illimite" : `${Number(quota?.remainingToday || 0)} restants`}</strong>
      <em>${quota?.unlimited ? "Aucun plafond actif" : `${Number(quota?.usedToday || 0)} utilise(s) aujourd'hui`}</em>
    </article>
  `;
}

function renderQuota(quota, user) {
  if (!quota || !user) {
    quotaCard.innerHTML = `
      <div class="quota-label">Quota actif</div>
      <div class="quota-value">Non connecte</div>
      <div class="quota-note">Connecte-toi pour voir ton quota et ta consommation.</div>
    `;
    return;
  }

  const dailyQuota = quota.unlimited ? null : Number(quota.dailyQuota || 0);
  const remaining = quota.unlimited ? null : Number(quota.remainingToday || 0);
  const used = Number(quota.usedToday || 0);
  const ratio = quota.unlimited || !dailyQuota ? 100 : Math.max(0, Math.min(100, ((dailyQuota - remaining) / dailyQuota) * 100));

  quotaCard.innerHTML = `
    <div class="quota-label">Quota journalier</div>
    <div class="quota-value">${quota.unlimited ? "Illimite" : `${remaining} / ${dailyQuota} restant(s)`}</div>
    <div class="quota-note">${quota.unlimited ? "Ce plan ne limite pas les predictions." : `${used} prediction(s) deja consommees aujourd'hui.`}</div>
    <div class="quota-track" aria-hidden="true">
      <div class="quota-fill" style="width:${ratio}%"></div>
    </div>
  `;
}

function renderPlans(plans = []) {
  currentPlans = plans;
  planSelect.innerHTML = plans
    .map(
      (plan) =>
        `<option value="${escapeHtml(plan.plan_key)}">${escapeHtml(plan.display_name)}${plan.is_unlimited ? " - illimite" : ` - ${plan.daily_prediction_quota}/jour`}</option>`
    )
    .join("");

  planList.innerHTML = plans
    .map((plan) => {
      const quota = plan.is_unlimited
        ? "Illimite"
        : `${plan.daily_prediction_quota} / jour`;
      return `
        <article class="plan-card">
          <span>${escapeHtml(plan.display_name)}</span>
          <strong>${escapeHtml(quota)}</strong>
          <em>${escapeHtml(plan.price_label || "Plan disponible")}</em>
        </article>
      `;
    })
    .join("");
}

function syncHeader(user, quota) {
  if (!user) {
    authStateTitle.textContent = "Aucun compte connecte";
    authSubtitle.textContent = "Connecte-toi pour debloquer les predictions et suivre la consommation de quota.";
    logoutBtn.hidden = true;
    return;
  }

  authStateTitle.textContent = user.role === "admin" ? "Espace administrateur" : "Mon espace utilisateur";
  authSubtitle.textContent = quota?.unlimited
    ? "Ton compte est actif avec un quota illimite."
    : `Tu as ${Number(quota?.remainingToday || 0)} prediction(s) restante(s) aujourd'hui.`;
  logoutBtn.hidden = false;
  logoutBtn.textContent = "Deconnexion";
}

async function loadSession() {
  const payload = await apiFetch("/api/auth/me", { method: "GET", headers: {} });
  renderPlans(payload.plans || currentPlans);
  const user = payload.authenticated ? payload.user : null;
  const quota = payload.quota || null;
  syncHeader(user, quota);
  renderStatusCards(user, quota);
  renderQuota(quota, user);
}

async function loadPlans() {
  const payload = await apiFetch("/api/auth/plans", { method: "GET", headers: {} });
  renderPlans(payload.plans || []);
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const body = {
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || ""),
  };

  try {
    const payload = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
    authSubtitle.textContent = payload.message || "Connexion reussie.";
    window.location.href = payload.user?.role === "admin" ? "/admin.html" : "/";
  } catch (error) {
    authSubtitle.textContent = error.message;
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const body = {
    username: String(formData.get("username") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || ""),
    planKey: String(formData.get("planKey") || "free"),
  };

  try {
    const payload = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
    authSubtitle.textContent = payload.message || "Compte cree.";
    window.location.href = payload.user?.role === "admin" ? "/admin.html" : "/";
  } catch (error) {
    authSubtitle.textContent = error.message;
  }
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
  } catch (_error) {
    // logout should still proceed locally
  }
  window.location.href = "/auth.html";
});

loadPlans()
  .then(() => loadSession())
  .catch((error) => {
    authStateTitle.textContent = "Acces au compte";
    authSubtitle.textContent = error.message || "Impossible de charger le profil.";
    renderStatusCards(null, null);
    renderQuota(null, null);
    renderPlans(currentPlans.length ? currentPlans : []);
  });
