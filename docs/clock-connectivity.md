# Clock connectivity proposal

Status: **under review, not an implementation decision**. The current HTML prototype does not implement either topology.

Scope: this document concerns **Clock App only**. Clock, Calendar, and Notes are separate apps with independent packages and releases. They may share one cloud backend, identity, and table-level authorization, but Clock is not a shared client for Calendar or Notes capabilities.

## The actual problem

Clock is not only a local alarm UI. It is a ColorOS client whose capabilities must be reachable by a remote Agent. The cloud is a connection and coordination layer, not automatically the Agent or the executor of every task.

A concrete scenario:

1. The user tells a remote Agent to create a 07:30 alarm.
2. The Agent issues an `alarm.set` command with the user's permission.
3. Clock App receives it and asks ColorOS to create the alarm.
4. Clock App reports the real device result. “Cloud accepted” must not be shown as “alarm created.”

## Two access paths

### A. Cloud-brokered access

```text
Agent → Remote tool / MCP endpoint on cloud → relay → Clock App
                                      ↑                 ↓
                               command record / offline queue
```

The phone maintains an outbound connection, so no public phone IP or port forwarding is needed. The cloud owns identity, pairing, capability discovery, command delivery, offline outbox, and audit records.

**Benefits**

- Works across NAT and changing mobile networks.
- Commands can be queued while the phone is offline.
- One stable remote endpoint works for different Agents and devices.
- Scoped permissions and revocation are enforced in one place.

**Costs**

- Requires accounts, device credentials, storage policy, and a running cloud service.
- More moving parts and higher latency than a local direct call.
- Prompt and result retention need an explicit privacy decision.

### B. Device-direct access

```text
Agent → direct tool / MCP connection → Clock App
```

The client exposes the same alarm and task capabilities without routing each command through the broker. The cloud may still help with pairing and discovery, but it is not in the command path.

**Benefits**

- Lower latency on a reachable network.
- Commands and results can stay on the device.
- Useful for local development and trusted companion environments.

**Costs**

- A sleeping or offline phone cannot serve requests.
- Mobile NAT, ColorOS background limits, and inbound connectivity make remote direct access unreliable.
- Authentication, tunneling, revocation, and discovery move onto the direct path.

## Recommendation: shared capabilities, cloud first, direct optional

These are two transports for the same capabilities, not two products:

```text
alarm.list / alarm.set / alarm.cancel / clock.status
agent.run_prompt / agent.schedule_prompt / job.list / job.cancel
```

Build the cloud-brokered path first because remote access and offline delivery are the primary use case. Keep the direct adapter as a later option for local, low-latency, or privacy-sensitive use. Do not expose both choices to normal users; connectivity belongs in the connection center.

## Cron scheduling is a separate decision

The access path does not determine who triggers an Agent Cron Job.

| Scheduler owner | Behavior | Main constraint |
| --- | --- | --- |
| Cloud | At the scheduled time, starts a fresh Agent Prompt run; uses the broker only if device capabilities are needed | Prompts needing live local data still require an online device or an explicit data snapshot |
| Device | At the scheduled time, the client asks the Agent to start a Prompt run | ColorOS delivery is appropriate for alarms, but high-frequency or business-critical Cron needs separate reliability validation |

Personal alarms always use the device scheduler. Agent jobs should declare their scheduler owner in the data contract even if the first version supports only one. The UI does not need to expose this implementation detail.

## Cloud responsibilities and non-responsibilities

The cloud should provide:

- User, device, and Agent identity and scoped grants.
- Pairing, capability discovery, heartbeat, and online status.
- Desired commands, delivery acknowledgements, execution results, and idempotency keys.
- Offline outbox and an auditable command history.
- Optional remote tool / MCP endpoint for Agents.

The cloud is not inherently:

- The Agent itself or the model provider.
- The owner of local alarm execution; only ColorOS can confirm that.
- A required copy of note contents or Prompt results. Retention must be separately chosen.

## State contract

For device commands:

```text
ACCEPTED → DELIVERED → ACKNOWLEDGED → EXECUTED
                     ↘ OFFLINE_QUEUED
                     ↘ REJECTED / FAILED / EXPIRED
```

`ACCEPTED` means the cloud accepted a request. `EXECUTED` means the client confirmed the actual result. UI and Agent responses must preserve this distinction. Repeating a command with the same idempotency key must not create duplicate alarms or jobs.

## Connection-center implications

The current connection center should eventually communicate:

- Cloud relay: endpoint, account, device identity, online state, last heartbeat.
- Agent grants: which capabilities each Agent may use, with revoke.
- Delivery state: queued, delivered, executed, or failed.
- Direct access: optional advanced adapter, disabled by default; no manual public-port setup in the normal flow.

These are design changes to align before modifying the interactive prototype.

## Open decisions

1. **Scheduler ownership for Agent Cron Jobs**: cloud, device, or both with a hidden default.
2. **Data retention**: relay metadata only, or also Prompts and results; retention period and deletion behavior.
3. **Direct access timing**: required in the first release, or deferred until the shared cloud path works.
4. **Offline semantics**: how long commands remain queued, and which commands should expire instead of executing late.

## Minimum validation sequence

1. One cloud relay command creates a real ColorOS alarm and returns a device acknowledgement.
2. The same idempotency key repeated twice creates only one alarm.
3. An offline command becomes `OFFLINE_QUEUED`, then executes or expires according to policy after reconnect.
4. Revoking an Agent grant prevents new commands without deleting existing local alarms.
5. Only after the shared contract works, run the same contract through the direct adapter.
