import { useState } from "react";

export default function App() {
  const [reportText, setReportText] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function simplifyReport() {
    setError("");
    setOutput("");

    if (!reportText.trim()) {
      setError("Please paste or upload a report first.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/simplify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reportText }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();
      setOutput(data.output || "No output received.");
    } catch (e) {
      setError("Something went wrong: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setReportText(String(reader.result || ""));
    };
    reader.readAsText(file);
  }

  function copyOutput() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    alert("Copied!");
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>🩺 MEDIREAD Web</h1>
        <p style={styles.subtitle}>
          Upload or paste a medical report and get a simple explanation (Demo only).
        </p>

        <div style={styles.warning}>
          ⚠️ This tool is for educational/demo purposes only. It is NOT medical advice.
        </div>

        <div style={styles.card}>
          <h2 style={styles.heading}>📄 Upload / Paste Report</h2>

          <input type="file" accept=".txt" onChange={handleFileUpload} />

          <textarea
            style={styles.textarea}
            placeholder="Paste report text here..."
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
          />

          <button style={styles.button} onClick={simplifyReport} disabled={loading}>
            {loading ? "Simplifying..." : "🧠 Simplify Report"}
          </button>

          {error && <div style={styles.error}>{error}</div>}
        </div>

        <div style={styles.card}>
          <div style={styles.row}>
            <h2 style={styles.heading}>✅ Output</h2>
            <button style={styles.smallBtn} onClick={copyOutput} disabled={!output}>
              Copy
            </button>
          </div>

          {!output ? (
            <p style={{ opacity: 0.7 }}>Output will appear here...</p>
          ) : (
            <pre style={styles.output}>{output}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0b1220",
    color: "white",
    padding: "24px",
    fontFamily: "system-ui, Arial",
  },
  container: {
    maxWidth: "900px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  title: { margin: 0, fontSize: "32px" },
  subtitle: { marginTop: "6px", opacity: 0.8 },
  warning: {
    padding: "10px",
    borderRadius: "10px",
    background: "rgba(255, 200, 0, 0.15)",
    border: "1px solid rgba(255, 200, 0, 0.35)",
  },
  card: {
    padding: "16px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  heading: { margin: 0, fontSize: "18px" },
  textarea: {
    width: "100%",
    minHeight: "160px",
    marginTop: "10px",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
    resize: "vertical",
  },
  button: {
    marginTop: "10px",
    padding: "12px",
    borderRadius: "12px",
    border: "none",
    background: "white",
    color: "#0b1220",
    fontWeight: "700",
    cursor: "pointer",
  },
  error: {
    marginTop: "10px",
    padding: "10px",
    borderRadius: "12px",
    background: "rgba(255, 60, 60, 0.18)",
    border: "1px solid rgba(255, 60, 60, 0.3)",
    whiteSpace: "pre-wrap",
  },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  smallBtn: {
    padding: "8px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
  },
  output: {
    marginTop: "10px",
    whiteSpace: "pre-wrap",
    background: "rgba(0,0,0,0.25)",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.12)",
    lineHeight: 1.5,
  },
};
