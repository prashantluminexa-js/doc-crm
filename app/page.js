"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function DashboardPage() {
  const [counts, setCounts] = useState({ clients: 0, documents: 0 });

  useEffect(() => {
    async function loadCounts() {
      const clientsSnap = await getDocs(collection(db, "clients"));
      const docsSnap = await getDocs(collection(db, "documents"));
      setCounts({ clients: clientsSnap.size, documents: docsSnap.size });
    }

    loadCounts();
  }, []);

  return (
    <div>
      <div className="card">
        <h1>Luminexa Technologies</h1>
        <p>Simple admin dashboard for quotations, proforma invoices and invoices.</p>
        <div className="btn-row">
          <Link href="/create-document"><button className="btn">Create Document</button></Link>
          <Link href="/clients"><button className="btn secondary">Add Client</button></Link>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>{counts.clients}</h2>
          <p>Total Clients</p>
        </div>
        <div className="card">
          <h2>{counts.documents}</h2>
          <p>Total Documents</p>
        </div>
      </div>
    </div>
  );
}