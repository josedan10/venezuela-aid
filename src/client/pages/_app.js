import '../styles/globals.css';
import React, { useEffect } from 'react';
import Head from 'next/head';
import { AuthProvider } from '../context/AuthContext';
import { unregisterStaleServiceWorkers } from '../utils/serviceWorkerCleanup';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    unregisterStaleServiceWorkers();
  }, []);

  return (
    <AuthProvider>
      <Head>
        <title>AyudaVenezuela - Plataforma de Coordinación de Ayuda</title>
      </Head>
      
      <header className="app-header glass">
        <div className="header-container">
          <div className="logo-section">
            <span className="logo-icon">🇻🇪</span>
            <span className="logo-text">Ayuda<span className="logo-accent">Venezuela</span></span>
          </div>
          <div className="badge-section">
            <span className="badge-dot"></span>
            <span className="badge-text">Canales de Coordinación Crítica</span>
          </div>
        </div>
      </header>

      <main className="app-content container animate-slide-up">
        <Component {...pageProps} />
      </main>

      <footer className="app-footer">
        <div className="footer-container">
          <p>© {new Date().getFullYear()} AyudaVenezuela. Coordinación humanitaria en tiempo real y offline.</p>
          <div className="venezuela-strip">
            <span className="yellow-strip"></span>
            <span className="blue-strip"></span>
            <span className="red-strip"></span>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .app-header {
          position: sticky;
          top: 0;
          z-index: 100;
          border-radius: 0 0 16px 16px !important;
          border-top: none !important;
          margin-bottom: 24px;
        }
        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        @media (max-width: 600px) {
          .header-container {
            padding: 12px 16px;
            flex-direction: column;
            gap: 8px;
          }
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }
        .logo-icon {
          font-size: 28px;
        }
        .logo-text {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: var(--text-primary);
        }
        .logo-accent {
          color: var(--secondary-color);
        }
        .badge-section {
          display: flex;
          align-items: center;
          gap: 8px;
          background-color: rgba(37, 99, 235, 0.1);
          border: 1px solid rgba(37, 99, 235, 0.25);
          padding: 6px 12px;
          border-radius: 20px;
        }
        .badge-dot {
          width: 8px;
          height: 8px;
          background-color: var(--success-color);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--success-color);
          animation: pulse 1.5s infinite;
        }
        .badge-text {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .app-content {
          padding-bottom: 60px;
        }
        .app-footer {
          margin-top: auto;
          padding: 30px 20px;
          border-top: 1px solid var(--border-color);
          text-align: center;
          background-color: rgba(9, 13, 22, 0.9);
        }
        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .app-footer p {
          color: var(--text-secondary);
          font-size: 13px;
        }
        .venezuela-strip {
          display: flex;
          width: 80px;
          height: 4px;
          border-radius: 2px;
          overflow: hidden;
        }
        .venezuela-strip span {
          flex: 1;
        }
        .yellow-strip { background-color: #f59e0b; }
        .blue-strip { background-color: #2563eb; }
        .red-strip { background-color: #ef4444; }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </AuthProvider>
  );
}

export default MyApp;
