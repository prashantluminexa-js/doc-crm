"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatINR } from "@/lib/utils";
import { generateDocumentPDF } from "@/lib/pdfGenerator";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("Quotation");
  const [downloadingId, setDownloadingId] = useState(null);

  const [deleteItem, setDeleteItem] = useState(null);
  const [editItem, setEditItem] = useState(null);

  const [editForm, setEditForm] = useState({
    documentNumber: "",
    date: "",
    clientName: "",
  });

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      setLoading(true);

      const docsQuery = query(
        collection(db, "documents"),
        orderBy("createdAt", "desc")
      );

      const docsSnap = await getDocs(docsQuery);

      setDocuments(
        docsSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }))
      );

      const settingsSnap = await getDocs(collection(db, "settings"));

      if (!settingsSnap.empty) {
        setSettings({
          id: settingsSnap.docs[0].id,
          ...settingsSnap.docs[0].data(),
        });
      }
    } catch (error) {
      console.error(error);
      alert("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

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

  const filteredDocuments = useMemo(() => {
    return documents.filter((item) => item.documentType === activeTab);
  }, [documents, activeTab]);

  const groupedDocuments = useMemo(() => {
    return filteredDocuments.reduce((acc, item) => {
      const month = getMonthLabel(item.date);

      if (!acc[month]) acc[month] = [];
      acc[month].push(item);

      return acc;
    }, {});
  }, [filteredDocuments]);

  async function handleDownload(item) {
    try {
      setDownloadingId(item.id);

      await generateDocumentPDF({
        documentData: item,
        client: item.clientSnapshot,
        settings,
      });
    } catch (error) {
      console.error(error);
      alert("Failed to download PDF");
    } finally {
      setDownloadingId(null);
    }
  }

  function openEditPopup(item) {
    setEditItem(item);

    setEditForm({
      documentNumber: item.documentNumber || "",
      date: item.date || "",
      clientName: getClientName(item.clientSnapshot),
    });
  }

  async function handleEditSave() {
    if (!editItem) return;

    try {
      await updateDoc(doc(db, "documents", editItem.id), {
        documentNumber: editForm.documentNumber,
        date: editForm.date,
        clientSnapshot: {
          ...editItem.clientSnapshot,
          billingName: editForm.clientName,
          companyName: editForm.clientName,
        },
      });

      setEditItem(null);
      await loadDocuments();

      alert("Document updated successfully");
    } catch (error) {
      console.error(error);
      alert("Failed to update document");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteItem) return;

    try {
      await deleteDoc(doc(db, "documents", deleteItem.id));

      setDeleteItem(null);
      await loadDocuments();

      alert("Document deleted successfully");
    } catch (error) {
      console.error(error);
      alert("Failed to delete document");
    }
  }

  return (
    <div>
      <div className="card">
        <h1>Documents List</h1>
        <p>View saved quotations, proforma invoices and invoices.</p>
      </div>

      <div className="card">
        <div className="doc-tabs">
          {["Quotation", "Proforma Invoice", "Invoice"].map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "doc-tab active" : "doc-tab"}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading documents...</p>
        ) : filteredDocuments.length === 0 ? (
          <p>No {activeTab} documents found.</p>
        ) : (
          Object.entries(groupedDocuments).map(([month, monthDocs]) => (
            <div key={month} className="month-section">
              <h2 className="month-title">{month}</h2>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>No</th>
                      <th>Date</th>
                      <th>Client</th>
                      <th>Total</th>
                      <th>PDF</th>
                      <th>Edit</th>
                      <th>Delete</th>
                    </tr>
                  </thead>

                  <tbody>
                    {monthDocs.map((item) => (
                      <tr key={item.id}>
                        <td>{item.documentType || "-"}</td>
                        <td>{item.documentNumber || "-"}</td>
                        <td>{item.date || "-"}</td>
                        <td>{getClientName(item.clientSnapshot)}</td>
                        <td>₹ {formatINR(item.grandTotal || 0)}</td>

                        <td>
                          <button
                            type="button"
                            className="btn small"
                            disabled={downloadingId === item.id}
                            onClick={() => handleDownload(item)}
                          >
                            {downloadingId === item.id
                              ? "Downloading..."
                              : "Download"}
                          </button>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn small secondary"
                            onClick={() => openEditPopup(item)}
                          >
                            Edit
                          </button>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn small danger"
                            onClick={() => setDeleteItem(item)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {deleteItem && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Delete Document?</h2>
            <p>
              Are you sure you want to delete{" "}
              <strong>{deleteItem.documentNumber}</strong>?
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setDeleteItem(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn danger"
                onClick={handleDeleteConfirm}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Edit Document</h2>

            <div className="form-group">
              <label>Document Number</label>
              <input
                value={editForm.documentNumber}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    documentNumber: e.target.value,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={editForm.date}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    date: e.target.value,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label>Client Name</label>
              <input
                value={editForm.clientName}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    clientName: e.target.value,
                  })
                }
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditItem(null)}
              >
                Cancel
              </button>

              <button type="button" className="btn" onClick={handleEditSave}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}