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
  const [previewItem, setPreviewItem] = useState(null);

  const [popup, setPopup] = useState({
    show: false,
    type: "success",
    title: "",
    message: "",
  });

  const [editForm, setEditForm] = useState({
    documentNumber: "",
    date: "",
    clientName: "",
  });

  useEffect(() => {
    loadDocuments();
  }, []);

  function showPopup(type, title, message) {
    setPopup({ show: true, type, title, message });
  }

  function closePopup() {
    setPopup({
      show: false,
      type: "success",
      title: "",
      message: "",
    });
  }

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
      showPopup("error", "Failed to Load", "Unable to load documents.");
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

  function getDiscountPercent(item) {
    return (
      item?.discountPercent ||
      item?.discountPercentage ||
      item?.discount_percent ||
      0
    );
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

      showPopup(
        "success",
        "PDF Downloaded",
        `${item.documentNumber || "Document"} downloaded successfully.`
      );
    } catch (error) {
      console.error(error);
      showPopup("error", "Download Failed", "Failed to download PDF.");
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

      showPopup(
        "success",
        "Document Updated",
        `${editForm.documentNumber} updated successfully.`
      );
    } catch (error) {
      console.error(error);
      showPopup("error", "Update Failed", "Failed to update document.");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteItem) return;

    try {
      const deletedNumber = deleteItem.documentNumber;

      await deleteDoc(doc(db, "documents", deleteItem.id));

      setDeleteItem(null);
      await loadDocuments();

      showPopup(
        "success",
        "Document Deleted",
        `${deletedNumber} deleted successfully.`
      );
    } catch (error) {
      console.error(error);
      showPopup("error", "Delete Failed", "Failed to delete document.");
    }
  }

  return (
    <div className="documents-page">
      <div className="documents-hero">
        <div>
          <p className="documents-eyebrow">Document Management</p>
          <h1>Documents List</h1>
          <p>
            View, preview, download, edit and manage saved quotations, proforma
            invoices and invoices.
          </p>
        </div>

        <div className="documents-count-card">
          <span>Total Documents</span>
          <strong>{documents.length}</strong>
        </div>
      </div>

      <div className="documents-tabs-card">
        <div className="doc-tabs">
          {["Quotation", "Proforma Invoice", "Invoice"].map((tab) => {
            const count = documents.filter(
              (item) => item.documentType === tab
            ).length;

            return (
              <button
                key={tab}
                type="button"
                className={activeTab === tab ? "doc-tab active" : "doc-tab"}
                onClick={() => setActiveTab(tab)}
              >
                <span>{tab}</span>
                <small>{count}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="documents-content-card">
        {loading ? (
          <div className="empty-state">
            <div className="loader-dot" />
            <h3>Loading documents...</h3>
            <p>Please wait while we fetch your saved documents.</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>No {activeTab} Found</h3>
            <p>Create a new {activeTab.toLowerCase()} to see it here.</p>
          </div>
        ) : (
          Object.entries(groupedDocuments).map(([month, monthDocs]) => (
            <div key={month} className="month-section">
              <div className="month-header">
                <h2>{month}</h2>
                <span>{monthDocs.length} Documents</span>
              </div>

              <div className="modern-table-wrap">
                <table className="modern-table documents-table">
                  <thead>
                    <tr>
                      <th>Document Details</th>
                      <th>Date</th>
                      <th>Client</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {monthDocs.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="doc-info">
                            <strong>{item.documentNumber || "-"}</strong>
                            <span>{item.documentType || "-"}</span>
                          </div>
                        </td>

                        <td>{item.date || "-"}</td>

                        <td>
                          <div className="client-name">
                            {getClientName(item.clientSnapshot)}
                          </div>
                        </td>

                        <td className="text-right">
                          <strong className="amount-text">
                            ₹ {formatINR(item.grandTotal || 0)}
                          </strong>
                        </td>

                        <td>
                          <div className="action-buttons right">
                            <button
                              type="button"
                              className="icon-btn secondary"
                              onClick={() => setPreviewItem(item)}
                            >
                              Preview
                            </button>

                            <button
                              type="button"
                              className="icon-btn primary"
                              disabled={downloadingId === item.id}
                              onClick={() => handleDownload(item)}
                            >
                              {downloadingId === item.id ? "..." : "PDF"}
                            </button>

                            <button
                              type="button"
                              className="icon-btn secondary"
                              onClick={() => openEditPopup(item)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="icon-btn danger"
                              onClick={() => setDeleteItem(item)}
                            >
                              Delete
                            </button>
                          </div>
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

      {previewItem && (
        <div className="modal-overlay">
          <div className="modal-card modern-modal preview-modal">
            <div className="preview-header">
              <div>
                <p className="documents-eyebrow">Preview</p>
                <h2>{previewItem.documentType}</h2>
                <p className="modal-subtitle">
                  {previewItem.documentNumber || "-"}
                </p>
              </div>

              <button
                type="button"
                className="btn secondary"
                onClick={() => setPreviewItem(null)}
              >
                Close
              </button>
            </div>

            <div className="preview-summary-grid">
              <div>
                <span>Date</span>
                <strong>{previewItem.date || "-"}</strong>
              </div>

              <div>
                <span>Client</span>
                <strong>{getClientName(previewItem.clientSnapshot)}</strong>
              </div>

              <div>
                <span>Place of Supply</span>
                <strong>{previewItem.placeOfSupply || "Karnataka"}</strong>
              </div>

              <div>
                <span>Total</span>
                <strong>₹ {formatINR(previewItem.grandTotal || 0)}</strong>
              </div>
            </div>

            <div className="preview-section">
              <h3>Items / Services</h3>

              <div className="modern-table-wrap">
                <table className="modern-table preview-items-table">
                  <thead>
                    <tr>
                      <th>Remark</th>
                      <th>Item</th>
                      <th>HSN</th>
                      <th>Qty</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(previewItem.items || []).map((item, index) => (
                      <tr key={index}>
                        <td>{item.remark || "-"}</td>
                        <td>{item.itemName || "-"}</td>
                        <td>{item.hsnCode || "-"}</td>
                        <td>{item.quantity || 0}</td>
                        <td className="text-right">
                          ₹ {formatINR(item.rate || 0)}
                        </td>
                        <td className="text-right">
                          <strong>₹ {formatINR(item.amount || 0)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {previewItem.quotationMode !== "options" && (
              <div className="preview-total-box">
                <div className="summary-line">
                  <span>Subtotal</span>
                  <strong>₹ {formatINR(previewItem.subtotal || 0)}</strong>
                </div>

                <div className="summary-line">
                  <span>Discount</span>
                  <strong>₹ {formatINR(previewItem.discount || 0)}</strong>
                </div>

                <div className="summary-line">
                  <span>Discount Percentage</span>
                  <strong>{getDiscountPercent(previewItem)}%</strong>
                </div>

                <div className="summary-line">
                  <span>Base Total After Discount</span>
                  <strong>
                    ₹ {formatINR(previewItem.baseTotalAfterDiscount || 0)}
                  </strong>
                </div>

                {previewItem.documentType !== "Quotation" && (
                  <div className="summary-line">
                    <span>GST (18%)</span>
                    <strong>₹ {formatINR(previewItem.gstTotal || 0)}</strong>
                  </div>
                )}

                {previewItem.enableAdvanceAmount && (
                  <div className="summary-line">
                    <span>Advance Amount</span>
                    <strong>
                      ₹ {formatINR(previewItem.advanceAmount || 0)}
                    </strong>
                  </div>
                )}

                <div className="summary-line total">
                  <span>
                    {previewItem.enableAdvanceAmount
                      ? "Balance Amount"
                      : "Grand Total"}
                  </span>
                  <strong>
                    ₹{" "}
                    {formatINR(
                      previewItem.enableAdvanceAmount
                        ? previewItem.balanceAmount || 0
                        : previewItem.grandTotal || 0
                    )}
                  </strong>
                </div>
              </div>
            )}

            {previewItem.amountInWords && (
              <div className="preview-note-box">
                <span>Amount In Words</span>
                <p>{previewItem.amountInWords}</p>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setPreviewItem(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="btn"
                disabled={downloadingId === previewItem.id}
                onClick={() => handleDownload(previewItem)}
              >
                {downloadingId === previewItem.id
                  ? "Downloading..."
                  : "Download PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteItem && (
        <div className="modal-overlay">
          <div className="modal-card modern-modal">
            <div className="modal-icon danger-icon">!</div>

            <h2>Delete Document?</h2>

            <p>
              Are you sure you want to delete{" "}
              <strong>{deleteItem.documentNumber}</strong>? This action cannot
              be undone.
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
          <div className="modal-card modern-modal edit-modal">
            <h2>Edit Document</h2>

            <p className="modal-subtitle">
              Update basic document information.
            </p>

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

      {popup.show && (
        <div className="modal-overlay">
          <div className="modal-card modern-modal success-modal">
            <div
              className={
                popup.type === "success"
                  ? "modal-icon success-icon"
                  : "modal-icon danger-icon"
              }
            >
              {popup.type === "success" ? "✓" : "!"}
            </div>

            <h2>{popup.title}</h2>
            <p>{popup.message}</p>

            <div className="modal-actions center">
              <button type="button" className="btn" onClick={closePopup}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}