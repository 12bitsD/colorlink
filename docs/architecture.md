# ColorLink architecture

## Product seams

The three apps share contracts, not screens or business logic. Each app can be built, versioned, and released without forcing a release of the other two.

- **Clock**: local alarms, world clock, stopwatch, timer, and Agent Cron Job authoring.
- **Calendar**: events and reminders. Calendar or Agent creation may attach a clock reminder; the clock cannot attach itself to an existing event.
- **Notes**: Markdown notes and scoped Agent read/write access.
- **Agent Core**: the small shared interface for validating Prompt jobs and generating Cron expressions.
- **Design System**: semantic monochrome tokens and shared component styles.

## Two execution paths

### Personal reminder

```text
Clock / Calendar → ColorOS exact alarm or notification → user
```

The device owns precise alarm behavior, permissions, and offline delivery.

### Agent Cron Job

```text
Prompt + local-time schedule → cloud scheduler → new Agent run → result / notification
```

The cloud scheduler owns recurring execution. An Agent run does not depend on the phone being awake; the phone is the authoring and result surface. Each trigger starts a fresh Prompt run with only the granted context.

## Shared interface

`packages/agent-core/src/cron.js` exposes two functions:

- `cronExpression(schedule, time)` converts the three simple schedules into five-field Cron.
- `createCronJob(input)` validates and returns a Prompt job containing schedule, `Asia/Shanghai` by default, notification policy, and `SCHEDULED` status.

The browser prototype and Node tests cross this same interface. More schedule types should be added here rather than reimplemented in each app.

## Near-term implementation order

1. Persist Clock jobs and expose them through a small local JSON store.
2. Add one cloud scheduler adapter that accepts the shared Cron Job contract.
3. Add Calendar with local notifications and the existing reminder link.
4. Add Notes with explicit per-note Agent permissions.
5. Wrap the shared design and contracts in native ColorOS shells where device integration is required.

A live scheduler, authentication, Android packaging, and production synchronization are intentionally outside the current prototype.
