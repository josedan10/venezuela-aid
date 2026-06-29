import { Html, Head, Main, NextScript } from 'next/document';
import React from 'react';

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <meta charSet="utf-8" />
        {/* Mobile First Viewport Configurations */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#090d16" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="Plataforma de coordinación de ayuda humanitaria para Venezuela con soporte para uso offline en tránsito." />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
