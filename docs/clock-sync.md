# Clock synchronization proposal

Status: **recommended design, not implemented**. The user has confirmed three write sources (local, Agent, Calendar), a long-lived cloud/client link, and a preference for push rather than polling.

## Identity without a password UI

A personal service still needs authentication. `user_id` identifies the account; it is not a secret and must not authorize commands by itself.

Use a one-time pairing link or QR code to bind:

```text
user_id + device_id + link_id + device_secret
```

The client then keeps a long-lived outbound WebSocket connection. The user experiences no password login, while the backend can still revoke one lost device without changing the User ID or affecting other devices.

## Transport: push first, catch up on reconnect

```text
Clock App ───── outbound WebSocket Link ───── Cloud backend
             ← operations / acknowledgements →
```

The cloud does not call an inbound HTTP webhook on the phone. New operations are pushed over the existing Link. Keepalive ping/pong is connection maintenance, not business-data polling.

ColorOS may suspend the Link. Therefore push alone is not a complete synchronization protocol:

1. While online, the cloud pushes new operations immediately.
2. If the Link drops, the cloud retains pending operations.
3. On reconnect, the client sends its last applied `server_seq`.
4. The cloud replays only later operations, then resumes live push.
5. The client also catches up after app restart or network recovery.

A native push channel can be added later as a wake-up hint, but it is not required for correctness and should not carry the only copy of an operation.

## One operation pipeline for all three entries

```text
Local edit ───┐
Agent call ───┼── alarm operation → cloud sequence → client apply → ColorOS execute → applied result
Calendar link ─┘
```

Every write has a stable `alarm_id`, an idempotent `operation_id`, a source (`local`, `agent`, or `calendar`), and a `base_revision`. Sources affect provenance and permissions, not the synchronization mechanism.

Calendar remains a separate app. Its operation may include `linked_event_id`; Clock accepts the reminder operation without owning the Calendar event or initiating the link.

## Database responsibilities

Use both a cloud database and a local cache, with different responsibilities.

### Cloud: synchronization authority

A small relational model is enough:

- `devices`: User ID, device identity, revoked state, and current Link state.
- `alarms`: current desired snapshot and revision for each alarm.
- `sync_operations`: ordered operations with a backend-assigned `server_seq`.

This is not full event sourcing. The snapshot supports ordinary reads; the operation log supports idempotency, reconnect catch-up, and debugging.

### Clock App: execution authority and offline cache

Local storage (Room/SQLite in a native app) contains:

- The latest applied alarm snapshot.
- A local outbox for edits made while offline.
- `last_server_seq` and local execution state.

The local database, not the cloud, is used to schedule ColorOS alarms and restore them after reboot. A fresh install can restore the cloud snapshot and then schedule it locally.

`EXECUTED` is reported only after both the local database transaction and the native scheduling request succeed. Cloud acceptance alone never means the alarm exists on the phone.

## Write flows

### Local create or edit

1. In one local transaction, update the alarm and append an outbox operation.
2. Schedule or update the ColorOS alarm immediately.
3. Send the operation over the Link.
4. The cloud validates `operation_id` and `base_revision`, stores the operation and snapshot, and assigns `server_seq`.
5. The client marks the outbox item acknowledged. A repeated operation does not create another alarm.

### Agent create or edit

1. The Agent calls the cloud tool with an idempotency key.
2. The cloud writes the operation and desired snapshot.
3. If Clock App is online, the cloud pushes the operation; otherwise it remains pending.
4. Clock App applies it locally, requests the native alarm change, and returns the real applied or failed result.
5. The cloud records that device result separately from the desired alarm state.

### Calendar create, update, or cancellation

Calendar emits the same alarm operation with `source=calendar` and `linked_event_id`. Updates and cancellation reference the existing alarm rather than creating duplicates. Clock cannot initiate an Event association.

## Conflicts and deletion

Do not use device timestamps for last-write-wins; phone clocks can be wrong. The cloud sequence provides the order.

For the first single-user version, revision checking is sufficient:

- An operation includes the `base_revision` seen by its writer.
- If it matches, the cloud commits the next revision.
- If it is stale, the cloud returns `CONFLICT` with the current snapshot; the client reconciles instead of silently overwriting newer intent.
- Deletes are tombstones with revisions, so an offline stale update cannot resurrect an alarm.

This keeps the first version small without pretending conflicting edits cannot happen.

## Agent Cron Jobs

`agent_jobs` remains separate from `alarms`. It may reuse the same operation, idempotency, and acknowledgement ideas, but starting a Prompt is not a ColorOS alarm execution and must not share its success status.

## Minimal implementation order

1. Pair one device and maintain one authenticated WebSocket Link.
2. Implement Agent → cloud operation → client apply → ColorOS execution → applied result.
3. Add local outbox and reconnect catch-up using `server_seq`.
4. Add revision conflicts, deletion tombstones, and operation expiry.
5. Add Calendar through the same operation contract.

## Still open

- Whether the pairing secret is delivered by QR, short code, or a one-time link.
- Which stale operations expire instead of executing late.
- Whether a native push wake-up hint is worth its battery and platform cost.
- How a conflict is presented when the same alarm was edited in two places while offline.
