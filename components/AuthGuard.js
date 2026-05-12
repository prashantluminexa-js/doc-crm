"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && pathname !== "/login") {
        router.push("/login");
      }

      if (user && pathname === "/login") {
        router.push("/");
      }

      setChecking(false);
    });

    return () => unsubscribe();
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="auth-loading">
        <p>Loading...</p>
      </div>
    );
  }

  return children;
}