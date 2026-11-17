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

### Agent access and Cron Jobs

```text
Agent → cloud broker or optional direct adapter → ColorOS client
```

The cloud is a connection and coordination layer, not automatically the Agent or executor. Cloud-brokered and device-direct access are two transports for the same capabilities. The current recommendation is cloud first with direct access as a later option, but this is still under review.

Cron scheduler ownership is a separate, currently open decision. A cloud scheduler can start a Prompt while the phone is offline, but live device data still needs the client; a device scheduler has different ColorOS reliability constraints. See [clock-connectivity.md](clock-connectivity.md) for the candidate flows, state contract, and open decisions.

## Shared interface

`packages/agent-core/src/cron.js` exposes two functions:

- `cronExpression(schedule, time)` converts the three simple schedules into five-field Cron.
- `createCronJob(input)` validates and returns a Prompt job containing schedule, `Asia/Shanghai` by default, notification policy, and `SCHEDULED` status.

The browser prototype and Node tests cross this same interface. More schedule types should be added here rather than reimplemented in each app.

## Near-term implementation order

1. Align the shared capability and acknowledgement contracts.
2. Validate one cloud-brokered alarm command end to end on ColorOS.
3. Add offline expiry and idempotent delivery before expanding capabilities.
4. Decide Agent Cron scheduler ownership independently of the access transport.
5. Add Calendar and Notes using the same identity and permission model.
6. Wrap the shared design and contracts in native ColorOS shells where device integration is required.

A live broker, scheduler, authentication, Android packaging, and production synchronization are intentionally outside the current prototype.
