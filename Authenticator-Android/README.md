<div align="center">

<img src="android/app/src/main/res/drawable/splash.png" alt="Keyra Android" width="90" />

# Keyra Authenticator — Android

**Your 2FA vault, in your pocket. Neumorphic. Secure. Native.**

[![Version](https://img.shields.io/badge/version-1.0.0-success?style=flat-square)](https://github.com/MbarkT3STO/Keyra-App/releases/tag/v1.0.0-android)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android-119EFF?style=flat-square&logo=capacitor)](https://capacitorjs.com/)
[![Android](https://img.shields.io/badge/Android-8%2B-3DDC84?style=flat-square&logo=android)](https://developer.android.com/)
[![License](https://img.shields.io/badge/license-Keyra%20Personal%20Use-blueviolet?style=flat-square)](../LICENSE)

[📥 Download APK](https://github.com/MbarkT3STO/Keyra-App/releases/download/v1.0.0-android/Keyra-Authenticator.apk) · [🌐 Web Vault](https://keyraapp.netlify.app/) · [🐛 Report Bug](https://github.com/MbarkT3STO/Keyra-App/issues)

</div>

---

## Overview

Keyra Android is the mobile companion to the Keyra ecosystem. Built with **Capacitor**, it wraps the same battle-tested Keyra web core into a fully native Android experience — complete with biometric unlock, pull-to-refresh, and a neumorphic UI that feels right at home on any Android device.

---

## Features

- 🎨 **Neumorphic UI** — the same premium design language as the desktop app
- 🔐 **Biometric & PIN Unlock** — protect your vault with fingerprint or PIN
- ☁️ **Cloud Sync** — vault stays in sync across all your devices
- 🔄 **Pull-to-Refresh** — refresh your vault with a natural gesture
- ⏱️ **Live TOTP Timers** — animated countdown rings for every account
- 🛡️ **Secure Mode** — hide all codes until you choose to reveal them
- 📴 **Offline Support** — access your vault without an internet connection
- 🌙 **OLED Dark Mode** — true black for battery-friendly OLED screens

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Capacitor (Android) |
| Language | TypeScript + Java |
| Min SDK | Android 8 (API 26) |
| Target SDK | Android 14 |
| OTP | TOTP (RFC 6238) via `otplib` |
| Build | Gradle |

---

## Project Structure

```
android/
├── app/
│   └── src/main/
│       ├── assets/public/     # Compiled web app (Keyra Web core)
│       ├── java/com/keyra/    # Native Android entry point
│       └── res/               # Icons, splash screens, layouts
└── capacitor.config.json      # Capacitor bridge configuration
```

---

## Getting Started

### Prerequisites

- Android Studio (Hedgehog or newer)
- JDK 17+
- Node.js 18+ (for web layer builds)

### Setup

```bash
# From the repo root — build the web layer first
cd Authenticator-Web
npm install && npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

### Build APK

In Android Studio: `Build → Build Bundle(s) / APK(s) → Build APK(s)`

Or via Gradle:

```bash
cd Authenticator-Android/android
./gradlew assembleRelease
```

---

## Download

| Platform | Download |
|---|---|
| 🤖 Android 8+ (APK) | [Keyra-Authenticator.apk](https://github.com/MbarkT3STO/Keyra-App/releases/download/v1.0.0-android/Keyra-Authenticator.apk) |

> **Note:** You may need to enable "Install from unknown sources" in your Android settings to sideload the APK.

---

## Changelog — v1.0.0

- Initial stable release
- Pure neumorphic UI design
- TOTP vault with cloud sync
- Biometric & PIN unlock
- Pull-to-refresh vault

---

## License

[Keyra Personal Use License](../LICENSE) — free for personal use, commercial use not permitted.

