<div align="center">

# Keyra Authenticator — Web

**Your 2FA vault, anywhere. No install required.**

[![Version](https://img.shields.io/badge/version-1.2.0-success?style=flat-square)](https://github.com/MbarkT3STO/Keyra-App)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Live](https://img.shields.io/badge/live-keyraapp.netlify.app-brightgreen?style=flat-square)](https://keyraapp.netlify.app/)
[![License](https://img.shields.io/badge/license-Keyra%20Personal%20Use-blueviolet?style=flat-square)](../LICENSE)

[🌐 Open Web Vault](https://keyraapp.netlify.app/) · [🐛 Report Bug](https://github.com/MbarkT3STO/Keyra-App/issues)

</div>

---

## Overview

Keyra Web is the browser-based vault — the same core 2FA experience as the desktop and Android apps, accessible from any device without installation. It also serves as the **shared web layer** that powers the Android Capacitor app.

Built with **Vite** and **TypeScript**, it's fast, lightweight, and deployable to any static host.

---

## Features

- 🌐 **Zero Install** — runs entirely in the browser
- 🎨 **Neumorphic UI** — consistent design across all Keyra platforms
- 🔐 **Local Encryption** — vault data encrypted client-side, never sent in plaintext
- ☁️ **Cloud Sync** — sync your vault across desktop, mobile, and web
- ⏱️ **Live TOTP Codes** — real-time countdown with animated timers
- 📷 **QR Code Import** — add accounts by scanning or uploading a QR image
- 🛡️ **Secure Mode** — mask all codes until revealed
- 🌙 **Dark & Light Mode** — full neumorphic theme support

---

## Tech Stack

| Layer | Technology |
|---|---|
| Bundler | Vite 7 |
| Language | TypeScript 5 |
| OTP | `otplib` (TOTP RFC 6238) |
| QR | `jsqr` |
| Icons | Lucide |
| IDs | `uuid` |
| Polyfills | `vite-plugin-node-polyfills` |

---

## Project Structure

```
src/
├── components/    # UI components (vault cards, modals, settings)
├── core/          # TOTP engine, encryption, sync logic
├── styles/        # Neumorphic CSS design system
├── types/         # TypeScript interfaces and types
└── main.ts        # App entry point
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install & Run

```bash
cd Authenticator-Web
npm install
npm run dev
```

App will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output goes to `dist/` — deploy to any static host (Netlify, Vercel, GitHub Pages, etc.).

### Preview Production Build

```bash
npm run preview
```

---

## Deployment

The live web vault is deployed on **Netlify** and auto-deploys on every push to `main`.

🌐 [keyraapp.netlify.app](https://keyraapp.netlify.app/)

---

## Used as Android Web Layer

This project is also the web layer bundled into the Android app via Capacitor. After building, run:

```bash
npx cap sync android
```

to push the latest build into `Authenticator-Android`.

---

## License

[Keyra Personal Use License](../LICENSE) — free for personal use, commercial use not permitted.

