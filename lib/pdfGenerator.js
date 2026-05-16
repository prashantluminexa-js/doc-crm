import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatINR } from "./utils";

function money(value) {
  return `Rs. ${formatINR(value || 0)}`;
}

function getDocLabel(type) {
  if (type === "Quotation") return "Quote";
  if (type === "Proforma Invoice") return "Proforma Invoice";
  return "Invoice";
}

async function loadImage(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getQuotationTerms() {
  return `1. This quotation is valid for a period of 30 days from the date of issue. Prices and terms are subject to change after this period.
2. Advance Payment: 40% upfront payment is required to initiate the Project.
3. Final Payment: The remaining 60% of the payment will be due upon completion and approval of the final deliverables, after which the remaining payment will be released.
4. Confidentiality: Both parties must keep project details confidential.
5. Any additional work outside the defined scope will be charged separately.
6. The project will be executed based on the agreed scope.`;
}

function getInvoiceTerms() {
  return `1. A 40% advance payment inclusive of applicable GST is required to initiate the project.
2. The remaining 60% of the total amount must be paid upon project completion or before final delivery.
3. Any additional work or changes beyond the agreed scope will be charged separately.
4. Payment due within 4-7 days from the date of invoice.

Bank Details:
Luminexa Technologies Private Limited
HDFC Bank, RR Nagara Bangalore
Bank Account Number: 50200113435220
IFSC Code: HDFC0001039

Kindly make the payment to the mentioned bank account.

Note: All payments should be made in favor of Luminexa Technologies Private Limited only.`;
}

export async function generateDocumentPDF({ documentData, client, settings }) {
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  doc.setCharSpace(0);
  doc.setFont("helvetica", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 16;
  const right = pageWidth - margin;
  const footerSafeY = pageHeight - 30;
  const MAX_ROWS_PER_PAGE = 5;

  const logo = await loadImage("/logo.png");
  const icon = await loadImage("/Fevicon23.png");

  const companyName =
    settings?.companyName || "Luminexa Technologies Private Limited";

  const companyAddress =
    settings?.address ||
    "3rd Floor, No. 3895, 80 Feet Rd, 1st Phase Girinagar, VHBCS Layout, Banashankari, Bengaluru, Karnataka 560085";

  const companyGSTIN =
    settings?.gstin ||
    settings?.GSTIN ||
    settings?.companyGSTIN ||
    "29AAGCL7377Q1ZB";

  const email = settings?.email || "info@luminexa.in";
  const phone = settings?.phone || "+91 8660449970";
  const website = settings?.website || "https://luminexa.in";

  const clientName =
    client?.billingName || client?.companyName || client?.contactName || "-";

  const clientAddress =
    client?.billingAddress || client?.companyAddress || "-";

  const clientGSTIN = client?.gstin || client?.billingGSTIN || "";

  const docType = documentData.documentType || "Quotation";
  const docLabel = getDocLabel(docType);

  const isQuotation = docType === "Quotation";
  const isInvoice = docType === "Invoice";

  const isOptionsQuotation =
    docType === "Quotation" && documentData.quotationMode === "options";

  const placeOfSupply = documentData.placeOfSupply || "Karnataka";

  const advanceAmount =
    isInvoice && documentData.enableAdvanceAmount
      ? Number(documentData.advanceAmount || 0)
      : 0;

  const balanceAmount =
    isInvoice && advanceAmount > 0
      ? Number(documentData.balanceAmount || 0)
      : Number(documentData.grandTotal || 0);

  const terms =
    documentData.terms ||
    (isQuotation ? getQuotationTerms() : getInvoiceTerms());

  const rows = (documentData.items || []).map((item, index) => {
    const quantity = Number(item.quantity || 1);
    const rate = Number(item.rate || 0);
    const optionDiscount = Number(item.optionDiscount || 0);

    const baseAmount = Number(item.amount || quantity * rate);
    const finalAmount = isOptionsQuotation
      ? Math.max(quantity * rate - optionDiscount, 0)
      : baseAmount;

    return [
      index + 1,
      item.remark || item.description || "-",
      item.itemName || "Information Technology (IT) Design and Development",
      item.hsnCode || "998314",
      quantity,
      money(rate),

      ...(isOptionsQuotation ? [money(optionDiscount)] : []),

      money(finalAmount),
    ];
  });

  const itemChunks = [];
  for (let i = 0; i < rows.length; i += MAX_ROWS_PER_PAGE) {
    itemChunks.push(rows.slice(i, i + MAX_ROWS_PER_PAGE));
  }

  if (itemChunks.length === 0) itemChunks.push([]);

  function drawHeader(pageIndex = 0) {
    if (logo) {
      doc.addImage(logo, "PNG", margin, 16, 38, 5.8, undefined, "FAST");
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(`#${docType.toUpperCase()}`, right, 21, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.3);

    doc.text(`Date ${documentData.date || "-"}`, right, 28, {
      align: "right",
    });

    doc.text(`${docLabel}# ${documentData.documentNumber || "-"}`, right, 32.8, {
      align: "right",
    });

    if (isInvoice) {
      doc.text("Reverse Charge : No", right, 37.6, {
        align: "right",
      });
    }

    if (isQuotation) {
      doc.text("Valid till 1 Month", right, 37.6, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(
        isOptionsQuotation ? "QF2" : "QF1",
        right,
        44,
        { align: "right" }
      );
    }

    if (pageIndex > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Continued", right, isQuotation ? 49 : 44, { align: "right" });
    }

    let y = 30;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.text(companyName, margin, y);

    y += 4.6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);

    const companyAddressLines = doc.splitTextToSize(companyAddress, 98);
    doc.text(companyAddressLines, margin, y);

    y += companyAddressLines.length * 3.7;

    if (companyGSTIN) {
      doc.setFont("helvetica", "bold");
      doc.text(`GSTIN : ${companyGSTIN}`, margin, y);
      y += 4.6;
    }

    doc.setFont("helvetica", "normal");
    doc.text(`Website : ${website}`, margin, y);

    y += 9;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.text(`${docType} To:`, margin, y);

    y += 4.8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(clientName, margin, y);

    y += 4.8;

    doc.setFont("helvetica", "bold");
    doc.text("Reg. Off Address", margin, y);

    y += 4.8;

    doc.setFont("helvetica", "normal");
    const clientAddressLines = doc.splitTextToSize(clientAddress, 98);
    doc.text(clientAddressLines, margin, y);

    y += clientAddressLines.length * 4.4;

    if (clientGSTIN) {
      doc.setFont("helvetica", "bold");
      doc.text(`GSTIN : ${clientGSTIN}`, margin, y);
      y += 7;
    }

    doc.setFont("helvetica", "bold");
    doc.text(`Place of Supply : ${placeOfSupply}`, margin, y);

    y += 10;

    return Math.max(y + 3, 102);
  }

  function drawFooter() {
    const footerY = pageHeight - 16;
    const iconWidth = 10;
    const iconHeight = 9;

    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.03);
    doc.line(margin, footerY - 7, right, footerY - 7);

    if (icon) {
      doc.addImage(
        icon,
        "PNG",
        margin,
        footerY - 3.5,
        iconWidth,
        iconHeight,
        undefined,
        "FAST"
      );
    }

    const footerTextX = margin + iconWidth + 3;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);

    doc.text(
      `For any additional information, please contact us at ${email} or call ${phone}.`,
      footerTextX,
      footerY
    );

    doc.setFont("helvetica", "bold");
    doc.text(`${companyName} | CIN : U62099KA2025PTC204174`, footerTextX, footerY + 4.2);
  }

  function drawItemsTable(startY, body) {
    autoTable(doc, {
      startY,
      head: [
        [
          "#",
          "Remark",
          "Item & Description",
          "HSN Code",
          "Qty",
          "Rate",
          ...(isOptionsQuotation ? ["Discount"] : []),
          "Amount",
        ],
      ],
      body,
      theme: "grid",
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - margin * 2,
      styles: {
        font: "helvetica",
        fontSize: 6.9,
        cellPadding: 1.3,
        textColor: [0, 0, 0],
        lineColor: [215, 215, 215],
        lineWidth: 0.12,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: {
        fontStyle: "bold",
        fontSize: 7,
        cellPadding: 1.4,
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
      },
      columnStyles: isOptionsQuotation
        ? {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 32 },
            2: { cellWidth: 42 },
            3: { cellWidth: 18 },
            4: { cellWidth: 10, halign: "center" },
            5: { cellWidth: 22, halign: "right" },
            6: { cellWidth: 22, halign: "right" },
            7: { cellWidth: 24, halign: "right" },
          }
        : {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 38 },
            2: { cellWidth: 48 },
            3: { cellWidth: 22 },
            4: { cellWidth: 11, halign: "center" },
            5: { cellWidth: 26, halign: "right" },
            6: { cellWidth: 25, halign: "right" },
          },
    });

    return doc.lastAutoTable.finalY + 4;
  }

  function ensureSpace(y, requiredHeight = 20) {
    if (y + requiredHeight > footerSafeY) {
      drawFooter();
      doc.addPage();
      return drawHeader();
    }

    return y;
  }

  function drawOptionQuotationTerms(y) {
    y = ensureSpace(y, 18);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    doc.text("Terms And Conditions", margin, y);

    y += 4.8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);

    const termLines = doc.splitTextToSize(terms, 182);
    const termLineHeight = 3.15;

    let currentLineIndex = 0;

    while (currentLineIndex < termLines.length) {
      const availableLines = Math.floor((footerSafeY - y) / termLineHeight);

      if (availableLines <= 0) {
        drawFooter();
        doc.addPage();
        y = drawHeader();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.2);
        doc.text("Terms And Conditions Continued", margin, y);

        y += 4.8;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
      }

      const linesToPrint = termLines.slice(
        currentLineIndex,
        currentLineIndex + availableLines
      );

      doc.text(linesToPrint, margin, y);

      y += linesToPrint.length * termLineHeight;
      currentLineIndex += linesToPrint.length;
    }
  }

  function drawTotalsAndTerms(y) {
    if (isOptionsQuotation) {
      drawOptionQuotationTerms(y);
      return;
    }

    if (isQuotation) {
      y = ensureSpace(y, 9);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(
        "(An 18% GST is applicable on the final base price for this quotation)",
        margin,
        y
      );

      y += 6;
    }

    y = ensureSpace(y, 58);

    const labelX = 132;
    const valueX = right;
    const lineHeight = 4.8;

    doc.setFontSize(7.7);
    doc.setFont("helvetica", "normal");

    doc.text("Sub Total", labelX, y);
    doc.text(money(documentData.subtotal || 0), valueX, y, {
      align: "right",
    });

    y += lineHeight;

    if (documentData.discount && Number(documentData.discount) > 0) {
      const discountLabel = documentData.discountPercent
        ? `- Discount (${documentData.discountPercent}%)`
        : "- Discount";

      doc.text(discountLabel, labelX, y);
      doc.text(money(documentData.discount || 0), valueX, y, {
        align: "right",
      });

      y += lineHeight;
    }

    if (!isQuotation) {
      const gstTotal = Number(documentData.gstTotal || 0);
      const cgst = gstTotal / 2;
      const sgst = gstTotal / 2;

      doc.text("CGST (9%)", labelX, y);
      doc.text(money(cgst), valueX, y, { align: "right" });
      y += lineHeight;

      doc.text("SGST (9%)", labelX, y);
      doc.text(money(sgst), valueX, y, { align: "right" });
      y += lineHeight;
    }

    y += 1.2;

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.03);
    doc.line(labelX, y, valueX, y);

    y += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.text("Total", labelX, y);
    doc.text(money(documentData.grandTotal || 0), valueX, y, {
      align: "right",
    });

    y += 1.5;
    doc.line(labelX, y, valueX, y);
    y += 4.8;

    if (isInvoice && advanceAmount > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.7);

      doc.text("Advance Amount (-)", labelX, y);
      doc.text(money(advanceAmount), valueX, y, { align: "right" });

      y += lineHeight;

      doc.setFont("helvetica", "bold");
      doc.text("Balance Amount", labelX, y);
      doc.text(money(balanceAmount), valueX, y, { align: "right" });

      y += 1.5;
      doc.line(labelX, y, valueX, y);
      y += 5;
    }

    y += 3;

    y = ensureSpace(y, 18);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");

    doc.text(
      isInvoice && advanceAmount > 0
        ? "BALANCE AMOUNT (IN WORDS)"
        : `${docType.toUpperCase()} TOTAL (IN WORDS)`,
      margin,
      y
    );

    y += 4.8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    const amountLines = doc.splitTextToSize(
      documentData.amountInWords || "Rupees Only",
      178
    );

    doc.text(amountLines, margin, y);

    y += amountLines.length * 3.5 + 5;

    y = ensureSpace(y, 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    doc.text("Terms And Conditions", margin, y);

    y += 4.8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);

    const termLines = doc.splitTextToSize(terms, 182);
    const termLineHeight = 3.15;

    let currentLineIndex = 0;

    while (currentLineIndex < termLines.length) {
      const availableLines = Math.floor((footerSafeY - y) / termLineHeight);

      if (availableLines <= 0) {
        drawFooter();
        doc.addPage();
        y = drawHeader();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.2);
        doc.text("Terms And Conditions Continued", margin, y);

        y += 4.8;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
      }

      const linesToPrint = termLines.slice(
        currentLineIndex,
        currentLineIndex + availableLines
      );

      doc.text(linesToPrint, margin, y);

      y += linesToPrint.length * termLineHeight;
      currentLineIndex += linesToPrint.length;
    }
  }

  itemChunks.forEach((chunk, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
    }

    const tableStartY = drawHeader(pageIndex);
    const yAfterTable = drawItemsTable(tableStartY, chunk);
    const isLastPage = pageIndex === itemChunks.length - 1;

    if (!isLastPage) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.3);
      doc.text("Continued on next page...", right, yAfterTable + 3, {
        align: "right",
      });

      drawFooter();
      return;
    }

    drawTotalsAndTerms(yAfterTable);
    drawFooter();
  });

  doc.save(`${docType}-${documentData.documentNumber || "document"}.pdf`);
}