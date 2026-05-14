"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const emptyClient = {
  companyName: "",
  companyAddress: "",
  businessCategory: "",
  website: "",
  gstin: "",
  contactName: "",
  contactDesignation: "",
  contactPhone: "",
  contactEmail: "",
  status: "active",
  dealValue: 0,
  billingName: "",
  billingAddress: "",
};

export default function ClientsPage() {
  const [client, setClient] = useState(emptyClient);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [popup, setPopup] = useState({
    show: false,
    type: "success",
    title: "",
    message: "",
  });

  function showPopup(type, title, message) {
    setPopup({ show: true, type, title, message });
  }

  function closePopup() {
    setPopup({ show: false, type: "success", title: "", message: "" });
  }

  async function loadClients() {
    const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    setClients(
      snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    );
  }

  useEffect(() => {
    loadClients();
  }, []);

  function handleChange(e) {
    setClient({
      ...client,
      [e.target.name]: e.target.value,
    });
  }

  function handleAddClient() {
    setEditingId(null);
    setClient(emptyClient);
    setShowForm(true);

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setShowForm(true);

    setClient({
      companyName: item.companyName || "",
      companyAddress: item.companyAddress || "",
      businessCategory: item.businessCategory || "",
      website: item.website || "",
      gstin: item.gstin || item.billingGSTIN || "",
      contactName: item.contactName || "",
      contactDesignation: item.contactDesignation || "",
      contactPhone: item.contactPhone || "",
      contactEmail: item.contactEmail || "",
      status: item.status || "active",
      dealValue: item.dealValue || 0,
      billingName: item.billingName || "",
      billingAddress: item.billingAddress || "",
    });

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setClient(emptyClient);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const clientData = {
        ...client,
        gstin: client.gstin?.toUpperCase() || "",
        dealValue: Number(client.dealValue || 0),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "clients", editingId), clientData);

        showPopup(
          "success",
          "Client Updated",
          `${client.companyName || "Client"} updated successfully.`
        );
      } else {
        await addDoc(collection(db, "clients"), {
          ...clientData,
          createdAt: serverTimestamp(),
        });

        showPopup(
          "success",
          "Client Saved",
          `${client.companyName || "Client"} saved successfully.`
        );
      }

      setClient(emptyClient);
      setEditingId(null);
      setShowForm(false);
      await loadClients();
    } catch (error) {
      console.error(error);

      showPopup(
        "error",
        "Save Failed",
        "Something went wrong while saving client."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="clients-page">
      <div className="clients-hero">
        <div>
          <p className="clients-eyebrow">Client Management</p>
          <h1>Clients</h1>
          <p>Add, update and manage your client billing and contact details.</p>
        </div>

        <div className="clients-count-card">
          <span>Total Clients</span>
          <strong>{clients.length}</strong>
        </div>
      </div>

      {showForm && (
        <form className="client-form-card" onSubmit={handleSubmit}>
          <div className="client-form-header">
            <div>
              <p className="clients-eyebrow">
                {editingId ? "Update Details" : "New Client"}
              </p>
              <h2>{editingId ? "Edit Client" : "Add Client"}</h2>
            </div>

            <button
              type="button"
              className="btn secondary"
              onClick={handleCancelEdit}
              disabled={loading}
            >
              Close Form
            </button>
          </div>

          <div className="client-section">
            <h3>Company Details</h3>

            <div className="grid">
              <div className="form-group">
                <label>Company Name</label>
                <input
                  name="companyName"
                  value={client.companyName}
                  onChange={handleChange}
                  required
                  placeholder="Enter company name"
                />
              </div>

              <div className="form-group">
                <label>Business Category</label>
                <input
                  name="businessCategory"
                  value={client.businessCategory}
                  onChange={handleChange}
                  placeholder="Real Estate"
                />
              </div>

              <div className="form-group">
                <label>Website</label>
                <input
                  name="website"
                  value={client.website}
                  onChange={handleChange}
                  placeholder="https://example.com"
                />
              </div>

              <div className="form-group">
                <label>GSTIN</label>
                <input
                  name="gstin"
                  value={client.gstin}
                  onChange={handleChange}
                  placeholder="GSTIN"
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={client.status}
                  onChange={handleChange}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Company Address</label>
              <textarea
                name="companyAddress"
                value={client.companyAddress}
                onChange={handleChange}
                placeholder="Enter company address"
              />
            </div>
          </div>

          <div className="client-section">
            <h3>Contact Person Details</h3>

            <div className="grid">
              <div className="form-group">
                <label>Contact Name</label>
                <input
                  name="contactName"
                  value={client.contactName}
                  onChange={handleChange}
                  placeholder="Contact person name"
                />
              </div>

              <div className="form-group">
                <label>Contact Designation</label>
                <input
                  name="contactDesignation"
                  value={client.contactDesignation}
                  onChange={handleChange}
                  placeholder="Manager / Director"
                />
              </div>

              <div className="form-group">
                <label>Contact Phone</label>
                <input
                  name="contactPhone"
                  value={client.contactPhone}
                  onChange={handleChange}
                  placeholder="Phone number"
                />
              </div>

              <div className="form-group">
                <label>Contact Email</label>
                <input
                  type="email"
                  name="contactEmail"
                  value={client.contactEmail}
                  onChange={handleChange}
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>

          <div className="client-section">
            <h3>Billing Details</h3>

            <div className="grid">
              <div className="form-group">
                <label>Billing Name</label>
                <input
                  name="billingName"
                  value={client.billingName}
                  onChange={handleChange}
                  placeholder="Billing name"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Billing Address</label>
              <textarea
                name="billingAddress"
                value={client.billingAddress}
                onChange={handleChange}
                placeholder="Billing address"
              />
            </div>
          </div>

          <div className="client-form-actions">
            <button className="btn" disabled={loading}>
              {loading
                ? editingId
                  ? "Updating..."
                  : "Saving..."
                : editingId
                ? "Update Client"
                : "Save Client"}
            </button>
          </div>
        </form>
      )}

      <div className="clients-list-card">
        <div className="client-list-header">
          <div>
            <h2>Client List</h2>
            <p>All saved clients are shown here.</p>
          </div>

          <button type="button" className="btn" onClick={handleAddClient}>
            + Add Client
          </button>
        </div>

        <div className="modern-table-wrap">
          <table className="modern-table clients-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Category</th>
                <th>Status</th>
                <th>GSTIN</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {clients.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="client-company-info">
                      <strong>{item.companyName || "-"}</strong>
                      <span>{item.website || "No website"}</span>
                    </div>
                  </td>

                  <td>{item.contactName || "-"}</td>
                  <td>{item.contactPhone || "-"}</td>
                  <td>{item.businessCategory || "-"}</td>

                  <td>
                    <span className={`client-status ${item.status || "active"}`}>
                      {item.status || "active"}
                    </span>
                  </td>

                  <td>{item.gstin || item.billingGSTIN || "-"}</td>

                  <td>
                    <div className="action-buttons right">
                      <button
                        type="button"
                        className="icon-btn secondary"
                        onClick={() => handleEdit(item)}
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!clients.length && (
                <tr>
                  <td colSpan="7">
                    <div className="empty-table-text">No clients found.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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