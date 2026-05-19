const adminSubtitle = document.getElementById("adminSubtitle");
const adminStateTitle = document.getElementById("adminStateTitle");
const adminStats = document.getElementById("adminStats");
const userList = document.getElementById("userList");
const createUserForm = document.getElementById("createUserForm");
const createRoleSelect = document.getElementById("createRoleSelect");
const createPlanSelect = document.getElementById("createPlanSelect");
const createStatusSelect = document.getElementById("createStatusSelect");
const createSubscriptionSelect = document.getElementById("createSubscriptionSelect");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");
const createUserResetBtn = document.getElementById("createUserResetBtn");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

let adminUser = null;
let availablePlans = [];

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

function optionList(values, selected = "") {
  return values
    .map((item) => `<option value="${escapeHtml(item.value)}"${item.value === selected ? " selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function planOptions(selected = "free") {
  return availablePlans
    .map((plan) => `<option value="${escapeHtml(plan.plan_key)}"${plan.plan_key === selected ? " selected" : ""}>${escapeHtml(plan.display_name)}</option>`)
    .join("");
}

function syncCreateFormOptions() {
  createRoleSelect.innerHTML = optionList(
    [
      { value: "user", label: "Utilisateur" },
      { value: "admin", label: "Administrateur" },
    ],
    "user"
  );

  createStatusSelect.innerHTML = optionList(
    [
      { value: "active", label: "Actif" },
      { value: "suspended", label: "Suspendu" },
      { value: "blocked", label: "Bloque" },
    ],
    "active"
  );

  createSubscriptionSelect.innerHTML = optionList(
    [
      { value: "active", label: "Actif" },
      { value: "trialing", label: "Essai" },
      { value: "past_due", label: "Impayee" },
      { value: "canceled", label: "Annulee" },
    ],
    "active"
  );
}

function renderStats(users = []) {
  const total = users.length;
  const admins = users.filter((user) => user.role === "admin").length;
  const active = users.filter((user) => user.status === "active").length;
  const suspended = users.filter((user) => user.status !== "active").length;

  adminStats.innerHTML = `
    <article class="admin-stat-card">
      <span>Utilisateurs</span>
      <strong>${total}</strong>
      <em>Comptes charges depuis la base</em>
    </article>
    <article class="admin-stat-card">
      <span>Admins</span>
      <strong>${admins}</strong>
      <em>Role de controle</em>
    </article>
    <article class="admin-stat-card">
      <span>Actifs</span>
      <strong>${active}</strong>
      <em>Comptes autorises</em>
    </article>
    <article class="admin-stat-card">
      <span>Suspendus</span>
      <strong>${suspended}</strong>
      <em>Comptes limites</em>
    </article>
  `;
}

function renderUserCard(user) {
  const plan = availablePlans.find((item) => item.plan_key === user.planKey);
  const planLabel = user.planName || plan?.display_name || user.planKey || "free";
  const planQuota = user.planUnlimited ? "Illimite" : `${Number(user.planDailyQuota || 0)} / jour`;
  const quotaLabel = user.quota?.unlimited
    ? "Quota illimite"
    : user.quota
      ? `${Number(user.quota.remainingToday || 0)} restants aujourd'hui`
      : "Quota calculable a la connexion";

  return `
    <article class="user-card" data-user-card="${escapeHtml(user.userId)}">
      <div class="user-card__head">
        <div>
          <h3 class="user-card__title">${escapeHtml(user.username || user.email || user.userId)}</h3>
          <div class="user-chip-row">
            <span class="user-chip">${escapeHtml(user.email || "sans email")}</span>
            <span class="user-chip">${escapeHtml(user.role || "user")}</span>
            <span class="user-chip">${escapeHtml(planLabel)}</span>
            <span class="user-chip">${escapeHtml(user.status || "active")}</span>
            <span class="user-chip">${escapeHtml(user.subscriptionStatus || "active")}</span>
          </div>
        </div>
        <div class="user-card__meta">
          <span>Quota planifie</span>
          <strong>${escapeHtml(planQuota)}</strong>
          <em>${escapeHtml(quotaLabel)}</em>
        </div>
      </div>

      <div class="user-fields">
        <label><span>Email</span><input type="email" name="email" value="${escapeHtml(user.email || "")}" /></label>
        <label><span>Nom</span><input type="text" name="username" value="${escapeHtml(user.username || "")}" /></label>
        <label><span>Role</span>
          <select name="role">
            ${optionList([
              { value: "user", label: "Utilisateur" },
              { value: "admin", label: "Administrateur" },
            ], user.role || "user")}
          </select>
        </label>
        <label><span>Plan</span>
          <select name="planKey">
            ${planOptions(user.planKey || "free")}
          </select>
        </label>
        <label><span>Statut</span>
          <select name="status">
            ${optionList([
              { value: "active", label: "Actif" },
              { value: "suspended", label: "Suspendu" },
              { value: "blocked", label: "Bloque" },
            ], user.status || "active")}
          </select>
        </label>
        <label><span>Abonnement</span>
          <select name="subscriptionStatus">
            ${optionList([
              { value: "active", label: "Actif" },
              { value: "trialing", label: "Essai" },
              { value: "past_due", label: "Impayee" },
              { value: "canceled", label: "Annulee" },
            ], user.subscriptionStatus || "active")}
          </select>
        </label>
        <label><span>Quota quotidien</span><input type="number" name="quotaOverrideDaily" min="0" value="${user.quotaOverrideDaily ?? ""}" placeholder="vide" /></label>
        <label><span>Quota mensuel</span><input type="number" name="quotaOverrideMonthly" min="0" value="${user.quotaOverrideMonthly ?? ""}" placeholder="vide" /></label>
        <label><span>Nouveau mot de passe</span><input type="password" name="password" placeholder="laisser vide pour conserver" /></label>
      </div>

      <div class="user-actions">
        <button type="button" class="auth-primary-btn" data-save-user="${escapeHtml(user.userId)}">Enregistrer</button>
        <button type="button" class="auth-secondary-btn danger" data-delete-user="${escapeHtml(user.userId)}">Supprimer</button>
      </div>
      <div class="user-warning">${escapeHtml(user.userId === adminUser?.userId ? "Ce compte est votre session courante." : "")}</div>
    </article>
  `;
}

function renderUsers(users = []) {
  userList.innerHTML = users.map(renderUserCard).join("");

  userList.querySelectorAll("[data-save-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.getAttribute("data-save-user");
      const card = button.closest("[data-user-card]");
      if (!card || !userId) return;

      const formData = new FormData();
      card.querySelectorAll("input, select").forEach((field) => {
        if (!field.name) return;
        formData.set(field.name, field.value);
      });

      const body = {
        email: String(formData.get("email") || "").trim(),
        username: String(formData.get("username") || "").trim(),
        role: String(formData.get("role") || "user"),
        planKey: String(formData.get("planKey") || "free"),
        status: String(formData.get("status") || "active"),
        subscriptionStatus: String(formData.get("subscriptionStatus") || "active"),
        quotaOverrideDaily: formData.get("quotaOverrideDaily") === "" ? null : Number(formData.get("quotaOverrideDaily")),
        quotaOverrideMonthly: formData.get("quotaOverrideMonthly") === "" ? null : Number(formData.get("quotaOverrideMonthly")),
        password: String(formData.get("password") || ""),
      };

      if (!body.password) delete body.password;

      button.disabled = true;
      try {
        await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        await refreshData();
        adminSubtitle.textContent = "Utilisateur mis a jour.";
      } catch (error) {
        adminSubtitle.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  });

  userList.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.getAttribute("data-delete-user");
      if (!userId || !window.confirm("Supprimer definitivement ce compte ?")) return;

      button.disabled = true;
      try {
        await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "DELETE",
          body: "{}",
        });
        await refreshData();
        adminSubtitle.textContent = "Utilisateur supprime.";
      } catch (error) {
        adminSubtitle.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  });
}

