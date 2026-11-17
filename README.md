# ColorLink

Agent-native clock, calendar, and notes for ColorOS. Each app is released independently; shared modules keep Prompt jobs and the visual language consistent.

## Status

- **Clock**: interactive HTML prototype with alarms, world clock, stopwatch, timer, and Agent Cron Job creation.
- **Agent Core**: tested Prompt + local-time schedule → five-field Cron contract.
- **Calendar / Notes**: scoped and registered in the monorepo; implementation has not started.

This repository does not yet produce an Android APK or connect to a live cloud Agent.

## Layout

```text
apps/
  clock/          Alarm, world clock, stopwatch, timer
  calendar/       Calendar product scope and future app
  notes/          Notes product scope and future app
packages/
  agent-core/     Shared Prompt and Cron Job contract
  design-system/  Shared monochrome editorial terminal styles
docs/             Architecture and release conventions
scripts/          Syntax checks and release packaging
```

## Run

Open `apps/clock/index.html` directly in a browser. No install or build is required for the prototype.

```sh
npm install
npm test
npm run check
```

## Release model

Apps have independent versions, tags, and GitHub Releases:

```text
clock-v0.1.0
calendar-v0.1.0
notes-v0.1.0
```

See [docs/releases.md](docs/releases.md) and [docs/architecture.md](docs/architecture.md).
