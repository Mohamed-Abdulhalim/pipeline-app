<div align="center">

<img src="assets/icon.png" width="120" alt="Pipeline app icon" />

# Pipeline

**Every income stream I have, in one place on my phone.**

Leads, applications, clients, the money that lands, the money that leaves, and what I put aside, tracked in one small Android app I built for myself.

[![Android](https://img.shields.io/badge/Android-APK-3DDC84?logo=android&logoColor=white)](https://github.com/Mohamed-Abdulhalim/pipeline-app/releases/latest/download/pipeline.apk)
[![Expo](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Build APK](https://github.com/Mohamed-Abdulhalim/pipeline-app/actions/workflows/android.yml/badge.svg)](https://github.com/Mohamed-Abdulhalim/pipeline-app/actions/workflows/android.yml)

[**Download the APK**](https://github.com/Mohamed-Abdulhalim/pipeline-app/releases/latest/download/pipeline.apk)

</div>

---

## 👋 Why I built this

I'm a freelance developer, which means my work comes from a lot of directions at once: freelance platforms, job boards, people I reach out to directly, a regular job, and a few side products I'm building. My rule is simple. I never want to depend on one client, one employer, or one income source.

The problem was that all of it lived in different places. Some leads sat in one platform's inbox, some in email, some in WhatsApp, and some only in my head. Good opportunities went cold because I forgot to follow up, and at the end of the month I couldn't tell you which source was actually paying off.

So I made the app I wanted: one place to log every opportunity, a nudge when something has been sitting too long, and an honest picture of where my money comes from and where it goes.

## ✨ What it does

### 🗂️ Pipeline
Every lead, job application, gig, or client conversation goes in as an entry and moves through five stages:

`Found` → `Applied` → `Talking` → `Won` / `Lost`

- One tap moves an entry to its next stage
- A progress rail on every card shows how far it's gone
- The top card shows the total value of everything still open, plus win rate and wins this month
- A **Follow up** filter shows only what I've been ignoring

### 🔔 Follow-up reminders
If an open entry goes untouched for a few days (I pick how many), the phone reminds me. Mark it followed up and the clock resets.

### 💰 Money
Log money the day it arrives and spending the day it leaves, in EGP or USD (converted at a rate I set).

- **Net** at the top: what came in, minus what went out and what I saved, compared with last month
- Received, spent, and the percentage I actually kept
- Income broken down by source, with a plain warning when one source makes up 70% or more of the month. That's the number I care about most.
- Spending broken down by category (rent, bills, food, and whatever else I add)
- One timeline of every entry, filterable to income or expenses

### 🏦 Savings
Money I put aside comes straight out of that month's net, so the Money tab shows what's actually left to spend.

- Total saved, what went in this month, and what share of income that is
- Withdrawals put money back into that month's net when I need it
- Any saving can be **hidden** when I create it. It still counts against net, but it stays out of sight until I flip **View hidden savings** in Settings.

### 💾 Backup
Everything lives on the phone in SQLite. No account, no server, no sign-up. Export a JSON backup whenever you want and restore it on any phone.

## 📲 Install it

1. On your Android phone, open **[pipeline.apk](https://github.com/Mohamed-Abdulhalim/pipeline-app/releases/latest/download/pipeline.apk)**
2. If Android asks, allow your browser to install unknown apps
3. Tap **Install**, open it, and allow notifications so reminders work

New versions install over the old one and keep your data.

> **Tip:** your data is only on your phone. Uninstalling deletes it, so export a backup now and then.

## 🛠️ Built with

| | |
|---|---|
| **App** | React Native + Expo SDK 58, TypeScript |
| **Storage** | `expo-sqlite`, fully offline |
| **Reminders** | `expo-notifications` with local scheduled notifications |
| **Design** | Instrument Serif + Manrope, Feather icons, brass-on-ink theme |
| **Builds** | GitHub Actions compiles a release APK on every push |

## 🧑‍💻 Run it yourself

```bash
git clone https://github.com/Mohamed-Abdulhalim/pipeline-app.git
cd pipeline-app
npm install
npx expo start
```

To build an APK locally (needs the Android SDK and Java 17):

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

Or just push to `main`. The workflow in [`.github/workflows/android.yml`](.github/workflows/android.yml) builds the APK and publishes it to the [latest release](https://github.com/Mohamed-Abdulhalim/pipeline-app/releases/latest).

## 📁 Project layout

```
App.tsx                  App shell, tab bar, splash and intro animation
src/
  db.ts                  SQLite schema and every query
  notify.ts              Follow-up reminder scheduling
  backup.ts              JSON export and restore
  theme.ts               Colors, fonts, stage colors
  components/ui.tsx      Inputs, dropdown sheets, buttons, cards
  screens/
    PipelineScreen.tsx   The pipeline board
    ItemForm.tsx         Add and edit entries
    IncomeScreen.tsx     Money tab: income, expenses, net, breakdowns
    SavingsScreen.tsx    Savings balance, withdrawals, hidden entries
    SettingsScreen.tsx   Sources, categories, hidden savings, reminders, currency, backup
```

## 🙌 Using it yourself

I made this for my own life, but if your income also comes from more than one place, it should fit you too. Add your own sources in **Settings** and you're set. Issues and ideas are welcome.

---

<div align="center">

Made in Cairo by **Mohamed Abdulhalim** · [halim.pro](https://halim.pro)

<sub>MIT licensed. Use it, fork it, make it yours.</sub>

</div>
