// Service for direct integration with the external Lovable chatbot backend.
// Strictly frontend-only: Calls the deployed Lovable API directly without
// intermediate proxies, mock backends, or server-side routes.

export const CHAT_API_URL = "https://chat-launchpad-link.lovable.app/api/public/chat";

/**
 * Normalises different possible answer field names from the Lovable API
 * so the UI always receives a consistent { answer, sources, found_in_notes } shape.
 *
 * Known possible keys: answer | response | message | text | content
 */
function normaliseResponse(data) {
  // Pick the first key that contains a non-empty string
  const answerText =
    data.answer ||
    data.response ||
    data.message ||
    data.text ||
    data.content ||
    null;

  // Sources may come as an array directly or nested under different keys
  const sources =
    Array.isArray(data.sources)
      ? data.sources
      : Array.isArray(data.citations)
      ? data.citations
      : Array.isArray(data.references)
      ? data.references
      : [];

  return {
    success: data.success !== false,            // treat missing as true
    answer: answerText,
    sources,
    found_in_notes: data.found_in_notes ?? data.foundInNotes ?? null,
    raw: data,                                  // keep the full response for debugging
  };
}

/**
 * Sends a chat message to the Lovable chatbot backend.
 *
 * @param {string} userMessage - The question or prompt from the user.
 * @returns {Promise<{success: boolean, answer: string|null, found_in_notes?: boolean, sources?: Array}>}
 */
export async function sendChatMessage(userMessage) {
  if (!userMessage || !userMessage.trim()) {
    throw new Error("Message cannot be empty");
  }

  try {
    const response = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userMessage.trim(),
      }),
    });

    if (!response.ok) {
      // Try to extract a meaningful error description from the body
      let errorDetail = `Request failed: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson && errorJson.error) {
          errorDetail = `${response.status}: ${errorJson.error}`;
        } else if (errorJson && errorJson.message) {
          errorDetail = `${response.status}: ${errorJson.message}`;
        }
      } catch (_) {
        // Body was not JSON — keep the status-based message
      }

      const error = new Error(errorDetail);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    return normaliseResponse(data);
  } catch (err) {
    // Re-throw already-enriched errors (status errors from above)
    if (err.status) throw err;

    // Detect network / CORS failures that manifest as TypeError "Failed to fetch"
    if (err instanceof TypeError && err.message.toLowerCase().includes("failed to fetch")) {
      const corsError = new Error(
        "Network or CORS connection failure. The Lovable backend at " +
        CHAT_API_URL +
        " must allow CORS requests from this origin. Check the backend's Access-Control-Allow-Origin header."
      );
      corsError.isCors = true;
      throw corsError;
    }

    throw err;
  }
}
