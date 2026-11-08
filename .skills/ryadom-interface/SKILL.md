---
name: ryadom-interface
description: Review and improve рядом. screens, mixed media cards and mobile performance with measurable checks.
---

# рядом. — интерфейс и скорость

Adapted for Codex from the user's three reference videos on 9 November 2026. Design principles adapted from **Unslop by Damir Sokolovsky (@heydamir)**, https://github.com/heydamir/unslop, licensed **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/). Source reviewed at commit a6f121eee5f29c2f74976b75456feae8b66afb3a. This is a React Native project adaptation, not the full upstream package. The user has explicitly authorized implementing the redesign; do not add a new direction-approval step.

Start with the actual latest APK commit, not necessarily main. Read recent FIX reports. Separate observed defects from assumptions and record missing access. Never report demo checks as production checks or browser timings as Android FPS.

## Design review

Choose one clear composition around the real task: discover a place, understand when/where/price, plan a visit. Keep four bottom destinations: map, recommendations, chats, settings with avatar. Plans live behind the recommendations calendar; keep existing deep links. Preserve invitations and unread counts.

Use warm light surfaces, restrained sea-glass accents and consistent line icons. Give typography, content and spacing priority over decoration. No arbitrary gradients, emoji icons, invented metrics, or repeated floating badges. Every visible control must work. Explain gestures with real buttons. Respect reduced motion and safe areas.

For each card verify portrait, landscape, panorama, video without poster, broken image, multi-item gallery, long title, free/missing price, missing date and large text. Keep the whole poster readable; measure text first and give media the remaining space. Avoid blank fixed-height tails. Do not crop text or put necessary facts behind media controls. Touch areas >=44 points.

## Performance review

Measure before changing architecture. One visible video decoder, stop native playback on blur/background/sheets; do not rely only on React updates on frozen tabs. Use local fonts, bounded memory/disk caches, appropriately sized images and visible-window lists. Skip decorative blur in eco mode. Avoid a second image decode solely for decoration on low-memory devices.

Apply web advice only where relevant: compressed image variants, deferred offscreen images/scripts, font preload, HTTP caching and Brotli belong to their serving layer. Never claim URL parameters compress images unless the image service supports them. Debounce remote search, paginate large responses, check query plans before adding indexes. Background queues, pooling, caching and regions require actual backend evidence; do not change production infrastructure speculatively.

## Verification

Run typecheck, lint and relevant existing tests. Export web and inspect at 320x568, 390x844 and tablet width. Verify navigation, calendar, profile entry, deep links and notification counts. Capture screenshots and record limits. Use a real Android performance trace before claiming phone speed gains. Credentials stay outside source, screenshots and reports.
