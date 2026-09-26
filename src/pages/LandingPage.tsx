import React from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  Boxes, 
  Warehouse, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  Layers, 
  CheckCircle2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface LandingPageProps {
  onNavigateToAuth: (mode: 'login' | 'signup') => void;
  onLaunchDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToAuth, onLaunchDemo }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, duration: 0.25 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' as const } },
  };

  const features = [
    {
      icon: <Activity className="feature-icon" size={24} />,
      title: 'Real-Time Stock Tracking',
      desc: 'Double-entry stock quants track on-hand, reserved, and free-to-use quantities dynamically across all internal zones.',
      tag: 'Live Sync',
    },
    {
      icon: <Warehouse className="feature-icon" size={24} />,
      title: 'Multi-Warehouse Topology',
      desc: 'Model complex supply chains with physical racks, rooms, and virtual partner locations with auto-increment sequences.',
      tag: 'Scale',
    },
    {
      icon: <AlertTriangle className="feature-icon" size={24} />,
      title: 'Automated Low-Stock Alerts',
      desc: 'Proactive alerts flag at-risk products the moment available stock hits reorder thresholds, preventing stockouts.',
      tag: 'Smart',
    },
    {
      icon: <ShieldCheck className="feature-icon" size={24} />,
      title: 'Full Immutable Audit Trail',
      desc: 'Every receipt, delivery, and adjustment is permanently recorded in PostgreSQL with timestamps, items, and users.',
      tag: 'Compliant',
    },
  ];

  return (
    <div className="landing-page-root">
      {/* Background ambient lighting */}
      <div className="ambient-glow glow-top" />
      <div className="ambient-glow glow-bottom" />

      {/* Sticky Top Navigation */}
      <header className="landing-nav">
        <div className="nav-container">
          <div className="nav-brand" onClick={onLaunchDemo} style={{ cursor: 'pointer' }}>
            <div className="brand-mark">S</div>
            <div className="brand-text-block">
              <span className="brand-name">StockSense</span>
              <span className="brand-badge">Enterprise Cloud</span>
            </div>
          </div>

          <nav className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#workflows" className="nav-link">Workflows</a>
            <a href="#architecture" className="nav-link">Architecture</a>
          </nav>

          <div className="nav-actions">
            <button className="landing-ghost-btn" onClick={() => onNavigateToAuth('login')}>
              Sign In
            </button>
            <button className="landing-primary-btn" onClick={() => onNavigateToAuth('signup')}>
              Get Started <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <motion.div
          className="hero-content"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Headline */}
          <motion.h1 variants={itemVariants} className="hero-headline">
            End Inventory Chaos. Master Every Stock Movement in Real Time.
          </motion.h1>

          {/* Subheadline */}
          <motion.p variants={itemVariants} className="hero-subheadline">
            An enterprise-grade inventory engine powered by PostgreSQL and React.
            Streamline inbound receipts, validate outbound dispatches with instant stock
            availability checks, and track complete warehouse history with zero discrepancy.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={itemVariants} className="hero-cta-group">
            <button className="hero-cta-btn primary" onClick={onLaunchDemo}>
              Launch Live Application <ArrowRight size={17} />
            </button>
            <button className="hero-cta-btn secondary" onClick={() => onNavigateToAuth('login')}>
              Sign In to Workspace
            </button>
          </motion.div>

          {/* Trust stats row */}
          <motion.div variants={itemVariants} className="hero-stats-row">
            <div className="stat-item">
              <CheckCircle2 size={16} className="stat-check" />
              <span>PostgreSQL Real Persistence</span>
            </div>
            <div className="stat-item">
              <CheckCircle2 size={16} className="stat-check" />
              <span>Zero Mock Data / No Dead Buttons</span>
            </div>
            <div className="stat-item">
              <CheckCircle2 size={16} className="stat-check" />
              <span>Double-Entry Stock Logic</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Real Screenshot Preview Frame */}
        <motion.div
          className="hero-preview-container"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <div className="browser-mockup">
            <div className="mockup-header">
              <div className="window-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="mockup-address-bar">
                <span>stocksense.internal/dashboard</span>
              </div>
              <div className="mockup-action-tag">Live Working App</div>
            </div>
            <div className="mockup-body" onClick={onLaunchDemo} style={{ cursor: 'pointer' }}>
              <img
                src="/dashboard-preview.png"
                alt="StockSense Enterprise Inventory Dashboard live preview"
                className="dashboard-img"
              />
              <div className="mockup-overlay">
                <button className="overlay-open-btn">
                  Open Interactive Workspace <ExternalLink size={16} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <div className="mini-label">Core Capabilities</div>
          <h2>Engineered for High-Velocity Inventory Operations</h2>
          <p>
            Designed after Odoo’s proven warehouse model, StockSense guarantees accurate
            reconciliation and strict supply chain accountability.
          </p>
        </div>

        <div className="features-grid">
          {features.map((feat, index) => (
            <motion.div
              key={feat.title}
              className="feature-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.28, delay: index * 0.05 }}
            >
              <div className="feature-card-top">
                <div className="feature-icon-wrap">{feat.icon}</div>
                <span className="feature-tag">{feat.tag}</span>
              </div>
              <h3>{feat.title}</h3>
              <p>{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Workflows Pipeline Visual Section */}
      <section id="workflows" className="workflows-section">
        <div className="workflows-card">
          <div className="workflows-content">
            <div className="mini-label">Automated Pipelines</div>
            <h2>Frictionless Receipts & Deliveries</h2>
            <p>
              Move items from suppliers into stock racks with single-click validation.
              Deliveries automatically verify stock availability before dispatch, preventing negative
              balances and keeping your inventory honest.
            </p>
            <ul className="workflow-points">
              <li>
                <CheckCircle2 size={18} className="wf-check" />
                <div>
                  <strong>Inbound Receipts (WH/IN/0001)</strong>
                  <span>Increases on-hand quantities inside atomic PostgreSQL transactions.</span>
                </div>
              </li>
              <li>
                <CheckCircle2 size={18} className="wf-check" />
                <div>
                  <strong>Outbound Deliveries (WH/OUT/0001)</strong>
                  <span>Auto-detects shortages and halts execution until restocked.</span>
                </div>
              </li>
              <li>
                <CheckCircle2 size={18} className="wf-check" />
                <div>
                  <strong>Printable Vouchers & Slips</strong>
                  <span>Generate clean, professional receipts and packing slips on demand.</span>
                </div>
              </li>
            </ul>
            <button className="primary-btn" onClick={onLaunchDemo}>
              Test Stock Operations Now <ArrowRight size={16} />
            </button>
          </div>
          <div className="workflows-visual">
            <div className="pipeline-box">
              <div className="pipeline-title">Stock Movement Pipeline</div>
              <div className="pipeline-steps">
                <div className="p-step active">
                  <span className="p-num">1</span>
                  <div>
                    <strong>Draft</strong>
                    <span>Auto-generated sequence</span>
                  </div>
                </div>
                <div className="p-line" />
                <div className="p-step active">
                  <span className="p-num">2</span>
                  <div>
                    <strong>Stock Check</strong>
                    <span>Free-to-use availability</span>
                  </div>
                </div>
                <div className="p-line" />
                <div className="p-step done">
                  <span className="p-num">3</span>
                  <div>
                    <strong>Validated</strong>
                    <span>Quantities updated in DB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="architecture-section">
        <div className="section-header">
          <div className="mini-label">Modern Stack</div>
          <h2>Clean Architecture. Zero Technical Debt.</h2>
        </div>
        <div className="arch-grid">
          <div className="arch-card">
            <Layers size={22} className="arch-icon" />
            <h4>React 18 + Vite</h4>
            <p>Type-safe components, Framer Motion transitions, and fluid enterprise controls.</p>
          </div>
          <div className="arch-card">
            <Boxes size={22} className="arch-icon" />
            <h4>Express + TypeScript</h4>
            <p>Modular REST API enforcing business rules, stock checks, and sequence generation.</p>
          </div>
          <div className="arch-card">
            <ShieldCheck size={22} className="arch-icon" />
            <h4>PostgreSQL (Port 5432)</h4>
            <p>Relational ACID schema with real-time aggregation queries and indexing.</p>
          </div>
        </div>
      </section>

      {/* Simple Clean Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-left">
            <div className="nav-brand">
              <div className="brand-mark small">S</div>
              <span className="brand-name">StockSense</span>
            </div>
            <p className="footer-copy">
              Enterprise Inventory Platform designed for Odoo x LPU Hackathon.
            </p>
          </div>

          <div className="footer-links">
            <div className="footer-col">
              <h5>Platform</h5>
              <button className="footer-link-btn" onClick={onLaunchDemo}>Dashboard</button>
              <button className="footer-link-btn" onClick={onLaunchDemo}>Receipts</button>
              <button className="footer-link-btn" onClick={onLaunchDemo}>Deliveries</button>
            </div>
            <div className="footer-col">
              <h5>Account</h5>
              <button className="footer-link-btn" onClick={() => onNavigateToAuth('login')}>Sign In</button>
              <button className="footer-link-btn" onClick={() => onNavigateToAuth('signup')}>Create Account</button>
            </div>
            <div className="footer-col">
              <h5>Repository</h5>
              <a
                href="https://github.com/lakotiasaikiran/Odoo-StockSense"
                target="_blank"
                rel="noreferrer"
                className="footer-link"
              >
                GitHub Source <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 StockSense. Local environment verified.</span>
        </div>
      </footer>
    </div>
  );
};
