"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import StatsCards from "@/components/StatsCards";
import InvoiceCard from "@/components/InvoiceCard";
import { motion } from "framer-motion";

export default function DashboardPage() {
    const { data: session } = useSession();
    const [invoices, setInvoices] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [setupDone, setSetupDone] = useState(false);
    const [greeting, setGreeting] = useState("");
    const [isExpanding, setIsExpanding] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/invoices/list");
            if (!res.ok) throw new Error("Failed to fetch invoices");
            const data = await res.json();
            setInvoices(data.invoices || []);
            setSummary(data.summary || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const setupSheet = async () => {
        try {
            const res = await fetch("/api/setup-sheet", { method: "POST" });
            if (res.ok) {
                setSetupDone(true);
                fetchData();
            }
        } catch (err) {
            console.error("Setup failed:", err);
        }
    };

    useEffect(() => {
        const hour = new Date().getHours();
        setGreeting(hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening");
    }, []);

    const filteredInvoices = invoices.filter((inv) => {
        const matchesFilter = filter === "all" || inv.status?.toLowerCase() === filter;
        const matchesSearch =
            search === "" ||
            inv.client_name?.toLowerCase().includes(search.toLowerCase()) ||
            inv.client_email?.toLowerCase().includes(search.toLowerCase()) ||
            inv.invoice_id?.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const handleNewInvoiceClick = (e) => {
        e.preventDefault();
        setIsExpanding(true);
        setTimeout(() => {
            window.location.href = "/invoices/new";
        }, 120);
    };

    if (loading && invoices.length === 0) {
        return (
            <div className="dashboard-container">
                <div className="skeleton-header">
                    <div className="skeleton-block" style={{ width: 280, height: 36, borderRadius: 8 }} />
                    <div className="skeleton-block" style={{ width: 160, height: 16, marginTop: 8, borderRadius: 6 }} />
                </div>
                <div className="stats-grid" style={{ marginTop: 32 }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton-card" />
                    ))}
                </div>
                <div className="invoices-grid" style={{ marginTop: 24 }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton-invoice" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <motion.div
            className="dashboard-container"
            animate={isExpanding ? { scale: 0.97, opacity: 0 } : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.12, ease: "easeInOut" }}
        >
            {/* Header */}
            <div className="dash-header fade-in-up" style={{ animationDelay: "0ms" }}>
                <div>
                    <motion.h1
                        className="dash-greeting"
                        style={{ display: 'inline-block' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        {greeting}, {session?.user?.name?.split(" ")[0]}!
                    </motion.h1>
                    <p className="dash-sub mt-2">Here's what's happening with your invoices today.</p>
                </div>
                <div className="header-actions">
                    <button onClick={handleNewInvoiceClick} className="new-invoice-btn-premium">
                        <span>+</span> New Invoice
                    </button>
                </div>
            </div>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <StatsCards summary={summary} />
            </motion.div>

            {/* Filters */}
            <motion.div
                className="dash-controls"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <div className="dash-filters">
                    {["all", "unpaid", "paid", "overdue"].map((f) => (
                        <button
                            key={f}
                            className={`dash-filter ${filter === f ? "active" : ""}`}
                            onClick={() => setFilter(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <div className="dash-search">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search client or ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="dash-search-input"
                    />
                </div>
            </motion.div>

            {/* Invoice Grid */}
            <motion.div
                className="invoices-grid"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
            >
                {filteredInvoices.length > 0 ? (
                    filteredInvoices.map((inv, i) => (
                        <InvoiceCard key={inv.invoice_id} invoice={inv} onRefresh={fetchData} index={i} />
                    ))
                ) : (
                    <div className="empty-state fade-in-up">
                        <p>No invoices found matching your criteria.</p>
                        {invoices.length === 0 && !setupDone && (
                            <button className="dash-new-btn" style={{ marginTop: 16 }} onClick={setupSheet}>
                                Initialize Google Sheet
                            </button>
                        )}
                    </div>
                )}
            </motion.div>

            <style jsx>{`
                .new-invoice-btn-premium {
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: white;
                    height: 44px;
                    padding: 0 20px;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 14px;
                    border: 1px solid rgba(99, 102, 241, 0.5);
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.2s ease;
                }
                .new-invoice-btn-premium:hover {
                    box-shadow: 0 0 25px rgba(99, 102, 241, 0.5);
                    transform: scale(1.04);
                    filter: brightness(1.1);
                }
            `}</style>
        </motion.div>
    );
}
