export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method allowed" });
  }

  try {
    res.setHeader("x-mediread-version", "router-v2");

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
      process.env.HUGGING_FACE_HUB_TOKEN ||
      process.env.VITE_HF_API_KEY;

    if (!HF_API_KEY) {
      return res.status(500).json({
        error:
          "Missing Hugging Face API Key. Please set HF_API_KEY in your environment variables.",
      });
    }

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

    // Priority ordered endpoints to query Hugging Face Inference API
    const endpoints = [
      "https://router.huggingface.co/hf-inference/models/google/flan-t5-base",
      "https://api-inference.huggingface.co/models/google/flan-t5-base",
      "https://router.huggingface.co/hf-inference/models/google/flan-t5-small",
    ];

    let lastError = "";
    let generated = "";

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
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
        });

        const contentType = response.headers.get("content-type") || "";

        if (!response.ok) {
          if (contentType.includes("application/json")) {
            const errData = await response.json();
            lastError = errData.error || errData.message || JSON.stringify(errData);
          } else {
            const text = await response.text();
            lastError = `HTTP ${response.status}: ${text.slice(0, 150)}`;
          }
          continue;
        }

        if (contentType.includes("application/json")) {
          const data = await response.json();
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
          generated = await response.text();
        }

        if (generated && generated.trim().length > 0) {
          break;
        }
      } catch (e) {
        lastError = e.message || String(e);
      }
    }

    if (!generated || generated.trim().length === 0) {
      return res.status(502).json({
        error: `Inference API call failed: ${lastError || "Could not fetch model response."}`,
      });
    }

    return res.status(200).json({ output: generated });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
