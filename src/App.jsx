import { useState } from "react";

const SAMPLE_REPORT = `PATIENT MEDICAL REPORT
Patient Name: John Doe (Age: 45, Male)
Date: October 14, 2025
Lab / Test: Complete Blood Count (CBC) & Metabolic Panel

RESULTS:
- Hemoglobin: 14.2 g/dL (Reference: 13.8 - 17.2 g/dL) [NORMAL]
- Total Cholesterol: 242 mg/dL (Reference: < 200 mg/dL) [HIGH]
- Triglycerides: 215 mg/dL (Reference: < 150 mg/dL) [ELEVATED]
- Fasting Blood Sugar: 116 mg/dL (Reference: 70 - 99 mg/dL) [ELEVATED - Pre-diabetic range]
- Serum Creatinine: 0.9 mg/dL (Reference: 0.7 - 1.3 mg/dL) [NORMAL]

PHYSICIAN IMPRESSION:
Patient presents with mild hyperlipidemia and elevated fasting blood glucose. No acute renal or hematologic impairment detected.

RECOMMENDATIONS:
Dietary modification (low saturated fats and reduced refined sugars), 30 minutes of daily aerobic exercise, and routine follow-up in 8 weeks.`;

export default function App() {
  const [reportText, setReportText] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedFileName, setLoadedFileName] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  async function simplifyReport() {
    setError("");
    setOutput("");

    if (!reportText.trim()) {
      setError("Please paste or upload a medical report first.");
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

      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        let errorMsg = `Server returned status ${res.status}`;
        if (contentType.includes("application/json")) {
          const errData = await res.json();
          errorMsg = errData.error || errData.message || JSON.stringify(errData);
        } else {
          const text = await res.text();
          errorMsg = text.length < 300 ? text : `Server error (${res.status})`;
        }
        throw new Error(errorMsg);
      }

      if (contentType.includes("application/json")) {
        const data = await res.json();
        setOutput(data.output || "No output received.");
      } else {
        const text = await res.text();
        setOutput(text);
      }
    } catch (e) {
      setError("Unable to simplify report: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadedFileName(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    const reader = new FileReader();
    reader.onload = () => {
      setReportText(String(reader.result || ""));
    };
    reader.onerror = () => {
      setError("Error reading the selected file.");
    };
    reader.readAsText(file);
  }

  function loadSample() {
    setReportText(SAMPLE_REPORT);
    setLoadedFileName("Sample Report Loaded");
    setError("");
  }

  function clearAll() {
    setReportText("");
    setOutput("");
    setError("");
    setLoadedFileName("");
    setCopySuccess(false);
  }

  function copyOutput() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>🩺 MEDIREAD Web</h1>
          <p style={styles.subtitle}>
            Upload or paste a medical report to get a simplified, easy-to-understand explanation.
          </p>
        </header>

        <div style={styles.warning}>
          ⚠️ <strong>Medical Disclaimer:</strong> This tool is for educational and demo purposes only. It is <strong>NOT</strong> medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional.
        </div>

        <div style={styles.card}>
          <div style={styles.row}>
            <h2 style={styles.heading}>📄 Upload / Paste Report</h2>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={styles.secondaryBtn} onClick={loadSample}>
                📋 Load Sample
              </button>
              {reportText && (
                <button style={styles.clearBtn} onClick={clearAll}>
                  🗑️ Clear
                </button>
              )}
            </div>
          </div>

          <div style={styles.fileBox}>
            <label style={styles.fileLabel}>
              📂 Choose File (.txt, .md, .csv, .json, .log)
              <input
                type="file"
                accept=".txt,.md,.csv,.json,.log,.xml"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
            {loadedFileName && <span style={styles.fileName}>{loadedFileName}</span>}
          </div>

          <textarea
            style={styles.textarea}
            placeholder="Paste medical report text here (e.g. blood tests, lab results, clinical summaries)..."
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
          />

          <button
            style={{
              ...styles.primaryButton,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
            onClick={simplifyReport}
            disabled={loading}
          >
            {loading ? "🧠 Simplifying Report..." : "🧠 Simplify Report"}
          </button>

          {error && <div style={styles.error}>{error}</div>}
        </div>

        <div style={styles.card}>
          <div style={styles.row}>
            <h2 style={styles.heading}>✅ Simplified Explanation</h2>
            {output && (
              <button style={styles.smallBtn} onClick={copyOutput}>
                {copySuccess ? "✓ Copied!" : "📋 Copy"}
              </button>
            )}
          </div>

          {!output ? (
            <p style={{ opacity: 0.6, fontStyle: "italic", marginTop: "12px" }}>
              Simplified report results will appear here after clicking &quot;Simplify Report&quot;...
            </p>
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
    color: "#f0f6fc",
    padding: "24px 16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: "850px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  header: {
    textAlign: "center",
    paddingBottom: "8px",
  },
  title: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 800,
    color: "#ffffff",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    marginTop: "8px",
    opacity: 0.85,
    fontSize: "16px",
    lineHeight: "1.4",
  },
  warning: {
    padding: "14px 18px",
    borderRadius: "12px",
    background: "rgba(245, 158, 11, 0.12)",
    border: "1px solid rgba(245, 158, 11, 0.35)",
    color: "#fbbf24",
    fontSize: "14px",
    lineHeight: "1.5",
  },
  card: {
    padding: "20px",
    borderRadius: "16px",
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    backdropFilter: "blur(10px)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  heading: { margin: 0, fontSize: "18px", fontWeight: 700 },
  fileBox: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "4px",
  },
  fileLabel: {
    display: "inline-block",
    padding: "8px 14px",
    borderRadius: "10px",
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  fileName: {
    fontSize: "13px",
    color: "#38bdf8",
    fontWeight: 500,
  },
  textarea: {
    width: "100%",
    minHeight: "160px",
    boxSizing: "border-box",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.18)",
    background: "rgba(0, 0, 0, 0.25)",
    color: "#ffffff",
    fontSize: "15px",
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical",
    lineHeight: "1.5",
  },
  primaryButton: {
    padding: "14px 20px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "16px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
    transition: "all 0.2s ease",
  },
  secondaryBtn: {
    padding: "6px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(56, 189, 248, 0.4)",
    background: "rgba(56, 189, 248, 0.12)",
    color: "#38bdf8",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  clearBtn: {
    padding: "6px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    background: "rgba(239, 68, 68, 0.12)",
    color: "#f87171",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    padding: "12px 16px",
    borderRadius: "10px",
    background: "rgba(239, 68, 68, 0.15)",
    border: "1px solid rgba(239, 68, 68, 0.35)",
    color: "#fca5a5",
    fontSize: "14px",
    whiteSpace: "pre-wrap",
  },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  smallBtn: {
    padding: "6px 14px",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.25)",
    background: "rgba(255, 255, 255, 0.1)",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  output: {
    marginTop: "8px",
    whiteSpace: "pre-wrap",
    background: "rgba(0, 0, 0, 0.35)",
    padding: "16px",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    fontSize: "15px",
    lineHeight: "1.6",
    color: "#e2e8f0",
    margin: 0,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
};
