"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Bell, Activity } from "lucide-react";

// Flame Component
const Flame = ({ size }) => (
  <div style={{
    position: 'absolute',
    bottom: -size + 10,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 30,
    height: size,
    background: 'linear-gradient(to bottom, #ff6b00, #ffcc00, transparent)',
    borderRadius: '50% 50% 20% 20%',
    animation: 'flicker 0.1s infinite alternate',
    filter: 'blur(2px)',
    zIndex: 0
  }} />
);

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isExiting, setIsExiting] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [introPhase, setIntroPhase] = useState("checking"); // checking | playing | finished
  const [frame, setFrame] = useState(1);
  const [phase, setPhase] = useState("idle");

  const stars = useMemo(() => Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 80,
    y: Math.random() * 800,
    delay: Math.random() * 0.5
  })), []);

  // Check intro status on mount
  useEffect(() => {
    const hasPlayed = sessionStorage.getItem("esolution_intro_played");
    if (hasPlayed) {
      setIntroPhase("finished");
    } else {
      setIntroPhase("playing");
      setTimeout(() => {
        setIntroPhase("finished");
        sessionStorage.setItem("esolution_intro_played", "true");
      }, 2000); // 2 second total intro
    }
  }, []);

  // Mouse tracking for character eyes & background glow
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 30;
      setEyePos({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Handle right-side looping story animation (6 frames, 1s each)
  useEffect(() => {
    if (introPhase !== "finished") return;
    const interval = setInterval(() => {
      setFrame((prev) => (prev % 6) + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [introPhase]);

  useEffect(() => {
    if (session && !isExiting) {
      router.push("/dashboard");
    }
  }, [session, router, isExiting]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-t-[#3b82f6] border-[#222] rounded-full animate-spin" />
      </div>
    );
  }

  const handleSignIn = async () => {
    if (isLoadingGoogle) return;
    setIsLoadingGoogle(true);

    // Phase 1: Transform
    setPhase("transform");
    await new Promise((r) => setTimeout(r, 300));

    // Phase 2: Thrust buildup
    setPhase("thrust");
    await new Promise((r) => setTimeout(r, 300));

    // Phase 3 & 4: Launch and Transition
    setPhase("launch");
    await new Promise((r) => setTimeout(r, 800));

    setPhase("transition");
    await new Promise((r) => setTimeout(r, 600));

    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <>
      {/* Background Cursor Glow */}
      <div
        className="cursor-glow"
        style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}
      />

      <AnimatePresence>
        {/* Intro Animation Overlay */}
        {introPhase === "playing" && (
          <motion.div
            className="intro-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <motion.div
              className="intro-text"
              initial={{ scale: 0.3 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.29, x: "-45vw", y: "-45vh", opacity: 0 }}
              transition={{
                scale: { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] },
                exit: { duration: 0.5, ease: "easeInOut", delay: 0.6 }
              }}
            >
              ESolution
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {introPhase === "finished" && (
          <div style={{ position: 'relative', overflow: 'hidden', height: '100vh', width: '100vw' }}>

            {/* Login page - slides UP */}
            <motion.div
              className={`split-layout ${isExiting ? "page-exiting" : ""}`}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              initial={{ opacity: 0 }}
              animate={
                phase === 'transition' ? { y: '-100vh', x: 0, filter: 'blur(0px)' } :
                  phase === 'thrust' ? { x: [-3, 3, -3], filter: ['blur(0px)', 'blur(1px)', 'blur(0px)'] } :
                    { y: 0, x: 0, opacity: 1, filter: 'blur(0px)' }
              }
              transition={{
                x: { repeat: Infinity, duration: 0.1 },
                filter: { repeat: Infinity, duration: 0.1 },
                y: { duration: 0.6, ease: "easeIn" }
              }}
            >
              {/* Tracking Character bottom-center */}
              <div className="character-tracker" style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 60, pointerEvents: 'none' }}>

                {phase === 'launch' && stars.map(star => (
                  <motion.div
                    key={star.id}
                    initial={{ opacity: 1, y: -star.y, x: star.x }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.5, delay: star.delay }}
                    style={{
                      position: 'absolute', width: '4px', height: '4px', background: 'white',
                      borderRadius: '50%', bottom: '80px', left: '50%', marginLeft: '-2px'
                    }}
                  />
                ))}

                <motion.div
                  id="anime-character"
                  className={`character-wrapper ${phase === "idle" ? "breathe-anim" : ""}`}
                  animate={{
                    scaleY: phase !== 'idle' ? 1.8 : 1,
                    scaleX: phase === 'idle' ? 1 : phase === 'transform' ? 0.55 : 0.5,
                    y: (phase === 'launch' || phase === 'transition') ? -1200 : 0,
                    rotate: 0
                  }}
                  transition={{
                    y: { duration: 0.8, ease: [0.2, 0, 0.8, 1] },
                    scaleY: { duration: 0.3 },
                    scaleX: { duration: 0.3 }
                  }}
                  style={{ width: "160px", height: "160px", position: "relative" }}
                >
                  <div className="ch-body">
                    <div className="ch-head" style={phase !== 'idle' ? { borderRadius: '50% 50% 10px 10px', transition: 'border-radius 0.3s' } : { transition: 'border-radius 0.3s' }}>
                      <div className="ch-face">
                        <div className="ch-eyes" style={phase !== 'idle' ? { transform: 'translateY(-20px)', transition: 'transform 0.3s' } : { transition: 'transform 0.3s' }}>
                          <div className="ch-eye">
                            <div className="ch-pupil" style={phase === "idle" ? { transform: `translate(${eyePos.x}px, ${eyePos.y}px)` } : {}} />
                          </div>
                          <div className="ch-eye">
                            <div className="ch-pupil" style={phase === "idle" ? { transform: `translate(${eyePos.x}px, ${eyePos.y}px)` } : {}} />
                          </div>
                        </div>
                        <div className="ch-mouth" style={{ opacity: phase !== 'idle' ? 0 : 1, transition: 'opacity 0.2s' }}></div>
                      </div>
                    </div>
                    <div className="ch-torso">
                      <div className="ch-arm ch-arm-left" style={{ opacity: phase !== 'idle' ? 0 : 1, transition: 'opacity 0.2s' }} />
                      <div className="ch-arm ch-arm-right" style={{ opacity: phase !== 'idle' ? 0 : 1, transition: 'opacity 0.2s' }} />
                    </div>
                    <div className="ch-legs" style={{ opacity: phase !== 'idle' ? 0 : 1, transition: 'opacity 0.2s' }}>
                      <div className="ch-leg ch-leg-left"></div>
                      <div className="ch-leg ch-leg-right"></div>
                    </div>

                    {(phase === 'transform' || phase === 'thrust' || phase === 'launch' || phase === 'transition') && (
                      <Flame size={phase === 'transform' ? 20 : (phase === 'thrust' ? 60 : 200)} />
                    )}
                  </div>
                </motion.div>
              </div>

              {/* LEFT PANEL */}
              <div className="split-left">
                {/* Logo top-left */}
                <motion.div
                  className="brand-logo"
                  style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 20 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <div className="brand-icon">E</div>
                  <span>ESolution</span>
                </motion.div>

                {/* Center Content */}
                <div className="left-content">
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  >
                    Get Paid <span className="text-blue">Faster.</span>
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="subtitle"
                  >
                    AI invoice tracker for Indian freelancers
                  </motion.p>

                  <motion.div
                    className="features-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  >
                    <motion.div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
                      <div className="f-icon"><Mic size={18} /></div>
                      <span style={{ fontSize: '15px', fontWeight: 500, color: '#dddddd' }}>Voice-powered invoice creation</span>
                    </motion.div>
                    <motion.div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.75 }}>
                      <div className="f-icon"><Bell size={18} /></div>
                      <span style={{ fontSize: '15px', fontWeight: 500, color: '#dddddd' }}>Automated payment reminders</span>
                    </motion.div>
                    <motion.div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 }}>
                      <div className="f-icon"><Activity size={18} /></div>
                      <span style={{ fontSize: '15px', fontWeight: 500, color: '#dddddd' }}>AI Client behavior scoring</span>
                    </motion.div>
                  </motion.div>

                  <motion.button
                    id="google-btn"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 1.1 }}
                    whileHover={{ scale: 1.02, boxShadow: "0 12px 30px rgba(255,255,255,0.15)" }}
                    whileTap={{ scale: 0.98 }}
                    className={`google-btn-new ${isLoadingGoogle ? 'loading' : ''}`}
                    onClick={handleSignIn}
                    disabled={isLoadingGoogle}
                  >
                    {isLoadingGoogle && <div className="btn-shimmer" />}
                    <div className="btn-loader"></div>
                    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span style={{ position: 'relative', zIndex: 1 }}>Continue with Google</span>
                  </motion.button>
                </div>
              </div>

              {/* RIGHT PANEL - Looping Story UI */}
              <div className="split-right">
                <div className="right-bg-radial" />
                <div className="right-grid-bg" />

                <div className="story-container">
                  <AnimatePresence mode="wait">

                    {/* FRAME 1: Empty Dashboard */}
                    {frame === 1 && (
                      <motion.div key="f1" className="story-frame" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <h2 className="story-title typewriter">Good Morning, Rahul!</h2>
                        <div className="story-stats">
                          <div className="s-card"><div className="s-icon bg-blue" /><div><span>Total Revenue</span><strong>₹0</strong></div></div>
                          <div className="s-card"><div className="s-icon bg-green" /><div><span>Paid</span><strong>0 Invoices</strong></div></div>
                        </div>
                      </motion.div>
                    )}

                    {/* FRAME 2: Filling Form */}
                    {frame === 2 && (
                      <motion.div key="f2" className="story-frame" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <div className="s-form">
                          <div className="s-input"><span className="typewriter">Acme Corp</span></div>
                          <div className="s-input"><span className="typewriter" style={{ animationDelay: '0.3s' }} >₹25,000</span></div>
                          <div className="s-input"><span>Oct 24, 2024</span></div>
                        </div>
                      </motion.div>
                    )}

                    {/* FRAME 3: Button Click & Success */}
                    {frame === 3 && (
                      <motion.div key="f3" className="story-frame flex-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="s-btn" animate={{ scale: [1, 0.95, 1], backgroundColor: ["#3b82f6", "#22c55e", "#22c55e"] }} transition={{ duration: 0.6 }}>
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>✓ Invoice Sent!</motion.div>
                        </motion.div>
                      </motion.div>
                    )}

                    {/* FRAME 4: Dashboard Updates (Unpaid) */}
                    {frame === 4 && (
                      <motion.div key="f4" className="story-frame" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="story-stats">
                          <div className="s-card"><div className="s-icon bg-blue" /><div><span>Outstanding</span><strong>₹25,000</strong></div></div>
                        </div>
                        <motion.div className="s-invoice" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
                          <div className="si-left"><div className="si-avatar" /><div className="si-lines"><div className="si-l1" /><div className="si-l2" /></div></div>
                          <div className="si-badge si-unpaid">Unpaid</div>
                        </motion.div>
                      </motion.div>
                    )}

                    {/* FRAME 5: Email Reminder & Paid */}
                    {frame === 5 && (
                      <motion.div key="f5" className="story-frame" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="s-toast" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>✉ Reminder sent to Acme Corp</motion.div>
                        <motion.div className="s-invoice mt-4" >
                          <div className="si-left"><div className="si-avatar" /><div className="si-lines"><div className="si-l1" /><div className="si-l2" /></div></div>
                          <motion.div className="si-badge" animate={{ backgroundColor: ["rgba(245,158,11,0.1)", "rgba(34,197,94,0.1)"], color: ["#f59e0b", "#22c55e"] }}>Paid</motion.div>
                        </motion.div>
                      </motion.div>
                    )}

                    {/* FRAME 6: Confetti & Final Stats */}
                    {frame === 6 && (
                      <motion.div key="f6" className="story-frame" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <h2 className="story-title text-green">Payment Received! 🎉</h2>
                        <div className="story-stats">
                          <div className="s-card"><div className="s-icon bg-blue" /><div><span>Total Revenue</span><strong>₹8,45,000</strong></div></div>
                          <div className="s-card"><div className="s-icon bg-green" /><div><span>Paid</span><strong>12 Invoices</strong></div></div>
                        </div>
                      </motion.div>
                    )}

                  </AnimatePresence>

                  <div className="join-caption">
                    Join 500+ freelancers managing their invoices with AI.
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Dashboard preview - rises from BOTTOM */}
            <motion.div
              initial={{ y: '100vh' }}
              animate={phase === 'transition' ? { y: 0 } : { y: '100vh' }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{
                position: 'absolute', width: '100%', height: '100%',
                background: '#0a0a0a', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 100
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <div className="w-8 h-8 border-2 border-t-[#3b82f6] border-[#222] rounded-full animate-spin" />
                <p style={{ color: '#666', fontSize: '18px', fontWeight: 500 }}>Loading ESolution...</p>
              </div>
            </motion.div>

          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        /* Global & Layout */
        .cursor-glow {
          position: fixed; top: 0; left: 0; pointer-events: none; z-index: 9999;
          width: 300px; height: 300px; margin-left:-150px; margin-top:-150px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 70%);
          filter: blur(80px);
        }

        /* Intro Animation */
        .intro-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: #000;
          display: flex; align-items: center; justify-content: center;
        }
        .intro-text {
          font-size: 48px; font-weight: 800; color: white;
          letter-spacing: -1px;
        }

        .split-layout {
          display: flex !important; flex-direction: row !important; flex-wrap: nowrap !important;
          height: 100vh !important; width: 100vw !important; box-sizing: border-box !important;
          overflow: hidden !important; background: #0a0a0a !important; color: white !important;
        }
        .page-exiting { opacity: 0; pointer-events: none; }

        /* LEFT PANEL */
        .split-left {
          display: flex !important; flex-direction: column !important; justify-content: center !important;
          padding: 60px !important; background: #0a0a0a !important; position: relative !important;
          width: 50vw !important; height: 100vh !important; box-sizing: border-box !important;
        }

        .brand-logo {
          display: flex; align-items: center; gap: 12px;
          font-weight: 700; font-size: 20px; letter-spacing: -0.5px;
        }
        .brand-icon {
          width: 40px; height: 40px; background: #3b82f6; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 18px;
        }

        .left-content { max-width: 480px; position: relative; z-index: 10; width: 100%; }
        .left-content h1 {
          font-size: 56px; line-height: 1.1; font-weight: 800;
          letter-spacing: -2px; margin-bottom: 16px;
        }
        .text-blue { color: #3b82f6; }

        .subtitle { font-size: 18px; color: #777777; margin-bottom: 40px; line-height: 1.6; }

        .features-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 48px; }
        .feature-item { display: flex; align-items: center; gap: 16px; font-size: 15px; font-weight: 500; color: #dddddd; }
        .f-icon {
          width: 32px; height: 32px; background: #161616; border: 1px solid #222222; border-radius: 8px;
          display: flex; align-items: center; justify-content: center; color: #3b82f6;
        }

        /* Google Button */
        .google-btn-new {
          width: 380px; max-width: 100%; height: 52px; background: white; color: black; border: none; border-radius: 10px;
          font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 12px;
          cursor: pointer; position: relative; overflow: hidden;
        }
        .google-btn-new.loading { color: transparent; pointer-events: none; }
        .google-btn-new.loading svg { opacity: 0; }
        .btn-shimmer {
          position: absolute; top:0; left:0; right:0; bottom:0;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.05), transparent);
          background-size: 200% 100%; animation: shimmer 1.5s infinite linear;
        }
        .btn-loader {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 20px; height: 20px; border: 2px solid rgba(0,0,0,0.1); border-top-color: black;
          border-radius: 50%; animation: spin 0.8s linear infinite; opacity: 0;
        }
        .google-btn-new.loading .btn-loader { opacity: 1; }

        /* Character */
        .character-tracker {
          /* positioned dynamically via inline style */
        }
        .character-wrapper { width: 160px; height: 160px; }
        .breathe-anim { animation: breathe 4s ease-in-out infinite; transform-origin: bottom center; }
        .ch-body { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
        .ch-head {
          width: 90px; height: 80px; background: #1a1a1a; border-radius: 45px 45px 30px 30px;
          border: 2px solid #333; position: relative; z-index: 2;
        }
        .ch-torso {
          width: 65px; height: 65px; background: #3b82f6; border-radius: 25px 25px 0 0;
          margin-top: -15px; z-index: 1; position: relative;
        }
        .ch-legs { display: flex; gap: 15px; margin-top: -5px; z-index: 0; }
        .ch-leg { width: 18px; height: 30px; background: #1a1a1a; border-radius: 9px; }
        .ch-face { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
        .ch-eyes { display: flex; gap: 12px; }
        .ch-eye { width: 22px; height: 26px; background: white; border-radius: 13px; position: relative; overflow: hidden; }
        .ch-pupil { position: absolute; width: 12px; height: 12px; background: #0a0a0a; border-radius: 50%; }
        .ch-mouth { width: 16px; height: 6px; border-bottom: 2px solid #555; border-radius: 0 0 10px 10px; }
        
        .ch-arm { position: absolute; width: 16px; height: 40px; background: #3b82f6; border-radius: 8px; top: 10px; z-index: 2; transform-origin: top center; }
        .ch-arm-left { left: -10px; }
        .ch-arm-right { right: -10px; }

        @keyframes flicker {
          0% { transform: translateX(-50%) scaleX(1) }
          100% { transform: translateX(-50%) scaleX(0.85) }
        }

        /* RIGHT PANEL - Story Area */
        .split-right {
          display: flex !important; flex-direction: column !important; justify-content: center !important; align-items: center !important;
          background: #0f0f0f !important; border-left: 1px solid #1a1a1a !important; padding: 40px !important;
          overflow: hidden !important; width: 50vw !important; height: 100vh !important; box-sizing: border-box !important;
        }
        .right-bg-radial {
          position: absolute; bottom: 0; left: 0; right: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;
          background: radial-gradient(ellipse at 0% 100%, rgba(59, 130, 246, 0.04) 0%, transparent 60%);
        }
        .right-grid-bg {
          position: absolute; inset: 0; z-index: 0;
          background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 30px 30px;
        }

        .story-container {
          position: relative; z-index: 10; width: 100%; max-width: 480px; height: 400px;
          display: flex; flex-direction: column;
        }

        /* Story Frames & Components */
        .story-frame {
          position: absolute; inset: 0; width: 100%; height: 100%;
          display: flex; flex-direction: column; justify-content: center; gap: 24px;
        }
        .flex-center { align-items: center; }

        .story-title { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 8px; margin-top:0;}
        .text-green { color: #22c55e !important; }

        .story-stats { display: flex; gap: 16px; width: 100%; }
        .s-card {
          flex: 1; background: #161616; border: 1px solid #222; border-radius: 16px; padding: 16px;
          display: flex; align-items: center; gap: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .s-icon { width: 36px; height: 36px; border-radius: 10px; }
        .bg-blue { background: rgba(59, 130, 246, 0.2); }
        .bg-green { background: rgba(34, 197, 94, 0.2); }
        .s-card span { display:block; font-size: 11px; color: #777; text-transform: uppercase; margin-bottom: 2px;}
        .s-card strong { font-size: 20px; color: white; display:block;}

        .s-form {
          background: #161616; border: 1px solid #222; border-radius: 16px; padding: 24px;
          display: flex; flex-direction: column; gap: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .s-input {
          height: 48px; background: #0a0a0a; border: 1px solid #333; border-radius: 8px;
          display: flex; align-items: center; padding: 0 16px; color: #fff; font-size: 15px; font-weight: 500;
        }

        .s-btn {
          height: 52px; width: 60%; border-radius: 26px; box-shadow: 0 10px 25px rgba(34,197,94,0.3);
          display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px;
        }

        .s-invoice {
          background: #161616; border: 1px solid #222; border-radius: 16px; padding: 24px;
          display: flex; align-items: center; justify-content: space-between; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .si-left { display: flex; align-items: center; gap: 16px; }
        .si-avatar { width: 44px; height: 44px; border-radius: 50%; background: #222; }
        .si-lines { display: flex; flex-direction: column; gap: 8px; width: 140px; }
        .si-l1 { height: 10px; width: 100%; background: #333; border-radius: 5px; }
        .si-l2 { height: 8px; width: 60%; background: #222; border-radius: 4px; }
        .si-badge { padding: 6px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; }
        .si-unpaid { background: rgba(245,158,11,0.1); color: #f59e0b; }

        .s-toast {
          background: #1a1a1a; border: 1px solid #333; padding: 12px 20px; border-radius: 12px;
          display: inline-flex; align-items: center; gap: 10px; color: #fff; font-size: 14px; font-weight: 500; align-self: center;
        }

        .join-caption {
          position: absolute; bottom: 0; width: 100%; text-align: center;
          font-size: 14px; color: #444; font-weight: 500;
        }

        /* Utils & Keyframes */
        .typewriter {
          overflow: hidden; white-space: nowrap; border-right: 2px solid #3b82f6; width: 0;
          animation: typing 0.8s steps(20, end) forwards, blink 0.7s infinite;
        }
        @keyframes typing { from { width: 0 } to { width: 100% } }
        @keyframes blink { 50% { border-color: transparent } }
        @keyframes shimmer { 100% { background-position: -200% 0; } }
        @keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02) translateY(-2px); } }

        @media (max-width: 900px) {
          .split-layout { flex-direction: column; }
          .split-left { justify-content: center; padding: 40px 30px; }
          .split-right { display: none; }
          .character-wrapper { display: none; }
        }
      `}</style>
    </>
  );
}
