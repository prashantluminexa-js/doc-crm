"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function Navbar() {
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <nav className="navbar">
      <div>
        <h2>Luminexa Docs</h2>
        <p>Quotation, Proforma & Invoice Generator</p>
      </div>

      <div className="nav-links">
        <Link href="/">Dashboard</Link>
        <Link href="/clients">Clients</Link>
        <Link href="/create-document">Create Document</Link>
        <Link href="/documents">Documents</Link>
        <Link href="/settings">Settings</Link>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}