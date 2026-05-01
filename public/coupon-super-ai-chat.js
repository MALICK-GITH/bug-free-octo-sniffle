class SuperAICouponGenerator {
  constructor() {
    this.conversations = [];
    this.isTyping = false;
    this.currentCouponData = null;
    this.expertise = "SOLITAIRE_AI_COUPON";
    this.suggestions = [
      "Genere-moi un coupon safe 3 matchs",
      "Optimise mon coupon actuel",
      "Compare safe, equilibre et agressif",
      "Fais une recherche rapide avant de decider",
      "Reponds a une question hors paris",
    ];

    this.init();
  }

  init() {
    this.setupSuperAIInterface();
    this.loadConversationHistory();
    this.restoreConversationHistory();
    this.setupEventListeners();
  }

  setupSuperAIInterface() {
    const resultPanel = document.querySelector("#result");
    if (!resultPanel) return;

    const section = document.createElement("section");
    section.className = "super-ai-coupon-section";
    section.innerHTML = `
      <div class="super-ai-header">
        <div class="super-ai-avatar">
          <div class="super-ai-brain">
            <div class="brain-pulse-super"></div>
            <div class="super-ai-icon">AI</div>
          </div>
          <div class="ai-status-indicator-super active"></div>
        </div>
        <div class="super-ai-info">
          <h3>Assistant Coupon Unifie</h3>
          <p class="super-ai-subtitle">Meme API que la page details, ouverte aux questions coupon, match, generales et recherches rapides.</p>
        </div>
        <div class="super-ai-actions">
          <button class="super-ai-action-btn" id="clearSuperAIChatBtn" title="Effacer">
            <span>CLR</span>
          </button>
          <button class="super-ai-action-btn" id="exportSuperAIChatBtn" title="Exporter">
            <span>EXP</span>
          </button>
          <button class="super-ai-action-btn" id="superAIExpertModeBtn" title="Mode expert">
            <span>PRO</span>
          </button>
        </div>
      </div>

      <div class="super-ai-content">
        <div class="super-ai-messages" id="superAIMessages">
          <div class="message super-ai-message">
            <div class="message-avatar">AI</div>
            <div class="message-content">
              <p>Je peux preparer, expliquer, corriger et piloter ton coupon depuis cette page.</p>
              <ul>
                <li>generation, validation et ajustement du ticket</li>
                <li>lecture bankroll, risque et correlation</li>
                <li>meme intelligence que le coach de la page details</li>
                <li>questions generales ou recherches contextuelles si besoin</li>
              </ul>
            </div>
            <div class="message-time">${this.getCurrentTime()}</div>
          </div>
        </div>

        <div class="super-ai-suggestions" id="superAISuggestions">
          <div class="suggestions-header-super">Suggestions rapides</div>
          <div class="suggestions-grid-super">
            ${this.suggestions
              .map(
                (suggestion) => `
              <button class="suggestion-btn-super" data-suggestion="${suggestion}">
                ${suggestion}
              </button>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="super-ai-input">
          <div class="input-container-super">
            <textarea
              id="superAIInput"
              placeholder="Decris le coupon voulu ou pose une autre question..."
              rows="1"
              maxlength="500"
            ></textarea>
            <button class="send-btn-super" id="sendSuperAIBtn" type="button">
              <span>GO</span>
            </button>
          </div>
          <div class="input-status-super">
            <span id="superAICharCount">0/500</span>
            <span id="superAITypingStatus" class="hidden">L'assistant prepare sa reponse...</span>
          </div>
        </div>

        <div class="super-ai-coupon-preview" id="superAICouponPreview" style="display: none;">
          <h4>Apercu de configuration</h4>
          <div class="coupon-preview-content" id="couponPreviewContent"></div>
          <div class="coupon-preview-actions">
            <button class="preview-action-btn primary" id="applyCouponBtn">Appliquer</button>
            <button class="preview-action-btn secondary" id="refineCouponBtn">Affiner</button>
          </div>
        </div>
      </div>
    `;

    resultPanel.parentNode.insertBefore(section, resultPanel);
  }

  setupEventListeners() {
    const input = document.getElementById("superAIInput");
    const sendBtn = document.getElementById("sendSuperAIBtn");
    const clearBtn = document.getElementById("clearSuperAIChatBtn");
    const exportBtn = document.getElementById("exportSuperAIChatBtn");
    const expertBtn = document.getElementById("superAIExpertModeBtn");
    const applyBtn = document.getElementById("applyCouponBtn");
    const refineBtn = document.getElementById("refineCouponBtn");

    if (input) {
      input.addEventListener("input", (event) => this.handleInput(event));
      input.addEventListener("keydown", (event) => this.handleKeydown(event));
    }

    if (sendBtn) {
      sendBtn.addEventListener("click", () => this.sendMessage());
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", () => this.clearChat());
    }
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportChat());
    }
    if (expertBtn) {
      expertBtn.addEventListener("click", () => this.toggleExpertMode());
    }
    if (applyBtn) {
      applyBtn.addEventListener("click", () => this.applyGeneratedCoupon());
    }
    if (refineBtn) {
      refineBtn.addEventListener("click", () => this.refineCouponStrategy());
    }

    document.querySelectorAll(".suggestion-btn-super").forEach((button) => {
      button.addEventListener("click", () => {
        if (!input) return;
        input.value = button.dataset.suggestion || "";
        this.handleInput({ target: input });
        this.sendMessage();
      });
    });
  }

  handleInput(event) {
    const input = event.target;
    const counter = document.getElementById("superAICharCount");
    if (counter) {
      counter.textContent = `${input.value.length}/500`;
    }

    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;

    const suggestions = document.getElementById("superAISuggestions");
    if (suggestions) {
      suggestions.classList.toggle("hidden", input.value.length > 0);
    }
  }

  handleKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  async sendMessage() {
    const input = document.getElementById("superAIInput");
    const message = String(input?.value || "").trim();
    if (!message || this.isTyping) return;

    this.addMessage(message, "user");
    if (input) {
      input.value = "";
      this.handleInput({ target: input });
    }

    this.showTypingIndicator();
    try {
      const data = await window.SolitaireAIClient.sendMessage({
        message,
        context: {
          page: "/coupon.html",
          assistant: "coupon-super-ai",
          expertise: this.expertise,
          couponParams: window.SolitaireAIClient.collectCouponParams(),
        },
        history: this.conversations.slice(-8).map((item) => ({
          role: item.sender === "user" ? "user" : "assistant",
          text: typeof item.content === "string" ? item.content : "",
        })),
      });

      this.addMessage(data.answer || "Aucune reponse.", "super-ai");
      const preview = this.parseCouponIntent(message, data.answer || "");
      if (preview) {
        this.showCouponPreview(preview);
      }
      if (Array.isArray(data.actions) && data.actions.length) {
        await window.SolitaireAIClient.applyActions(data.actions);
      }
    } catch (error) {
      this.addMessage(
        "L'assistant coupon est temporairement indisponible. Reessaie dans quelques secondes.",
        "super-ai",
        "error"
      );
    } finally {
      this.hideTypingIndicator();
    }
  }

  parseCouponIntent(userMessage, answer) {
    const text = `${userMessage} ${answer}`.toLowerCase();
    const params = window.SolitaireAIClient.collectCouponParams();
    const preview = {
      type: text.includes("ladder") ? "ladder" : text.includes("multi") ? "multi" : "standard",
      size: params.size || 3,
      risk: params.risk || "balanced",
      stake: params.stake || 1000,
      confidence: 0,
      expectedValue: 0,
    };

    const sizeMatch = text.match(/(\d+)\s*match/);
    if (sizeMatch) {
      preview.size = Math.max(1, Math.min(12, Number(sizeMatch[1]) || preview.size));
    }
    if (text.includes("safe")) preview.risk = "safe";
    if (text.includes("ultra")) preview.risk = "ultra_safe";
    if (text.includes("agressif") || text.includes("aggressive")) preview.risk = "aggressive";
    if (text.includes("equilibre") || text.includes("balance")) preview.risk = "balanced";

    const confidenceMatch = answer.match(/(\d{2,3})\s*%/);
    if (confidenceMatch) {
      preview.confidence = Math.max(0, Math.min(100, Number(confidenceMatch[1]) || 0));
      preview.expectedValue = Math.max(35, Math.min(95, preview.confidence - 8));
    }

    const couponIntent =
      text.includes("coupon") ||
      text.includes("ticket") ||
      text.includes("ladder") ||
      text.includes("multi-strateg") ||
      text.includes("multi strategie");

    return couponIntent ? preview : null;
  }

  showCouponPreview(couponData) {
    const preview = document.getElementById("superAICouponPreview");
    const content = document.getElementById("couponPreviewContent");
    if (!preview || !content) return;

    const riskLabel = {
      ultra_safe: "Ultra-safe",
      safe: "Safe",
      balanced: "Equilibre",
      aggressive: "Agressif",
    }[couponData.risk] || "Equilibre";

    const typeLabel = {
      standard: "Coupon standard",
      ladder: "Ladder IA",
      multi: "Multi-strategie",
    }[couponData.type] || "Coupon standard";

    content.innerHTML = `
      <div class="coupon-summary">
        <div class="coupon-type">${typeLabel}</div>
        <div class="coupon-params">
          <span class="param">${couponData.size} matchs</span>
          <span class="param">${riskLabel}</span>
          <span class="param">${couponData.stake} mise</span>
        </div>
        <div class="coupon-metrics">
          <div class="metric">
            <span class="metric-label">Confiance</span>
            <span class="metric-value">${couponData.confidence || "--"}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Valeur</span>
            <span class="metric-value">${couponData.expectedValue || "--"}%</span>
          </div>
        </div>
      </div>
    `;

    preview.style.display = "block";
    this.currentCouponData = couponData;
  }

  applyGeneratedCoupon() {
    if (!this.currentCouponData || !window.SiteControl?.execute) return;
    window.SiteControl.execute("set_coupon_form", {
      size: this.currentCouponData.size,
      risk: this.currentCouponData.risk,
      league: window.SolitaireAIClient.collectCouponParams().league,
    });
    const stakeInput = document.getElementById("stakeInput");
    if (stakeInput) stakeInput.value = String(this.currentCouponData.stake || 1000);
    window.SiteControl.execute("generate_coupon");
    this.showNotification("Configuration appliquee au coupon.");
  }

  refineCouponStrategy() {
    const input = document.getElementById("superAIInput");
    if (!input || !this.currentCouponData) return;
    input.value = `Affinons ce coupon ${this.currentCouponData.type} de ${this.currentCouponData.size} matchs pour gagner en securite et clarte.`;
    this.handleInput({ target: input });
    this.sendMessage();
  }

  addMessage(content, sender, type = "normal", store = true) {
    const container = document.getElementById("superAIMessages");
    if (!container) return;

    const item = document.createElement("div");
    item.className = `message ${sender}-message ${type === "error" ? "error" : ""}`;
    const avatar = sender === "super-ai" ? "AI" : "ME";

    item.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        ${
          typeof content === "string"
            ? window.SolitaireAIClient.renderRichText(content)
            : content
        }
      </div>
      <div class="message-time">${this.getCurrentTime()}</div>
    `;

    container.appendChild(item);
    container.scrollTop = container.scrollHeight;

    if (store) {
      this.conversations.push({
        content,
        sender,
        type,
        timestamp: new Date().toISOString(),
      });
      this.saveConversationHistory();
    }
  }

  showTypingIndicator() {
    this.isTyping = true;
    document.getElementById("superAITypingStatus")?.classList.remove("hidden");
    const sendBtn = document.getElementById("sendSuperAIBtn");
    if (sendBtn) sendBtn.disabled = true;
  }

  hideTypingIndicator() {
    this.isTyping = false;
    document.getElementById("superAITypingStatus")?.classList.add("hidden");
    const sendBtn = document.getElementById("sendSuperAIBtn");
    if (sendBtn) sendBtn.disabled = false;
  }

  clearChat() {
    if (!window.confirm("Effacer la conversation de l'assistant coupon ?")) return;
    const container = document.getElementById("superAIMessages");
    if (container) container.innerHTML = "";
    this.conversations = [];
    this.saveConversationHistory();
    this.addMessage("Conversation effacee. Je peux repartir sur un nouveau ticket.", "super-ai");
  }

  exportChat() {
    if (!this.conversations.length) {
      window.alert("Aucune conversation a exporter.");
      return;
    }

    const blob = new Blob(
      [
        JSON.stringify(
          {
            expertise: this.expertise,
            date: new Date().toISOString(),
            conversations: this.conversations,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `coupon-ai-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  toggleExpertMode() {
    const button = document.getElementById("superAIExpertModeBtn");
    const active = button?.classList.toggle("active");
    this.expertise = active ? "SOLITAIRE_AI_COUPON_EXPERT" : "SOLITAIRE_AI_COUPON";
    this.showNotification(active ? "Mode expert active." : "Mode expert desactive.");
  }

  saveConversationHistory() {
    try {
      localStorage.setItem("super_ai_coupon_conversations", JSON.stringify(this.conversations.slice(-30)));
    } catch {
      // Ignore storage errors.
    }
  }

  loadConversationHistory() {
    try {
      const saved = localStorage.getItem("super_ai_coupon_conversations");
      this.conversations = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(this.conversations)) this.conversations = [];
    } catch {
      this.conversations = [];
    }
  }

  restoreConversationHistory() {
    if (!this.conversations.length) return;
    const container = document.getElementById("superAIMessages");
    if (!container) return;
    container.innerHTML = "";
    this.conversations.slice(-14).forEach((item) => {
      this.addMessage(item.content, item.sender, item.type || "normal", false);
    });
  }

  getCurrentTime() {
    return new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "super-ai-notification";
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add("show"), 10);
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, 2500);
  }
}

if (typeof window !== "undefined") {
  const boot = () => {
    window.superAICouponGenerator = new SuperAICouponGenerator();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = SuperAICouponGenerator;
}
