"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, PlusCircle, LogOut, Bot, Sparkles } from "lucide-react";

export default function Sidebar() {
    const { data: session } = useSession();
    const pathname = usePathname();

    const navItems = [
        { label: "Dashboard", href: "/dashboard", icon: <LayoutGrid size={18} /> },
        { label: "New Invoice", href: "/invoices/new", icon: <PlusCircle size={18} /> },
        {
            label: "AI Assistant",
            href: "/ai-assistant",
            icon: <Bot size={18} />,
            badge: "AI",
        },
    ];

    const isActive = (href) =>
        href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === href || pathname?.startsWith(href + "/");

    return (
        <aside className="sidebar-premium">
            <div className="sb-glow" />

            <div className="sb-brand">
                <div className="sb-brand-icon">E</div>
                <div>
                    <h1 className="sb-brand-name">ESolution</h1>
                    <span className="sb-brand-sub">Invoice System</span>
                </div>
            </div>

            <nav className="sb-nav">
                <div className="sb-section-label">Menu</div>
                {navItems.map((item, idx) => (
                    <Link
                        key={idx}
                        href={item.href}
                        className={`sb-link-new ${isActive(item.href) ? "active" : ""}`}
                    >
                        <span className="sb-link-icon">{item.icon}</span>
                        <span className="sb-link-label">{item.label}</span>
                        {item.badge && (
                            <span className="sb-badge">
                                <Sparkles size={9} />
                                {item.badge}
                            </span>
                        )}
                    </Link>
                ))}

                <div className="sb-section-label" style={{ marginTop: 24 }}>
                    System
                </div>
                <button
                    className="sb-link-new sb-signout"
                    onClick={() => signOut({ callbackUrl: "/" })}
                >
                    <span className="sb-link-icon">
                        <LogOut size={18} />
                    </span>
                    <span className="sb-link-label">Sign Out</span>
                </button>
            </nav>

            {session?.user && (
                <div className="sb-user">
                    <div className="sb-avatar-wrap">
                        {session.user.image ? (
                            <img
                                src={session.user.image}
                                alt={session.user.name}
                                className="sb-avatar"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="sb-avatar sb-avatar-fallback">
                                {session.user.name?.charAt(0) || "U"}
                            </div>
                        )}
                        <span className="sb-avatar-dot" />
                    </div>
                    <div className="sb-user-info">
                        <div className="sb-user-name">{session.user.name}</div>
                        <div className="sb-user-email">{session.user.email}</div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .sidebar-premium {
                    width: 264px;
                    background:
                        radial-gradient(
                            120% 60% at 0% 0%,
                            rgba(99, 102, 241, 0.06),
                            transparent 60%
                        ),
                        #0d0d0f;
                    border-right: 1px solid rgba(255, 255, 255, 0.06);
                    display: flex;
                    flex-direction: column;
                    padding: 28px 0 20px;
                    position: fixed;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    z-index: 100;
                    overflow: hidden;
                }
                .sb-glow {
                    position: absolute;
                    top: -80px;
                    left: -60px;
                    width: 220px;
                    height: 220px;
                    background: radial-gradient(
                        circle,
                        rgba(99, 102, 241, 0.18),
                        transparent 70%
                    );
                    filter: blur(24px);
                    pointer-events: none;
                }

                /* brand */
                .sb-brand {
                    display: flex;
                    align-items: center;
                    gap: 13px;
                    padding: 0 24px;
                    margin-bottom: 34px;
                    position: relative;
                }
                .sb-brand-icon {
                    width: 42px;
                    height: 42px;
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    border-radius: 13px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 21px;
                    color: white;
                    box-shadow:
                        0 6px 18px rgba(99, 102, 241, 0.4),
                        inset 0 1px 0 rgba(255, 255, 255, 0.25);
                }
                .sb-brand-name {
                    font-size: 19px;
                    font-weight: 800;
                    color: white;
                    letter-spacing: -0.5px;
                    line-height: 1.1;
                }
                .sb-brand-sub {
                    font-size: 11.5px;
                    color: #6b6b78;
                    font-weight: 500;
                    display: block;
                    margin-top: 3px;
                }

                /* nav */
                .sb-nav {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    padding: 0 16px;
                    position: relative;
                }
                .sb-section-label {
                    font-size: 10.5px;
                    font-weight: 700;
                    color: #55555f;
                    text-transform: uppercase;
                    letter-spacing: 1.3px;
                    padding: 14px 12px 8px;
                }

                :global(.sb-link-new) {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                    padding: 0 14px;
                    height: 44px;
                    border-radius: 11px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #8a8a95;
                    transition: all 0.18s ease;
                    cursor: pointer;
                    background: transparent;
                    border: none;
                    text-align: left;
                    width: 100%;
                    position: relative;
                }
                :global(.sb-link-new:hover) {
                    color: #fff;
                    background: rgba(255, 255, 255, 0.04);
                }
                :global(.sb-link-new.active) {
                    background: linear-gradient(
                        135deg,
                        rgba(99, 102, 241, 0.22),
                        rgba(99, 102, 241, 0.08)
                    );
                    color: #fff;
                    box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.35);
                }
                :global(.sb-link-new.active::before) {
                    content: "";
                    position: absolute;
                    left: -16px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 3px;
                    height: 20px;
                    border-radius: 0 3px 3px 0;
                    background: #6366f1;
                    box-shadow: 0 0 10px #6366f1;
                }
                :global(.sb-link-new.active .sb-link-icon) {
                    color: #a5b4fc;
                }
                :global(.sb-link-icon) {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    color: currentColor;
                }
                :global(.sb-link-label) {
                    flex: 1;
                }
                :global(.sb-badge) {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    font-size: 9.5px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    color: #c7d2fe;
                    background: rgba(99, 102, 241, 0.2);
                    border: 1px solid rgba(99, 102, 241, 0.4);
                    padding: 2px 7px;
                    border-radius: 999px;
                }
                :global(.sb-signout:hover) {
                    color: #f87171;
                    background: rgba(239, 68, 68, 0.08);
                }

                /* user */
                .sb-user {
                    margin: 0 14px;
                    padding: 12px;
                    border-radius: 14px;
                    background: rgba(255, 255, 255, 0.025);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    display: flex;
                    align-items: center;
                    gap: 11px;
                }
                .sb-avatar-wrap {
                    position: relative;
                    width: 38px;
                    height: 38px;
                    flex-shrink: 0;
                }
                .sb-avatar {
                    width: 100%;
                    height: 100%;
                    border-radius: 11px;
                    object-fit: cover;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .sb-avatar-fallback {
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 16px;
                    color: white;
                }
                .sb-avatar-dot {
                    position: absolute;
                    bottom: -1px;
                    right: -1px;
                    width: 11px;
                    height: 11px;
                    border-radius: 50%;
                    background: #22c55e;
                    border: 2px solid #0d0d0f;
                }
                .sb-user-info {
                    flex: 1;
                    min-width: 0;
                }
                .sb-user-name {
                    font-size: 13.5px;
                    font-weight: 600;
                    color: white;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .sb-user-email {
                    font-size: 11.5px;
                    color: #6b6b78;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            `}</style>
        </aside>
    );
}
