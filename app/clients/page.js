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

  function handleEdit(item) {
    setEditingId(item.id);

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

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setClient(emptyClient);
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
        alert("Client updated successfully");
      } else {
        await addDoc(collection(db, "clients"), {
          ...clientData,
          createdAt: serverTimestamp(),
        });
        alert("Client saved successfully");
      }

      setClient(emptyClient);
      setEditingId(null);
      await loadClients();
    } catch (error) {
      console.error(error);
      alert("Something went wrong while saving client");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h1>Clients</h1>
        <p>Add and manage client details.</p>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h2>{editingId ? "Edit Client" : "Add Client"}</h2>

        <h2>Company Details</h2>

        <div className="grid">
          <div className="form-group">
            <label>Company Name</label>
            <input
              name="companyName"
              value={client.companyName}
              onChange={handleChange}
              required
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
            <select name="status" value={client.status} onChange={handleChange}>
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
          />
        </div>

        <h2>Contact Person Details</h2>

        <div className="grid">
          <div className="form-group">
            <label>Contact Name</label>
            <input
              name="contactName"
              value={client.contactName}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Contact Designation</label>
            <input
              name="contactDesignation"
              value={client.contactDesignation}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Contact Phone</label>
            <input
              name="contactPhone"
              value={client.contactPhone}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Contact Email</label>
            <input
              type="email"
              name="contactEmail"
              value={client.contactEmail}
              onChange={handleChange}
            />
          </div>
        </div>

        <h2>Billing Details</h2>

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

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button className="btn" disabled={loading}>
            {loading
              ? editingId
                ? "Updating..."
                : "Saving..."
              : editingId
              ? "Update Client"
              : "Save Client"}
          </button>

          {editingId && (
            <button
              type="button"
              className="btn secondary"
              onClick={handleCancelEdit}
              disabled={loading}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <h2>Client List</h2>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Category</th>
                <th>Status</th>
                <th>GSTIN</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {clients.map((item) => (
                <tr key={item.id}>
                  <td>{item.companyName || "-"}</td>
                  <td>{item.contactName || "-"}</td>
                  <td>{item.contactPhone || "-"}</td>
                  <td>{item.businessCategory || "-"}</td>
                  <td>{item.status || "-"}</td>
                  <td>{item.gstin || item.billingGSTIN || "-"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => handleEdit(item)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {!clients.length && (
                <tr>
                  <td colSpan="7">No clients found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}