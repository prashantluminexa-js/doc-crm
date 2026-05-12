"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const emptySettings = {
  companyName: "Luminexa Technologies",
  phone: "",
  email: "",
  gstNumber: "",
  address: "Bangalore, Karnataka",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(emptySettings);
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDocs(collection(db, "settings"));

        if (!snap.empty) {
          setSettingsId(snap.docs[0].id);
          setSettings({
            ...emptySettings,
            ...snap.docs[0].data(),
          });
        }
      } catch (error) {
        console.error(error);
        alert("Failed to load settings");
      }
    }

    loadSettings();
  }, []);

  function handleChange(e) {
    setSettings({
      ...settings,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      if (settingsId) {
        await updateDoc(doc(db, "settings", settingsId), settings);
      } else {
        const ref = await addDoc(collection(db, "settings"), settings);
        setSettingsId(ref.id);
      }

      alert("Settings saved successfully");
    } catch (error) {
      console.error(error);
      alert("Something went wrong while saving settings");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h1>Settings</h1>
        <p>Update company details used in quotation, proforma invoice and invoice PDF.</p>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h2>Company Details</h2>

        <div className="grid">
          <div className="form-group">
            <label>Company Name</label>
            <input
              name="companyName"
              value={settings.companyName}
              onChange={handleChange}
              placeholder="Luminexa Technologies"
              required
            />
          </div>

          <div className="form-group">
            <label>Phone</label>
            <input
              name="phone"
              value={settings.phone}
              onChange={handleChange}
              placeholder="+91 XXXXX XXXXX"
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={settings.email}
              onChange={handleChange}
              placeholder="example@luminexa.in"
            />
          </div>

          <div className="form-group">
            <label>GST Number</label>
            <input
              name="gstNumber"
              value={settings.gstNumber}
              onChange={handleChange}
              placeholder="Company GST Number"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Address</label>
          <textarea
            name="address"
            value={settings.address}
            onChange={handleChange}
            placeholder="Company address"
          />
        </div>

        <button className="btn" disabled={loading}>
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}