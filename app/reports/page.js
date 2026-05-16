"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatINR } from "@/lib/utils";

function getClientName(clientSnapshot) {
  return (
    clientSnapshot?.billingName ||
    clientSnapshot?.companyName ||
    clientSnapshot?.contactName ||
    clientSnapshot?.name ||
    "-"
  );
}

function getMonthLabel(dateValue) {
  if (!dateValue) return "Unknown Month";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown Month";

  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function safeNumber(value) {
  return Number(value || 0);
}

function buildRows(data) {
  return data.map((item) => ({
    Month: item.month,
    "Document Type": item.documentType,
    "Document Number": item.documentNumber || "-",
    Date: item.date || "-",
    Client: item.clientName,
    "Place of Supply": item.placeOfSupply || "Karnataka",
    Subtotal: item.subtotal,
    "Discount %": item.discountPercent,
    "Discount Amount": item.discount,
    "Base Total After Discount": item.baseTotalAfterDiscount,
    CGST: item.cgst,
    SGST: item.sgst,
    "GST Total": item.gstTotal,
    "Grand Total": item.grandTotal,
    "Advance Amount": item.advanceAmount,
    "Balance Amount": item.balanceAmount,
  }));
}

function downloadCSV(filename, rows) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function downloadExcel(filename, rows) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const table = `
    <table border="1">
      <thead>
        <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${headers
                .map((h) => `<td>${row[h] ?? ""}</td>`)
                .join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  const blob = new Blob([table], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function downloadPDF(title, rows) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const html = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 24px;
            color: #111;
          }
          h1 {
            font-size: 20px;
            margin-bottom: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 7px;
            text-align: left;
          }
          th {
            background: #f3f3f3;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) =>
                  `<tr>${headers
                    .map((h) => `<td>${row[h] ?? ""}</td>`)
                    .join("")}</tr>`
              )
              .join("")}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(html);
  printWindow.document.close();
}

export default function ReportsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [downloadFormat, setDownloadFormat] = useState("pdf");

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true);

        const docsQuery = query(
          collection(db, "documents"),
          orderBy("createdAt", "desc")
        );

        const docsSnap = await getDocs(docsQuery);

        setDocuments(
          docsSnap.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  const enrichedDocuments = useMemo(() => {
    return documents.map((doc) => {
      const gstTotal = safeNumber(doc.gstTotal);
      const cgst = doc.documentType === "Quotation" ? 0 : gstTotal / 2;
      const sgst = doc.documentType === "Quotation" ? 0 : gstTotal / 2;

      return {
        ...doc,
        month: getMonthLabel(doc.date),
        clientName: getClientName(doc.clientSnapshot),
        subtotal: safeNumber(doc.subtotal),
        discount: safeNumber(doc.discount),
        discountPercent: doc.discountPercent || 0,
        baseTotalAfterDiscount: safeNumber(doc.baseTotalAfterDiscount),
        cgst,
        sgst,
        gstTotal,
        grandTotal: safeNumber(doc.grandTotal),
        advanceAmount: safeNumber(doc.advanceAmount),
        balanceAmount: safeNumber(doc.balanceAmount),
      };
    });
  }, [documents]);

  const months = useMemo(() => {
    return ["All", ...new Set(enrichedDocuments.map((item) => item.month))];
  }, [enrichedDocuments]);

  const filteredDocuments = useMemo(() => {
    return enrichedDocuments.filter((item) => {
      const monthMatch =
        selectedMonth === "All" || item.month === selectedMonth;

      const typeMatch =
        selectedType === "All" || item.documentType === selectedType;

      return monthMatch && typeMatch;
    });
  }, [enrichedDocuments, selectedMonth, selectedType]);

  const groupedReports = useMemo(() => {
    return filteredDocuments.reduce((acc, item) => {
      if (!acc[item.month]) acc[item.month] = [];
      acc[item.month].push(item);
      return acc;
    }, {});
  }, [filteredDocuments]);

  const totals = useMemo(() => {
    return filteredDocuments.reduce(
      (acc, item) => {
        acc.count += 1;
        acc.subtotal += item.subtotal;
        acc.discount += item.discount;
        acc.baseTotalAfterDiscount += item.baseTotalAfterDiscount;
        acc.cgst += item.cgst;
        acc.sgst += item.sgst;
        acc.gstTotal += item.gstTotal;
        acc.advanceAmount += item.advanceAmount;
        acc.balanceAmount += item.balanceAmount;

        if (item.documentType === "Quotation") {
          acc.quotationCount += 1;
          acc.quotationValue += item.grandTotal;
        }

        if (item.documentType === "Invoice") {
          acc.invoiceCount += 1;
          acc.invoiceSales += item.grandTotal;
        }

        if (item.documentType === "Proforma Invoice") {
          acc.proformaCount += 1;
          acc.proformaValue += item.grandTotal;
        }

        return acc;
      },
      {
        count: 0,
        quotationCount: 0,
        invoiceCount: 0,
        proformaCount: 0,
        quotationValue: 0,
        invoiceSales: 0,
        proformaValue: 0,
        subtotal: 0,
        discount: 0,
        baseTotalAfterDiscount: 0,
        cgst: 0,
        sgst: 0,
        gstTotal: 0,
        advanceAmount: 0,
        balanceAmount: 0,
      }
    );
  }, [filteredDocuments]);

  function handleDownload(data, name) {
    const rows = buildRows(data);

    if (!rows.length) {
      alert("No report data available.");
      return;
    }

    if (downloadFormat === "csv") {
      downloadCSV(`${name}.csv`, rows);
    }

    if (downloadFormat === "excel") {
      downloadExcel(`${name}.xls`, rows);
    }

    if (downloadFormat === "pdf") {
      downloadPDF(name, rows);
    }
  }

  function handleDownloadCurrentReport() {
    handleDownload(filteredDocuments, "current-documents-report");
  }

  function handleDownloadByType(type) {
    const data = filteredDocuments.filter((item) => item.documentType === type);
    handleDownload(data, `${type.toLowerCase().replaceAll(" ", "-")}-report`);
  }

  return (
    <div className="documents-page">
      <div className="documents-hero">
        <div>
          <p className="documents-eyebrow">Reports</p>
          <h1>Report Pulling</h1>
          <p>
            Download month-wise quotation, invoice and proforma invoice reports
            with GST, CGST, SGST, discount and total values.
          </p>
        </div>

        <div className="documents-count-card">
          <span>Total Records</span>
          <strong>{filteredDocuments.length}</strong>
        </div>
      </div>

      <div className="documents-tabs-card report-filter-card">
        <div className="report-filter-grid">
          <div className="form-group">
            <label>Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {months.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Document Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="All">All Documents</option>
              <option value="Quotation">Quotation</option>
              <option value="Proforma Invoice">Proforma Invoice</option>
              <option value="Invoice">Invoice</option>
            </select>
          </div>

          <div className="form-group">
            <label>Download Format</label>
            <select
              value={downloadFormat}
              onChange={(e) => setDownloadFormat(e.target.value)}
            >
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
            </select>
          </div>
        </div>

        <div className="report-download-actions">
          <button
            type="button"
            className="btn report-main-btn"
            onClick={handleDownloadCurrentReport}
          >
            Download Current Report
          </button>

          <button
            type="button"
            className="btn secondary"
            onClick={() => handleDownloadByType("Quotation")}
          >
            Quotations
          </button>

          <button
            type="button"
            className="btn secondary"
            onClick={() => handleDownloadByType("Proforma Invoice")}
          >
            Proforma
          </button>

          <button
            type="button"
            className="btn secondary"
            onClick={() => handleDownloadByType("Invoice")}
          >
            Invoices
          </button>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        <div className="dashboard-stat-card">
          <span>Total Documents</span>
          <h2>{totals.count}</h2>
          <p>
            Q: {totals.quotationCount} | PR: {totals.proformaCount} | INV:{" "}
            {totals.invoiceCount}
          </p>
        </div>

        <div className="dashboard-stat-card">
          <span>Invoice Sales</span>
          <h2>₹ {formatINR(totals.invoiceSales)}</h2>
          <p>Total invoice amount</p>
        </div>

        <div className="dashboard-stat-card">
          <span>Quotation Value</span>
          <h2>₹ {formatINR(totals.quotationValue)}</h2>
          <p>Total quotation amount</p>
        </div>

        <div className="dashboard-stat-card">
          <span>Proforma Value</span>
          <h2>₹ {formatINR(totals.proformaValue)}</h2>
          <p>Total proforma amount</p>
        </div>

        <div className="dashboard-stat-card">
          <span>Total Discount</span>
          <h2>₹ {formatINR(totals.discount)}</h2>
          <p>Overall discount value</p>
        </div>

        <div className="dashboard-stat-card">
          <span>CGST</span>
          <h2>₹ {formatINR(totals.cgst)}</h2>
          <p>Calculated from GST total</p>
        </div>

        <div className="dashboard-stat-card">
          <span>SGST</span>
          <h2>₹ {formatINR(totals.sgst)}</h2>
          <p>Calculated from GST total</p>
        </div>
      </div>

      <div className="documents-content-card">
        {loading ? (
          <div className="empty-state">
            <div className="loader-dot" />
            <h3>Loading reports...</h3>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No Report Data Found</h3>
            <p>No documents available for the selected filters.</p>
          </div>
        ) : (
          Object.entries(groupedReports).map(([month, docs]) => (
            <div key={month} className="month-section">
              <div className="month-header">
                <h2>{month}</h2>
                <span>{docs.length} Records</span>
              </div>

              <div className="modern-table-wrap">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Date</th>
                      <th>Client</th>
                      <th>Subtotal</th>
                      <th>Discount</th>
                      <th>Base Total</th>
                      <th>CGST</th>
                      <th>SGST</th>
                      <th>GST</th>
                      <th>Grand Total</th>
                      <th>Advance</th>
                      <th>Balance</th>
                    </tr>
                  </thead>

                  <tbody>
                    {docs.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="doc-info">
                            <strong>{item.documentNumber || "-"}</strong>
                            <span>{item.documentType}</span>
                          </div>
                        </td>

                        <td>{item.date || "-"}</td>
                        <td>{item.clientName}</td>
                        <td>₹ {formatINR(item.subtotal)}</td>

                        <td>
                          ₹ {formatINR(item.discount)}
                          {item.discountPercent ? (
                            <span> ({item.discountPercent}%)</span>
                          ) : null}
                        </td>

                        <td>₹ {formatINR(item.baseTotalAfterDiscount)}</td>
                        <td>₹ {formatINR(item.cgst)}</td>
                        <td>₹ {formatINR(item.sgst)}</td>
                        <td>₹ {formatINR(item.gstTotal)}</td>

                        <td>
                          <strong>₹ {formatINR(item.grandTotal)}</strong>
                        </td>

                        <td>₹ {formatINR(item.advanceAmount)}</td>
                        <td>₹ {formatINR(item.balanceAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .report-filter-card {
          padding: 20px;
        }

        .report-filter-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(220px, 1fr));
          gap: 14px;
          align-items: end;
        }

        .report-filter-grid .form-group {
          margin-bottom: 0;
        }

        .report-download-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .report-download-actions .btn {
          min-height: 38px;
          padding: 9px 14px;
          border-radius: 13px;
          white-space: nowrap;
        }

        .report-main-btn {
          min-width: 190px;
        }

        @media (max-width: 900px) {
          .report-filter-grid {
            grid-template-columns: 1fr;
          }

          .report-download-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .report-download-actions .btn {
            width: 100%;
          }

          .report-main-btn {
            grid-column: span 2;
          }
        }

        @media (max-width: 520px) {
          .report-download-actions {
            grid-template-columns: 1fr;
          }

          .report-main-btn {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
}