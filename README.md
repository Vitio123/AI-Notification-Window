![AI Notification Window](./banner.png)

# AI Notification Window

A lightweight background notifier for Windows that shows an animated, Apple-style overlay when your AI coding assistant needs your attention. It lives in the system tray and, on click, brings the terminal running the assistant back to the foreground.

> **Note:** For now it works **only with [Claude Code](https://docs.claude.com/en/docs/claude-code)**. Support for other AI assistants is planned — that's why the project is named generically.

## Features

- **Animated overlay**: a circle grows, morphs into a pill that shows what the AI is asking (ticker for long text), and expands on hover to reveal the full message.
- **Click to focus**: clicking the notification focuses the exact terminal/VS Code window running the assistant.
- **Close button**: hover to reveal an `×` that just dismisses the notice.
- **Entry / exit animations**: choose between `Pop`, `Fade`, `Slide`, `Zoom`, `Drop` — independently for in and out.
- **Multi-language UI**: English, Español, Português, Français, Deutsch.
- **Position**: any of the 6 screen corners/edges.
- **Custom sound**, **auto-hide timeout**, **start with Windows**, configurable **local port**.
- **Animated Claude sunburst icon** (fully solid, no transparency).

## How it works

```
Claude Code (Notification / Stop hook)
   └─ hooks/forward-notify.ps1  ──POST──►  App (127.0.0.1:4317)  ──►  animated overlay
```

It uses **Claude Code hooks** (it does **not** read your screen). The notification text is the `message` Claude sends.

## Install & run (development)

```bash
npm install
npm start
```

The app starts in the **system tray** (next to the clock). Right-click → **Configuración / Configuration** for settings, **Probar / Test** to preview, **Salir / Quit** to exit.

## Build a Windows executable

```bash
npm run dist
```

Output goes to `dist/` (electron-builder, NSIS installer).

## Hook setup (Claude Code)

In `~/.claude/settings.json`, the `Notification` and `Stop` hooks call:

```
hooks\forward-notify.ps1 -Event <Notification|Stop>
```

If you change the **port** in the app, the hook is updated automatically on save. (Manual form: `... forward-notify.ps1 -Event Notification -Port <port>`.)

## Configuration

Open from the tray icon → Configuration:

| Setting | Description |
|--------|-------------|
| Language | UI + default notification texts (EN/ES/PT/FR/DE). |
| Position | Top/bottom × left/center/right. |
| Icon color | Color of the animated Claude sunburst. |
| Entry / Exit animation | Pop, Fade, Slide, Zoom, Drop. |
| Sound | Optional `.wav` / `.mp3`. |
| Start with Windows | On/off. |
| Auto-hide | Hide after N seconds (`0` = never). |
| Local port | Default `4317`. Must match the hook (synced on save). |

## Notes

- Click focuses the window whose title contains the project folder name (`cwd` from the hook); falls back to the first VS Code window.
- If the app is off when the AI notifies, the hook fails silently (no error in your terminal).
- Unsigned build: Windows SmartScreen may warn on first run → *More info* → *Run anyway*.

## License

MIT
