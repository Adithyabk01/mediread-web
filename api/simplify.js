export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method allowed" });
  }

  try {
    const { reportText } = req.body;

    if (!reportText || reportText.trim().length === 0) {
      return res.status(400).json({ error: "reportText is required" });
    }

    const HF_API_KEY = process.env.VITE_HF_API_KEY;

    if (!HF_API_KEY) {
      return res.status(500).json({ error: "Missing HuggingFace API Key" });
    }

    const prompt = `
You are a helpful assistant that explains medical reports for education only.
Do NOT diagnose. Do NOT prescribe medicines.

Explain the report in SIMPLE words.

Return output in this format:

1) SIMPLE EXPLANATION:
2) OVERALL SUMMARY:
3) PRECAUTIONS & LIFESTYLE:
4) WHEN TO CONSULT A DOCTOR:
End with: "This is not medical advice."

REPORT:
${reportText}
`;

    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/google/flan-t5-small",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          options: { wait_for_model: true },
        }),
      }
    );

    const data = await response.json();

    const generated =
      Array.isArray(data) && data[0]?.generated_text
        ? data[0].generated_text
        : JSON.stringify(data);

    return res.status(200).json({ output: generated });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