function syncAdminHeader(user) {
  if (!user) {
    adminStateTitle.textContent = "Acces non connecte";
    adminSubtitle.textContent = "Connecte-toi d'abord pour ouvrir l'espace administrateur.";
    return false;
  }

  if (user.role !== "admin") {
    adminStateTitle.textContent = "Acces refuse";
    adminSubtitle.textContent = "Ton compte n'a pas les droits administrateur.";
    return false;
  }

  adminStateTitle.textContent = `${user.username || user.email} - administrateur`;
  adminSubtitle.textContent = "Tu peux creer, modifier, suspendre et supprimer des comptes.";
  return true;
}

async function loadBootData() {
  const payload = await apiFetch("/api/auth/me", { method: "GET", headers: {} });
  adminUser = payload.authenticated ? payload.user : null;
  if (!syncAdminHeader(adminUser)) {
    setTimeout(() => {
      window.location.href = "/auth.html";
    }, 1600);
    return false;
  }

  const usersPayload = await apiFetch("/api/admin/users?limit=200", { method: "GET", headers: {} });
  availablePlans = usersPayload.plans || [];
  syncCreateFormOptions();
  createPlanSelect.innerHTML = planOptions("free");
  renderStats(usersPayload.users || []);
  renderUsers(usersPayload.users || []);
  return true;
}

async function refreshData() {
  const usersPayload = await apiFetch("/api/admin/users?limit=200", { method: "GET", headers: {} });
  availablePlans = usersPayload.plans || availablePlans;
  createPlanSelect.innerHTML = planOptions(createPlanSelect.value || "free");
  renderStats(usersPayload.users || []);
  renderUsers(usersPayload.users || []);
}

createUserResetBtn?.addEventListener("click", () => {
  createUserForm?.reset();
  createRoleSelect.value = "user";
  createStatusSelect.value = "active";
  createSubscriptionSelect.value = "active";
  createPlanSelect.value = "free";
});

refreshUsersBtn?.addEventListener("click", () => {
  refreshData().catch((error) => {
    adminSubtitle.textContent = error.message;
  });
});

createUserForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(createUserForm);
  const body = {
    username: String(formData.get("username") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || ""),
    role: String(formData.get("role") || "user"),
    planKey: String(formData.get("planKey") || "free"),
    status: String(formData.get("status") || "active"),
    subscriptionStatus: String(formData.get("subscriptionStatus") || "active"),
    quotaOverrideDaily: formData.get("quotaOverrideDaily") === "" ? null : Number(formData.get("quotaOverrideDaily")),
    quotaOverrideMonthly: formData.get("quotaOverrideMonthly") === "" ? null : Number(formData.get("quotaOverrideMonthly")),
  };

  try {
    await apiFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(body),
    });
    createUserForm.reset();
    createRoleSelect.value = "user";
    createStatusSelect.value = "active";
    createSubscriptionSelect.value = "active";
    createPlanSelect.value = "free";
    adminSubtitle.textContent = "Utilisateur cree.";
    await refreshData();
  } catch (error) {
    adminSubtitle.textContent = error.message;
  }
});

loadBootData().catch((error) => {
  adminStateTitle.textContent = "Acces administrateur";
  adminSubtitle.textContent = error.message || "Impossible de charger les donnees admin.";
});

adminLogoutBtn?.addEventListener("click", async () => {
  try {
    await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
  } catch (_error) {
    // continue to redirect even if logout request fails
  }
  window.location.href = "/auth.html";
});
