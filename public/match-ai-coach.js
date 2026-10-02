class AICoachConversational {
  constructor() {
    this.conversations = [];
    this.currentMatchId = "";
    this.isTyping = false;
    this.suggestions = [
      "Analyse ce match et dis-moi le meilleur angle",
      "Explique-moi ce pari comme a un debutant",
      "Compare ce match avec mon coupon",
      "Fais une recherche rapide sur ce sujet",
      "Reponds a une question hors football",
    ];

    this.init();
  }

  init() {
    this.setupCoachInterface();
    this.loadConversationHistory();
    this.restoreConversationHistory();
    this.setupEventListeners();
  }

  setupCoachInterface() {
    const coachPanel = document.getElementById("coachPanel");
    if (!coachPanel) return;

    const conversationalInterface = document.createElement("div");
    conversationalInterface.className = "ai-coach-conversational";
    conversationalInterface.innerHTML = `
      <div class="coach-header">
        <div class="coach-avatar">
          <div class="avatar-icon">AI</div>
          <div class="avatar-status online"></div>
        </div>
        <div class="coach-info">
          <h3>IA Coach Unifiee</h3>
          <span class="coach-status">Meme API que la page coupon</span>
        </div>
        <div class="coach-actions">
          <button class="action-btn" id="clearChatBtn" title="Effacer la conversation">
            <span>CLR</span>
          </button>
          <button class="action-btn" id="exportChatBtn" title="Exporter la conversation">
            <span>EXP</span>
          </button>
        </div>
      </div>

      <div class="coach-messages" id="coachMessages">
        <div class="message ai-message">
          <div class="message-avatar">AI</div>
          <div class="message-content">
            <p>Je reponds aux questions sur ce match, ton coupon, la strategie et aussi aux questions generales.</p>
            <ul>
              <li>analyse match, cotes, risque et confiance</li>
              <li>actions directes sur la page details</li>
              <li>recherche contextuelle quand c'est utile</li>
              <li>meme intelligence que l'assistant coupon</li>
            </ul>
            <p>Tu peux donc parler match ou sortir du contexte si tu veux.</p>
          </div>
          <div class="message-time">${this.getCurrentTime()}</div>
        </div>
      </div>

      <div class="coach-suggestions" id="coachSuggestions">
        <div class="suggestions-header">Questions rapides</div>
        <div class="suggestions-grid">
          ${this.suggestions
            .map(
              (suggestion) => `
            <button class="suggestion-btn" data-suggestion="${suggestion}">
              ${suggestion}
            </button>
          `
            )
            .join("")}
        </div>
      </div>

      <div class="coach-input">
        <div class="input-container">
          <textarea
            id="coachInput"
            placeholder="Pose une question sur le match, le coupon ou un autre sujet..."
            rows="1"
            maxlength="500"
          ></textarea>
          <button class="send-btn" id="sendCoachBtn" type="button">
            <span>GO</span>
          </button>
        </div>
        <div class="input-status">
          <span id="charCount">0/500</span>
          <span id="typingStatus" class="hidden">L'IA reflechit...</span>
        </div>
      </div>
    `;

    const existingContent = coachPanel.querySelector("#coachContent");
    if (existingContent) {
      existingContent.replaceWith(conversationalInterface);
    }
  }

  setupEventListeners() {
    const input = document.getElementById("coachInput");
    const sendBtn = document.getElementById("sendCoachBtn");
    const clearBtn = document.getElementById("clearChatBtn");
    const exportBtn = document.getElementById("exportChatBtn");

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

    document.querySelectorAll(".suggestion-btn").forEach((button) => {
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
    const charCount = document.getElementById("charCount");

    if (charCount) {
      charCount.textContent = `${input.value.length}/500`;
    }

    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;

    const suggestions = document.getElementById("coachSuggestions");
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
    const input = document.getElementById("coachInput");
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
          page: "/match.html",
          matchId: this.currentMatchId || this.getMatchId(),
          assistant: "match-ai-coach",
          focus: "match-details-open",
        },
        history: this.conversations.slice(-8).map((item) => ({
          role: item.sender === "user" ? "user" : "assistant",
          text: typeof item.content === "string" ? item.content : "",
        })),
      });

      this.addMessage(data.answer || "Aucune reponse.", "ai");
      if (Array.isArray(data.actions) && data.actions.length) {
        await window.SolitaireAIClient.applyActions(data.actions);
      }
    } catch (error) {
      this.addMessage(
        "Le coach IA est temporairement indisponible. Repose la question dans quelques secondes.",
        "ai",
        "error"
      );
    } finally {
      this.hideTypingIndicator();
    }
  }

  addMessage(content, sender, type = "normal", store = true) {
    const messagesContainer = document.getElementById("coachMessages");
    if (!messagesContainer) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message ${type === "error" ? "error" : ""}`;
    const avatar = sender === "ai" ? "AI" : "ME";

    messageDiv.innerHTML = `
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

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

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
    const typingStatus = document.getElementById("typingStatus");
    const sendBtn = document.getElementById("sendCoachBtn");
    if (typingStatus) typingStatus.classList.remove("hidden");
    if (sendBtn) sendBtn.disabled = true;
  }

  hideTypingIndicator() {
    this.isTyping = false;
    const typingStatus = document.getElementById("typingStatus");
    const sendBtn = document.getElementById("sendCoachBtn");
    if (typingStatus) typingStatus.classList.add("hidden");
    if (sendBtn) sendBtn.disabled = false;
  }

  clearChat() {
    if (!window.confirm("Effacer la conversation du coach IA ?")) return;
    const messagesContainer = document.getElementById("coachMessages");
    if (messagesContainer) {
      messagesContainer.innerHTML = "";
    }
    this.conversations = [];
    this.saveConversationHistory();
    this.addMessage(
      "Conversation effacee. Tu peux relancer une question match, coupon ou generale.",
      "ai"
    );
  }

  exportChat() {
    if (!this.conversations.length) {
      window.alert("Aucune conversation a exporter.");
      return;
    }

    const exportData = {
      date: new Date().toISOString(),
      matchId: this.currentMatchId || this.getMatchId(),
      conversations: this.conversations,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-coach-conversation-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  saveConversationHistory() {
    try {
      localStorage.setItem("ai_coach_conversations", JSON.stringify(this.conversations.slice(-30)));
    } catch {
      // Storage can fail on some devices.
    }
  }

  loadConversationHistory() {
    try {
      const saved = localStorage.getItem("ai_coach_conversations");
      this.conversations = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(this.conversations)) {
        this.conversations = [];
      }
    } catch {
      this.conversations = [];
    }
  }

  restoreConversationHistory() {
    if (!this.conversations.length) return;
    const messagesContainer = document.getElementById("coachMessages");
    if (!messagesContainer) return;
    messagesContainer.innerHTML = "";
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

  getMatchId() {
    return new URLSearchParams(window.location.search).get("id") || "";
  }

  updateMatchContext(matchData) {
    this.currentMatchId = String(matchData?.id || "");
  }
}

if (typeof window !== "undefined") {
  const boot = () => {
    window.aiCoach = new AICoachConversational();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = AICoachConversational;
}
