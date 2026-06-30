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
            <span className="logo-text text-slate-900">Venezuela <span className="text-blue-600">Reporta</span></span>
          </div>
          <div className="badge-section bg-blue-50 border border-blue-200">
            <span className="badge-dot bg-blue-600"></span>
            <span className="badge-text text-blue-700 font-semibold">Coordinación en Tiempo Real</span>
          </div>
        </div>
      </header>

      <main className="app-content w-full max-w-full px-2 sm:px-4 md:px-8 mx-auto animate-slide-up">
        <Component {...pageProps} />
      </main>

      <footer className="app-footer bg-white border-t border-slate-200">
        <div className="footer-container">
          <p className="text-slate-500 text-xs sm:text-sm">© {new Date().getFullYear()} Venezuela Reporta / AyudaVenezuela. Coordinación humanitaria en tiempo real y offline.</p>
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
          background: rgba(255, 255, 255, 0.95);
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 20px;
          backdrop-filter: blur(12px);
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .header-container {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          padding: 14px 24px;
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
          font-size: 26px;
        }
        .logo-text {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #0f172a;
        }
        .badge-section {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 20px;
        }
        .badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(37, 99, 235, 0.6);
          animation: pulse 1.5s infinite;
        }
        .badge-text {
          font-size: 12px;
        }
        .app-content {
          padding-bottom: 60px;
          width: 100%;
        }
        .app-footer {
          margin-top: auto;
          padding: 24px 20px;
          text-align: center;
        }
        .footer-container {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
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
