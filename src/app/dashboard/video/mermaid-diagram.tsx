"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

let mermaidInitialized = false;

// Aggressive sanitizer for AI-generated Mermaid
function sanitizeMermaid(raw: string): string {
  if (!raw) return "";

  let s = raw;

  // 1. Convert escaped newlines to actual newlines
  s = s.replace(/\\n/g, "\n");

  // 2. Remove markdown code fences
  s = s.replace(/```mermaid/g, "").replace(/```/g, "");

  // 3. Trim each line
  s = s
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  // 4. Remove lines that are ONLY dashes or dots (invalid separators)
  s = s.replace(/^[-.]+$/gm, "");

  // 5. Ensure it starts with graph/flowchart
  if (!/^(graph|flowchart)/im.test(s)) {
    // If it has arrows, prepend a graph directive
    if (s.includes("-->")) {
      s = `graph TD\n${s}`;
    } else {
      // No arrows — return an empty-safe diagram
      return `graph TD\n  A[Concept] --> B[Details]\n  B --> C[Summary]`;
    }
  }

  // 6. Fix node labels — remove colons, quotes, parens INSIDE brackets
  // Pattern: X[anything] → X[cleaned]
  s = s.replace(/\[([^\]]*?)\]/g, (_match, label) => {
    const cleaned = label
      .replace(/[:"'(){}]/g, " ") // replace breaking chars with space
      .replace(/\s+/g, " ")        // collapse spaces
      .trim();
    return `[${cleaned}]`;
  });

  // 7. Fix diamond labels {text}
  s = s.replace(/\{([^}]*?)\}/g, (_match, label) => {
    const cleaned = label
      .replace(/[:"'()[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return `{${cleaned}}`;
  });

  // 8. Fix rounded labels (text)
  s = s.replace(/\(([^)]*?)\)/g, (match, label) => {
    // Only fix if it's clearly a node label (has letters)
    if (/^[A-Za-z]/.test(label.trim())) {
      const cleaned = label
        .replace(/[:"'[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return `(${cleaned})`;
    }
    return match;
  });

  // 9. Fix arrow syntax variants
  s = s.replace(/--+>/g, "-->");
  s = s.replace(/-->+\|/g, "-->|");
  s = s.replace(/--+>/g, "-->");

  // 10. Ensure each line ends properly
  s = s.trim();

  return s;
}

export default function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current) return;

      const cleaned = sanitizeMermaid(code);
      console.log("🔷 Mermaid input:", cleaned.slice(0, 150));

      if (!cleaned) {
        setError("Empty diagram");
        setLoading(false);
        return;
      }

      try {
        const mermaid = (await import("mermaid")).default;

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            securityLevel: "loose",
            suppressErrorRendering: true,
            themeVariables: {
              background: "transparent",
              primaryColor: "#a855f7",
              primaryTextColor: "#ffffff",
              primaryBorderColor: "#a855f7",
              lineColor: "#22d3ee",
              secondaryColor: "#22d3ee",
              tertiaryColor: "#f472b6",
              fontSize: "14px",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
            },
          });
          mermaidInitialized = true;
        }

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, cleaned);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message.slice(0, 120) : "Render failed";
          console.log("🔴 Mermaid error:", msg);
          setError(msg);
          setLoading(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="w-6 h-6 text-gray-500 mb-2" />
        <p className="text-xs text-gray-400">Diagram skipped</p>
        <p className="text-[10px] text-gray-600 mt-1 max-w-md truncate">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full flex justify-center">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-purple-300 animate-spin" />
        </div>
      )}
      <div
        ref={containerRef}
        className="mermaid-container flex justify-center"
        style={{ maxWidth: "100%", overflow: "auto" }}
      />
      <style jsx global>{`
        .mermaid-container svg {
          max-width: 100%;
          height: auto;
          max-height: 320px;
        }
      `}</style>
    </div>
  );
}