<div align="center">

<img src="icon.png" alt="Keyra" width="90" />

# Keyra — Landing Website

**The marketing site and landing page for Keyra Authenticator.**

[![Live](https://img.shields.io/badge/live-keyra--app.netlify.app-brightgreen?style=flat-square)](https://keyra-app.netlify.app/)
[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/license-Keyra%20Personal%20Use-blueviolet?style=flat-square)](../LICENSE)

[🌐 Visit Site](https://keyra-app.netlify.app/) · [🐛 Report Bug](https://github.com/MbarkT3STO/Keyra-App/issues)

</div>

---

## Overview

This is the official landing page for Keyra Authenticator. It showcases the app's features, includes a fully interactive live demo mockup of the desktop UI, and provides download links for all platforms.

Built with zero frameworks — pure **HTML**, **CSS**, and **JavaScript** — with a hand-crafted neumorphic design system that mirrors the app itself.

---

## Sections

| Section | Description |
|---|---|
| **Hero** | Animated live mockup with real TOTP countdown rings |
| **Features** | Key highlights — neumorphic UI, speed, security |
| **Demo** | Fully interactive replica of the Keyra desktop app |
| **Download** | Platform cards for Windows, macOS, Android (Linux coming soon) |
| **Community** | Developer profile and GitHub repository stats |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 — custom neumorphic design system |
| Scripting | Vanilla JavaScript (ES6+) |
| Icons | Font Awesome 6.5 |
| Fonts | Inter + Outfit (Google Fonts) |
| Hosting | Netlify |

---

## Project Structure

```
Keyra-Website/
├── index.html          # Main page
├── styles.css          # Full neumorphic design system + layout
├── script.js           # Interactivity, TOTP mockup, scroll animations
├── icon.png            # App icon / favicon
└── DeveloperPhoto.jpg  # Developer profile photo
```

---

## Design System

The site uses a custom **neumorphic CSS design system** with three core shadow utilities:

| Class | Effect |
|---|---|
| `.nm-flat` | Flat neumorphic surface (default raised) |
| `.nm-convex` | Convex raised element (buttons, cards) |
| `.nm-inset` | Inset / pressed element (inputs, badges) |

Theme switching (dark/light) is handled via `data-theme` on `<html>`, with CSS custom properties driving all colors and shadows.

---

## Running Locally

No build step needed — just open the file:

```bash
# Option 1: open directly
start index.html

# Option 2: serve with any static server
npx serve .
```

---

## Deployment

The site auto-deploys to **Netlify** on every push to `main`.

🌐 [keyra-app.netlify.app](https://keyra-app.netlify.app/)

---

## License

[Keyra Personal Use License](../LICENSE) — free for personal use, commercial use not permitted.

