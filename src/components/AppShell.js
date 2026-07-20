"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";

/**
 * Shared authenticated app frame: NextAuth guard + Sidebar + main column.
 * Used by the dashboard, invoices and ai-assistant route layouts so the
 * guard logic lives in exactly one place.
 */
export default function AppShell({ children }) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        }
    }, [status, router]);

    if (status === "loading") {
        return (
            <div className="login-page">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p style={{ color: "var(--text-muted)", marginTop: "16px" }}>Loading...</p>
                </div>
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
