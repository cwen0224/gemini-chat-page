const apiKeyInput = document.getElementById("apiKey");
const proxyUrlInput = document.getElementById("proxyUrl");
const modelSelect = document.getElementById("model");
const promptInput = document.getElementById("prompt");
const chat = document.getElementById("chat");
const composer = document.getElementById("composer");
const clearChatButton = document.getElementById("clearChat");
const toggleKeyButton = document.getElementById("toggleKey");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const sendButton = document.getElementById("sendBtn");

const STORAGE_KEY = "gemini-chat-state";

const state = {
  messages: [],
  apiKey: "",
  proxyUrl: "",
  model: "gemini-2.5-flash",
  revealKey: false,
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.apiKey = saved.apiKey || "";
    state.proxyUrl = saved.proxyUrl || "";
    state.model = saved.model || state.model;
    state.messages = Array.isArray(saved.messages) ? saved.messages : [];
    state.revealKey = Boolean(saved.revealKey);
  } catch {
    state.messages = [];
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      apiKey: state.apiKey,
      proxyUrl: state.proxyUrl,
      model: state.model,
      messages: state.messages,
      revealKey: state.revealKey,
    }),
  );
}

function setStatus(kind, text) {
  statusDot.classList.remove("ready", "error");
  if (kind) {
    statusDot.classList.add(kind);
  }
  statusText.textContent = text;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = escapeHtml(text);

  article.appendChild(bubble);
  chat.appendChild(article);
  chat.scrollTop = chat.scrollHeight;
  return bubble;
}

function renderAllMessages() {
  chat.innerHTML = "";

  if (state.messages.length === 0) {
    renderMessage("assistant", "Enter an API key, then start chatting.");
    return;
  }

  for (const message of state.messages) {
    renderMessage(message.role, message.text);
  }
}

function syncControls() {
  apiKeyInput.value = state.apiKey;
  proxyUrlInput.value = state.proxyUrl;
  modelSelect.value = state.model;
  apiKeyInput.type = state.revealKey ? "text" : "password";
  toggleKeyButton.textContent = state.revealKey ? "Hide" : "Show";
}

function pushMessage(role, text) {
  state.messages.push({ role, text });
  saveState();
  renderMessage(role, text);
}

function toGeminiRole(role) {
  return role === "assistant" ? "model" : "user";
}

async function callGemini(prompt, history) {
  const contents = history.map((message) => ({
    role: toGeminiRole(message.role),
    parts: [{ text: message.text }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${state.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": state.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "You are a friendly assistant. Reply concisely and clearly.",
            },
          ],
        },
        contents,
      }),
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || `Gemini API error (${response.status})`;
    throw new Error(message);
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

function buildProxyUrl(proxyUrl, params) {
  const url = new URL(proxyUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

function callGasProxy(prompt, history) {
  return new Promise((resolve, reject) => {
    const callbackName = `geminiProxy_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => cleanup(new Error("Proxy request timed out.")), 30000);
    const payloadHistory = history.slice(-12);

    function cleanup(error) {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      if (error) {
        reject(error);
      }
    }

    window[callbackName] = (response) => {
      cleanup();
      if (!response || response.ok !== true) {
        reject(new Error(response?.error || "Proxy request failed."));
        return;
      }
      resolve(response.text);
    };

    script.onerror = () => cleanup(new Error("Could not reach the GAS proxy."));

    try {
      script.src = buildProxyUrl(state.proxyUrl, {
        callback: callbackName,
        model: state.model,
        prompt,
        history: JSON.stringify(payloadHistory),
      });
      document.body.appendChild(script);
    } catch (error) {
      cleanup(error);
    }
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  const prompt = promptInput.value.trim();
  if (!prompt) {
    return;
  }

  state.apiKey = apiKeyInput.value.trim();
  state.proxyUrl = proxyUrlInput.value.trim();
  state.model = modelSelect.value;
  const history = state.messages.slice();

  if (!state.proxyUrl && !state.apiKey) {
    setStatus("error", "Please enter an API key");
    return;
  }

  saveState();

  pushMessage("user", prompt);
  promptInput.value = "";

  setStatus("ready", state.proxyUrl ? "Sending via GAS..." : "Sending...");
  sendButton.disabled = true;

  const assistantBubble = renderMessage("assistant", "Thinking...");

  try {
    const assistantText = state.proxyUrl
      ? await callGasProxy(prompt, history)
      : await callGemini(prompt, history);
    assistantBubble.textContent = assistantText;
    state.messages.push({ role: "assistant", text: assistantText });
    saveState();
    setStatus("ready", "Connected");
  } catch (error) {
    assistantBubble.textContent = `Error: ${error.message}`;
    setStatus("error", "Request failed");
  } finally {
    sendButton.disabled = false;
    chat.scrollTop = chat.scrollHeight;
  }
}

function clearChat() {
  state.messages = [];
  saveState();
  renderAllMessages();
  setStatus("", state.apiKey ? "Ready" : "Not connected");
}

function toggleApiKeyVisibility() {
  state.revealKey = !state.revealKey;
  apiKeyInput.type = state.revealKey ? "text" : "password";
  toggleKeyButton.textContent = state.revealKey ? "Hide" : "Show";
  saveState();
}

apiKeyInput.addEventListener("input", () => {
  state.apiKey = apiKeyInput.value.trim();
  saveState();
});

proxyUrlInput.addEventListener("input", () => {
  state.proxyUrl = proxyUrlInput.value.trim();
  saveState();
});

modelSelect.addEventListener("change", () => {
  state.model = modelSelect.value;
  saveState();
});

toggleKeyButton.addEventListener("click", toggleApiKeyVisibility);
clearChatButton.addEventListener("click", clearChat);
composer.addEventListener("submit", handleSubmit);

promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

loadState();
syncControls();
renderAllMessages();
setStatus(state.apiKey ? "ready" : "", state.apiKey ? "Ready" : "Not connected");
