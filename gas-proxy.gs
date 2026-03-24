const GEMINI_API_KEY_PROPERTY = "GEMINI_API_KEY";
const DEFAULT_MODEL = "gemini-2.5-flash";

function doGet(e) {
  const callback = e.parameter.callback || "callback";
  const model = e.parameter.model || DEFAULT_MODEL;
  const prompt = e.parameter.prompt || "";
  const historyJson = e.parameter.history || "[]";

  try {
    const history = JSON.parse(historyJson);
    const text = generateGeminiText_(model, prompt, history);
    return jsonp_({ ok: true, text: text }, callback);
  } catch (error) {
    return jsonp_(
      {
        ok: false,
        error: error && error.message ? error.message : String(error),
      },
      callback,
    );
  }
}

function generateGeminiText_(model, prompt, history) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(GEMINI_API_KEY_PROPERTY);
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY script property.");
  }

  const contents = Array.isArray(history)
    ? history.map(function (message) {
        return {
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: String(message.text || "") }],
        };
      })
    : [];

  contents.push({
    role: "user",
    parts: [{ text: String(prompt || "") }],
  });

  const response = UrlFetchApp.fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent",
    {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-goog-api-key": apiKey,
      },
      payload: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "You are a friendly assistant. Reply concisely and clearly.",
            },
          ],
        },
        contents: contents,
      }),
      muteHttpExceptions: true,
    },
  );

  const status = response.getResponseCode();
  const body = response.getContentText();
  const payload = body ? JSON.parse(body) : {};

  if (status < 200 || status >= 300) {
    const message = payload && payload.error && payload.error.message
      ? payload.error.message
      : "Gemini API error (" + status + ")";
    throw new Error(message);
  }

  const parts =
    payload &&
    payload.candidates &&
    payload.candidates[0] &&
    payload.candidates[0].content &&
    payload.candidates[0].content.parts
      ? payload.candidates[0].content.parts
      : [];

  const text = parts
    .map(function (part) {
      return part.text || "";
    })
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

function jsonp_(payload, callback) {
  const body = callback + "(" + JSON.stringify(payload) + ");";
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
