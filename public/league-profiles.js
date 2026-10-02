function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatList(items = []) {
  return Array.isArray(items) && items.length
    ? items.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join(" ")
    : "<span class=\"badge\">Aucun</span>";
}

function renderProfileCard(profile) {
  const exactScoreText = profile.exactScoreAllowed ? "Autorise" : "Deconseille";
  const volatility = escapeHtml(profile.volatility || "inconnue");
  const comeback = escapeHtml(profile.comeback || "inconnu");
  const title = escapeHtml(profile.title || "Profil inconnu");
  const tempo = escapeHtml(profile.tempo || "-");
  const note = escapeHtml(profile.note || "");

  return `
    <article class="mini">
      <h3>${title}</h3>
      <p><strong>Tempo:</strong> ${tempo}</p>
      <p><strong>Volatilite:</strong> ${volatility} | <strong>Retournement:</strong> ${comeback}</p>
      <p><strong>Score exact:</strong> ${exactScoreText}</p>
      <p><strong>Favorise:</strong> ${formatList(profile.recommendedMarkets)}</p>
      <p><strong>A eviter:</strong> ${formatList(profile.avoidMarkets)}</p>
      <p>${note}</p>
    </article>
  `;
}

async function loadLeagueProfiles() {
  const host = document.getElementById("leagueProfilesGrid");
  if (!host) return;

  try {
    const response = await fetch("/api/league-profiles", { cache: "no-store" });
    const data = await response.json();
    const profiles = Array.isArray(data?.data?.profiles) ? data.data.profiles : [];

    if (!response.ok || !data?.success || profiles.length === 0) {
      throw new Error("Profils indisponibles");
    }

    host.innerHTML = profiles.map(renderProfileCard).join("");
  } catch (_error) {
    host.innerHTML = `
      <article class="mini">
        <h3>Profils indisponibles</h3>
        <p>Le moteur n'a pas pu charger la documentation des ligues pour le moment.</p>
      </article>
    `;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadLeagueProfiles, { once: true });
} else {
  loadLeagueProfiles();
}
