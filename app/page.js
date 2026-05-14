"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatINR } from "@/lib/utils";

export default function DashboardPage() {
  const [clients, setClients] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);

        const clientsSnap = await getDocs(collection(db, "clients"));

        const docsQuery = query(
          collection(db, "documents"),
          orderBy("createdAt", "desc")
        );

        const docsSnap = await getDocs(docsQuery);

        setClients(
          clientsSnap.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );

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

    loadDashboardData();
  }, []);

  function getMonthLabel(dateValue) {
    if (!dateValue) return "Unknown Month";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Unknown Month";
    }

    return date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }

  const analytics = useMemo(() => {
    const result = {};

    documents.forEach((doc) => {
      const month = getMonthLabel(doc.date);

      if (!result[month]) {
        result[month] = {
          month,
          quotationCount: 0,
          quotationAmount: 0,
          invoiceCount: 0,
          invoiceSales: 0,
          proformaCount: 0,
          proformaAmount: 0,
          totalDocuments: 0,
        };
      }

      result[month].totalDocuments += 1;

      const amount = Number(doc.grandTotal || 0);

      if (doc.documentType === "Quotation") {
        result[month].quotationCount += 1;
        result[month].quotationAmount += amount;
      }

      if (doc.documentType === "Invoice") {
        result[month].invoiceCount += 1;
        result[month].invoiceSales += amount;
      }

      if (doc.documentType === "Proforma Invoice") {
        result[month].proformaCount += 1;
        result[month].proformaAmount += amount;
      }
    });

    return Object.values(result);
  }, [documents]);

  const totals = useMemo(() => {
    return documents.reduce(
      (acc, doc) => {
        const amount = Number(doc.grandTotal || 0);

        if (doc.documentType === "Quotation") {
          acc.quotationAmount += amount;
          acc.quotationCount += 1;
        }

        if (doc.documentType === "Invoice") {
          acc.totalSales += amount;
          acc.invoiceCount += 1;
        }

        if (doc.documentType === "Proforma Invoice") {
          acc.proformaCount += 1;
        }

        return acc;
      },
      {
        totalSales: 0,
        invoiceCount: 0,
        quotationAmount: 0,
        quotationCount: 0,
        proformaCount: 0,
      }
    );
  }, [documents]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-hero">
        <div className="dashboard-hero-content">
          <p className="dashboard-eyebrow">Luminexa Admin</p>

          <h1>Luminexa Technologies</h1>

          <p>
            Simple admin dashboard for quotations, invoices, proforma invoices
            and monthly business analytics.
          </p>

          <div className="dashboard-actions">
            <Link href="/create-document">
              <button className="dashboard-create-btn">
                <span className="dashboard-create-icon">+</span>

                <div>
                  <strong>Create Document</strong>
                  <small>Quotation, Invoice & PDF</small>
                </div>
              </button>
            </Link>

            <Link href="/clients">
              <button className="dashboard-secondary-btn">
                <span>👤</span>
                Add Client
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        <div className="dashboard-stat-card">
          <span>Total Sales</span>

          <h2>₹ {formatINR(totals.totalSales)}</h2>

          <p>Invoice based sales</p>
        </div>

        <div className="dashboard-stat-card">
          <span>Total Clients</span>

          <h2>{clients.length}</h2>

          <p>Saved clients</p>
        </div>

        <div className="dashboard-stat-card">
          <span>Total Documents</span>

          <h2>{documents.length}</h2>

          <p>Generated documents</p>
        </div>

        <div className="dashboard-stat-card">
          <span>Quotations</span>

          <h2>{totals.quotationCount}</h2>

          <p>₹ {formatINR(totals.quotationAmount)}</p>
        </div>
      </div>

      <div className="dashboard-table-card">
        <div className="dashboard-section-header">
          <div>
            <h2>Monthly Analytics</h2>

            <p>
              Monthly quotation values, invoice sales and document analytics.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="loader-dot" />

            <h3>Loading analytics...</h3>
          </div>
        ) : analytics.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>

            <h3>No Analytics Found</h3>

            <p>Create documents to view analytics.</p>
          </div>
        ) : (
          <div className="modern-table-wrap">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Quotations</th>
                  <th>Quotation Value</th>
                  <th>Invoices</th>
                  <th>Total Sales</th>
                  <th>Proforma</th>
                  <th>Total Docs</th>
                </tr>
              </thead>

              <tbody>
                {analytics.map((item) => (
                  <tr key={item.month}>
                    <td>
                      <strong>{item.month}</strong>
                    </td>

                    <td>{item.quotationCount}</td>

                    <td>₹ {formatINR(item.quotationAmount)}</td>

                    <td>{item.invoiceCount}</td>

                    <td>
                      <strong>
                        ₹ {formatINR(item.invoiceSales)}
                      </strong>
                    </td>

                    <td>{item.proformaCount}</td>

                    <td>{item.totalDocuments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}