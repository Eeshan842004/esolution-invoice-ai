"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { ShieldCheck, CheckCircle, Loader2, CreditCard, Building2, Smartphone } from "lucide-react";

export default function PaymentClient({ invoice }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [paymentMethod, setPaymentMethod] = useState("upi"); // "upi" or "card"
    const [status, setStatus] = useState("idle"); // idle, processing, success, redirecting

    const amount = invoice.total_amount_due || invoice.amount;
    const formattedAmount = (amount || 0).toLocaleString("en-IN");

    const handlePayment = async () => {
        setStatus("processing");

        // Step 1: Processing animation for 2s
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 2: Success animation + Confetti
        setStatus("success");
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#10b981", "#3b82f6", "#ffffff"]
        });

        await new Promise((resolve) => setTimeout(resolve, 2500));

        // Step 3: Call API and Redirect
        setStatus("redirecting");

        try {
            await fetch(`/api/invoices/${invoice.invoice_id}/pay`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payment_reference: "ESolution-Pay-Gateway" })
            });
            // Give user a moment to see "Redirecting..."
            setTimeout(() => {
                router.push(`/portal/${invoice.invoice_id}?token=${token}`);
            }, 1000);
        } catch (e) {
            console.error(e);
            setStatus("idle");
        }
    };

    if (invoice.status === "Paid") {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
                <div className="bg-[#111] p-8 rounded-2xl border border-[#333] text-center max-w-sm w-full">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-xl font-medium mb-2">Already Paid</h2>
                    <p className="text-gray-400 mb-6">This invoice has already been settled.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-blue-500/30">
            {/* Top Logo / Secure Header */}
            <div className="flex items-center space-x-2 mb-8">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                    <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight">ESolution <span className="text-blue-500 font-medium">Pay</span></span>
            </div>

            {/* Main Payment Card */}
            <motion.div
                className="w-full max-w-md bg-[#161616] rounded-2xl border border-[#2a2a2a] shadow-2xl overflow-hidden relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {/* --- GREEN SUCCESS OVERLAY --- */}
                <AnimatePresence>
                    {(status === "success" || status === "redirecting") && (
                        <motion.div
                            initial={{ scale: 0, borderRadius: "100%" }}
                            animate={{ scale: 1.5, borderRadius: "0%" }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="absolute inset-0 bg-green-600 z-50 flex flex-col items-center justify-center origin-center"
                        >
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.3, type: "spring" }}
                                className="flex flex-col items-center"
                            >
                                <CheckCircle className="w-24 h-24 text-white mb-4" strokeWidth={1.5} />
                                <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
                                <p className="text-green-100 text-sm">
                                    {status === "redirecting" ? "Redirecting to receipt..." : "Thank you for your business."}
                                </p>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- NORMAL CARD CONTENT --- */}
                <div className="p-6">
                    {/* Invoice Details */}
                    <div className="bg-[#1f1f1f] p-4 rounded-xl mb-6">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Paying To ESolution</p>
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <h1 className="text-3xl font-semibold">₹{formattedAmount}</h1>
                                <p className="text-sm text-gray-400 mt-1">Invoice #{invoice.invoice_id}</p>
                            </div>
                        </div>
                        <div className="flex border-t border-[#333] pt-4 mt-2 justify-between">
                            <span className="text-sm text-gray-400">Billed to</span>
                            <span className="text-sm font-medium">{invoice.client_name}</span>
                        </div>
                    </div>

                    {/* Payment Form Tabs */}
                    <div className="flex mb-6 bg-[#1a1a1a] p-1 rounded-lg border border-[#333]">
                        <button
                            className={`flex-1 flex items-center justify-center space-x-2 py-2 text-sm rounded-md transition-colors ${paymentMethod === "upi" ? "bg-[#2a2a2a] text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
                            onClick={() => setPaymentMethod("upi")}
                        >
                            <Smartphone className="w-4 h-4" />
                            <span>UPI</span>
                        </button>
                        <button
                            className={`flex-1 flex items-center justify-center space-x-2 py-2 text-sm rounded-md transition-colors ${paymentMethod === "card" ? "bg-[#2a2a2a] text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
                            onClick={() => setPaymentMethod("card")}
                        >
                            <CreditCard className="w-4 h-4" />
                            <span>Card</span>
                        </button>
                    </div>

                    {/* Inputs */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={paymentMethod}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="space-y-4 mb-6"
                        >
                            {paymentMethod === "upi" ? (
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5 ml-1">Virtual Payment Address (UPI ID)</label>
                                    <input
                                        type="text"
                                        placeholder="example@upi"
                                        className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1.5 ml-1">Card Number</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="•••• •••• •••• ••••"
                                                className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 pl-10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                            />
                                            <CreditCard className="w-5 h-5 text-gray-500 absolute left-3 top-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex space-x-4">
                                        <div className="flex-1">
                                            <label className="block text-xs text-gray-400 mb-1.5 ml-1">Expiry</label>
                                            <input type="text" placeholder="MM/YY" className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs text-gray-400 mb-1.5 ml-1">CVV</label>
                                            <input type="password" placeholder="•••" className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Pay Button */}
                    <button
                        onClick={handlePayment}
                        disabled={status !== "idle"}
                        className="w-full relative group overflow-hidden bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 rounded-xl transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-0.5 disabled:opacity-80 disabled:hover:translate-y-0 disabled:hover:bg-blue-600 disabled:cursor-not-allowed"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <span className="relative flex items-center justify-center space-x-2 z-10">
                            {status === "processing" ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <span>Pay ₹{formattedAmount} securely</span>
                            )}
                        </span>
                    </button>

                </div>
            </motion.div>

            {/* Bottom Security Badges */}
            <div className="mt-8 flex flex-col items-center space-y-2 opacity-60">
                <div className="flex items-center space-x-1.5 text-xs text-gray-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>256-bit SSL Secured Process</span>
                </div>
                <div className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">
                    Powered by ESolution Pay
                </div>
            </div>
        </div>
    );
}
