export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method allowed" });
  }

  try {
    res.setHeader("x-mediread-version", "gemma-2-2b-it-v2");

    let reportText = "";
    if (typeof req.body === "string") {
      try {
        const parsed = JSON.parse(req.body);
        reportText = parsed.reportText || "";
      } catch {
        reportText = req.body;
      }
    } else if (req.body && typeof req.body === "object") {
      reportText = req.body.reportText || "";
    }

    if (!reportText || !reportText.trim()) {
      return res.status(400).json({ error: "reportText is required" });
    }

    // Read Hugging Face API key strictly server-side
    const HF_API_KEY =
      process.env.HF_API_KEY ||
      process.env.HUGGINGFACE_API_KEY ||
      process.env.HUGGING_FACE_HUB_TOKEN;

    if (!HF_API_KEY) {
      return res.status(500).json({
        error:
          "Missing Hugging Face API Key. Please set HF_API_KEY in your environment variables.",
      });
    }

    const MODEL_ID = "google/gemma-2-2b-it";
    const TIMEOUT_MS = 8500;

    // Helper to extract detailed network errors from fetch exception cause
    function formatFetchError(e) {
      const cause = e.cause;
      if (cause) {
        const causeDetails = cause.code || cause.message || String(cause);
        return `${e.message || "Fetch failed"} (${causeDetails})`;
      }
      return e.message || String(e);
    }

    // 1. Primary Hugging Face Inference Router Chat Completions API (OpenAI compatible)
    const primaryController = new AbortController();
    const primaryTimeout = setTimeout(() => primaryController.abort(), TIMEOUT_MS);

    try {
      const chatResponse = await fetch(
        "https://router.huggingface.co/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL_ID,
            messages: [
              {
                role: "system",
                content:
                  "You are a medical report simplification assistant for educational purposes. Do NOT diagnose. Do NOT prescribe medicines.",
              },
              {
                role: "user",
                content: `Explain the following medical report clearly in plain language:

1) SIMPLE EXPLANATION:
2) OVERALL SUMMARY:
3) PRECAUTIONS & LIFESTYLE:
4) WHEN TO CONSULT A DOCTOR:
End with: "This is not medical advice."

REPORT:
${reportText}`,
              },
            ],
            max_tokens: 600,
            temperature: 0.3,
          }),
          signal: primaryController.signal,
        }
      );

      clearTimeout(primaryTimeout);
      const contentType = chatResponse.headers.get("content-type") || "";

      // Handle successful chat completion response
      if (chatResponse.ok && contentType.includes("application/json")) {
        const chatData = await chatResponse.json();
        const content = chatData.choices?.[0]?.message?.content;
        if (content && content.trim().length > 0) {
          return res.status(200).json({ output: content });
        }
      }

      // Preserve primary HTTP error response directly (e.g. 401, 403, 429, 500)
      if (!chatResponse.ok) {
        let errMessage = "";
        if (contentType.includes("application/json")) {
          const errData = await chatResponse.json();
          errMessage =
            errData.error?.message ||
            errData.error ||
            errData.message ||
            JSON.stringify(errData);
        } else {
          const text = await chatResponse.text();
          errMessage = text.length < 200 ? text : `HTTP ${chatResponse.status} ${chatResponse.statusText}`;
        }
        const httpStatusCode =
          chatResponse.status >= 400 && chatResponse.status < 600
            ? chatResponse.status
            : 502;

        return res.status(httpStatusCode).json({
          error: `Hugging Face API Error (${chatResponse.status}): ${errMessage}`,
        });
      }
    } catch (e) {
      clearTimeout(primaryTimeout);

      if (e.name === "AbortError") {
        return res.status(504).json({
          error: `Hugging Face Router API request timed out after ${TIMEOUT_MS}ms.`,
        });
      }

      // If primary endpoint failed due to low-level network exception, preserve exact details
      const primaryErrDetails = formatFetchError(e);

      // 2. Fallback Hugging Face Inference Router Endpoint for google/gemma-2-2b-it
      const fallbackUrl = `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`;
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackController.abort(), TIMEOUT_MS);

      try {
        const prompt = `You are a medical report simplification assistant for educational purposes.
Do NOT diagnose. Do NOT prescribe medicines.

Explain the following medical report clearly in plain language:

1) SIMPLE EXPLANATION:
2) OVERALL SUMMARY:
3) PRECAUTIONS & LIFESTYLE:
4) WHEN TO CONSULT A DOCTOR:
End with: "This is not medical advice."

REPORT:
${reportText}`;

        const fallbackResponse = await fetch(fallbackUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { max_new_tokens: 500 },
            options: { wait_for_model: true },
          }),
          signal: fallbackController.signal,
        });

        clearTimeout(fallbackTimeout);
        const fbContentType = fallbackResponse.headers.get("content-type") || "";

        if (fallbackResponse.ok) {
          let generated = "";
          if (fbContentType.includes("application/json")) {
            const data = await fallbackResponse.json();
            if (Array.isArray(data) && data[0]?.generated_text) {
              generated = data[0].generated_text;
            } else if (data && data.generated_text) {
              generated = data.generated_text;
            } else if (typeof data === "string") {
              generated = data;
            } else {
              generated = JSON.stringify(data, null, 2);
            }
          } else {
            generated = await fallbackResponse.text();
          }

          if (generated && generated.trim().length > 0) {
            return res.status(200).json({ output: generated });
          }
        }

        let fbErrMessage = "";
        if (fbContentType.includes("application/json")) {
          const errData = await fallbackResponse.json();
          fbErrMessage = errData.error?.message || errData.error || JSON.stringify(errData);
        } else {
          const text = await fallbackResponse.text();
          fbErrMessage = text.length < 200 ? text : `HTTP ${fallbackResponse.status}`;
        }

        return res.status(502).json({
          error: `Inference API call failed (${fallbackResponse.status}): ${fbErrMessage}`,
        });
      } catch (fbErr) {
        clearTimeout(fallbackTimeout);
        const fbErrDetails =
          fbErr.name === "AbortError" ? "Request timed out" : formatFetchError(fbErr);
        return res.status(502).json({
          error: `Inference API network error: Primary (${primaryErrDetails}) | Fallback (${fbErrDetails})`,
        });
      }
    }
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
