# 📱 Capacitor (Android)

## Commands

```bash
npm run build              # Build web → out/
npx cap sync android       # Sync out/ → android/
npm run android:apk        # Full build + APK
```

## Config

`capacitor.config.ts`:
```ts
appId: 'com.moneymeva.app'
appName: 'Money Meva'
webDir: 'out'
```

## Build Pipeline

```
npm run build
  → next build → out/
npx cap sync android
  → copies out/ → android/app/src/main/assets/public/
gradle assembleDebug
  → android/app/build/outputs/apk/debug/app-debug.apk
```

## GitHub Actions

- Auto-build on push to master
- APK in Actions artifacts

## Local Build

```bash
npm run android:apk
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
```

---

#money-meva #reference #capacitor
