# Cross-Platform Guide — Money Meva

This guide covers running Money Meva on **Windows**, **macOS**, and **Linux** (Ubuntu, Debian, Fedora, Red Hat, Linux Mint, Arch, etc.).

---

## Prerequisites (All Platforms)

| Tool | Check | Install |
|---|---|---|
| Node.js 18+ | `node -v` | https://nodejs.org (LTS recommended) |
| Git | `git --version` | https://git-scm.com |
| npm | `npm -v` | Comes with Node.js |

---

## Quick Start

```bash
git clone https://github.com/kuldeep7ke/moneymeva-online.git
cd moneymeva-online
npm install
```

### Production Server

| Platform | Command |
|---|---|
| Windows | Double-click `start.bat` |
| Mac / Linux | `chmod +x start.sh && ./start.sh` |
| Any | `npm run build && npx serve out -l 3000` |

### Dev Server (with hot reload)

| Platform | Command |
|---|---|
| Windows | Double-click `start-dev.bat` |
| Mac / Linux | `chmod +x start-dev.sh && ./start-dev.sh` |
| Any | `npm run dev` |

### Stop Server

| Platform | Command |
|---|---|
| Windows | Double-click `stop-server.bat` |
| Mac / Linux | `./stop-server.sh` |
| Any | Kill whatever uses port 3000 |

---

## Linux-Specific Setup

### Ubuntu / Debian

```bash
# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # v18.x+
npm -v    # 9.x+

# Clone and run
git clone https://github.com/kuldeep7ke/moneymeva-online.git
cd moneymeva-online
chmod +x start.sh start-dev.sh stop-server.sh
./start.sh
```

### Fedora / RHEL / CentOS

```bash
# Install Node.js 18 LTS
sudo dnf install -y nodejs
# Or via NodeSource for latest LTS:
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Clone and run
git clone https://github.com/kuldeep7ke/moneymeva-online.git
cd moneymeva-online
chmod +x start.sh start-dev.sh stop-server.sh
./start.sh
```

### Arch Linux / Manjaro

```bash
sudo pacman -S nodejs npm
git clone https://github.com/kuldeep7ke/moneymeva-online.git
cd moneymeva-online
chmod +x start.sh start-dev.sh stop-server.sh
./start.sh
```

### Linux Mint

Same as Ubuntu — use `apt` commands above.

---

## macOS Setup

```bash
# Install Node.js (via Homebrew)
brew install node@18

# Or download from https://nodejs.org

# Clone and run
git clone https://github.com/kuldeep7ke/moneymeva-online.git
cd moneymeva-online
chmod +x start.sh start-dev.sh stop-server.sh
./start.sh
```

---

## Docker (Any Platform)

```bash
# Run the prebuilt image (cloud-free by default)
docker run -d -p 8080:80 ghcr.io/kuldeep7ke/moneymeva-online:latest
# Open http://localhost:8080

# Or build with your own Supabase values
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:8080 \
  -t moneymeva . && docker run -d -p 8080:80 moneymeva
```

Requires Docker Desktop or `docker-ce` installed.

---

## npm Scripts (Any Platform)

| Command | Description |
|---|---|
| `npm run dev` | Dev server at localhost:3000 |
| `npm run build` | Production build (static export to `out/`) |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |
| `npm run version:patch` | Bump patch version (vX.Y.Z.N → vX.Y.Z.N+1) |
| `npm run version:minor` | Bump minor version |
| `npm run version:major` | Bump major version |
| `npx cap sync android` | Sync web build to Android project |
| `npm run android:apk` | Full APK build: build → version → gradle assembleDebug |

---

## Troubleshooting

### General

| Symptom | Cause | Fix |
|---|---|---|
| `node: command not found` | Node.js not installed or not in PATH | Install from https://nodejs.org; restart terminal after install |
| `npm ERR! EACCES` (permission error) | npm global prefix needs root | Run `sudo chown -R $(whoami) ~/.npm` (Mac/Linux) or use nvm |
| `EADDRINUSE: port 3000` | Another process using port 3000 | `./stop-server.sh` (Mac/Linux) or `stop-server.bat` (Windows) |
| Blank page / 404 on localhost:3000 | Build not run yet or out/ is stale | Run `./start.sh` (auto-builds) or `npm run build` manually |
| `SyntaxError: Cannot use import statement` | Running with `node` instead of `npm run` | Use `npm run dev` or `npm run build && npm run start` |

### Linux-Specific

| Symptom | Cause | Fix |
|---|---|---|
| `Permission denied: ./start.sh` | Script not executable | `chmod +x start.sh start-dev.sh stop-server.sh` |
| `fuser: command not found` | `lsof`/`fuser` not installed | `sudo apt install lsof` (Ubuntu) or `sudo dnf install psmisc` (Fedora) |
| Browser doesn't open automatically | `xdg-open` not available | Open http://localhost:3000 manually |
| `EACCES` on node_modules | Permission issue from previous sudo | `sudo chown -R $(whoami) node_modules` then `npm install` |
| Port 3000 in use after sleep/resume | Stale process | `./stop-server.sh` kills it |

### macOS-Specific

| Symptom | Cause | Fix |
|---|---|---|
| `xcode-select: note: install developer tools` | Xcode CLI tools needed for native modules | `xcode-select --install` |
| `EACCES` on /usr/local | Homebrew permissions | Use nvm instead: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh \| bash` |
| Port 3000 in use | Previous server still running | `./stop-server.sh` or `lsof -ti:3000 \| xargs kill -9` |

### Android Build

| Symptom | Cause | Fix |
|---|---|---|
| `JAVA_HOME not set` | Java/JDK not installed | Install JDK 17: `sudo apt install openjdk-17-jdk` (Linux) or `brew install openjdk@17` (Mac) |
| `ANDROID_HOME not set` | Android SDK not installed | Install Android Studio or set `ANDROID_HOME` manually |
| `gradlew: Permission denied` | Script not executable | `chmod +x android/gradlew` |
| Build succeeds but APK is old | Stale build output | `cd android && ./gradlew clean` then retry |

### Cloud Sync

| Symptom | Cause | Fix |
|---|---|---|
| "Google sign-in not enabled" | Provider not configured in Supabase | See SELF-HOSTING.md Step 4 |
| `redirect_uri_mismatch` | Redirect URI typo | Must be exactly `https://<ref>.supabase.co/auth/v1/callback` |
| Login works but nothing syncs | `.env.local` missing or table not created | Re-run schema.sql, confirm `.env.local`, check Settings → Sync |
| `new row violates RLS policy` | Wrong key or schema not applied | Re-run `schema.sql`; use the **anon** key only |
| Sync stops after laptop sleep | Socket dropped | Auto-reconnects within ~30s, or tap Sync Now |

---

## Running from a USB Drive

The entire app can run from a USB drive on any OS:

1. Clone the repo to the USB
2. Run `npm install` once
3. Use `start.sh` (Mac/Linux) or `start.bat` (Windows) from the USB path

---

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | (empty — cloud-free) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | (empty — cloud-free) |
| `NEXT_PUBLIC_SITE_URL` | Where the app is served | `https://moneymevaonline.pages.dev` |

Set in `.env.local` (create from `.env.example`). Values are baked in at **build time** — rebuild after changing.

---

*Made in India. Runs everywhere.*
