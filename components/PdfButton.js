"use client";

import { generateDocumentPDF } from "@/lib/pdfGenerator";

export default function PdfButton({ documentData, client, settings }) {
  return (
    <button
      className="btn secondary"
      onClick={() => generateDocumentPDF({ documentData, client, settings })}
    >
      Download PDF
    </button>
  );
}