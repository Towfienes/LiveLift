# OBS Bridge V1

LiveLift observes OBS Studio as a broadcast engine. OBS state is separate from TikTok platform state and from LiveLift show authority. This bridge is read-only: it cannot switch scenes, start/stop streaming, pin products, or send authority commands.

## Setup

Use OBS Studio **28 or later**, which includes obs-websocket V5. In OBS, open **Tools → WebSocket Server Settings**, enable the WebSocket server, leave **Enable Authentication** enabled, and set a strong password. The usual local port is **4455**. Apply the settings and keep OBS running. See the [official obs-websocket setup](https://github.com/obsproject/obs-websocket#readme) and [V5 protocol](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md).

Configure the **LiveLift Node server process** using a protected environment file (`chmod 600`). For a local development installation, these can live in the ignored `next/.env.local`; for a managed installation, use its existing protected service environment. Do not commit the file or copy secrets into browser configuration.

```dotenv
LIVELIFT_OBS_ENABLED=1
LIVELIFT_OBS_HOST=127.0.0.1
LIVELIFT_OBS_PORT=4455
LIVELIFT_OBS_PASSWORD=<same password as OBS>
LIVELIFT_OBS_TLS=0
```

Restart LiveLift after changing configuration. Use **Node 22.23.3**, install with `npm ci` from `next/`, and start LiveLift through your existing deployment or `npm run dev`. Existing LiveLift authentication/deployment configuration is still required. Sign in to LiveLift and open **`/obs`**. Its first authorized read starts the bridge; subsequent reads share one websocket per Node process. Viewers and operators may view status. A viewer gains no write capability.

The independent `GET /api/obs/status` endpoint uses the existing LiveLift authorization boundary. Production uses its existing HttpOnly session cookie plus workspace/generation headers. It returns `Cache-Control: no-store`. The dedicated page supplies those headers; an API client must follow the existing session contract. This endpoint accepts no OBS credentials or arbitrary target addresses. There are no OBS write endpoints.

## Configuration and network security

| Variable | Default | Meaning |
| --- | --- | --- |
| `LIVELIFT_OBS_ENABLED` | unset | Unset or `0`: not configured, no connection. `1`: enable. |
| `LIVELIFT_OBS_HOST` | `127.0.0.1` | Bare hostname or IP, without scheme, credentials, path, or port. |
| `LIVELIFT_OBS_PORT` | `4455` | Integer from 1 to 65535. |
| `LIVELIFT_OBS_PASSWORD` | none | Required when enabled, 1–1024 characters. Server process only. |
| `LIVELIFT_OBS_TLS` | `0` | `0`: local `ws`; `1`: certificate-validated `wss`. |

Plain websocket connections are accepted only for `127.0.0.1`, `::1`, or `localhost`. Other hosts require TLS. OBS itself normally supplies a plain websocket endpoint; to reach another computer, prefer an SSH tunnel and keep LiveLift configured for loopback. A TLS proxy is an alternative for an explicitly configured remote host; certificate verification is never disabled.

The bridge opens an outbound connection; it adds no listening port or LAN binding. OBS server exposure is controlled by OBS and your firewall: keep port 4455 inaccessible from the LAN/Internet by default. Never port-forward it publicly. OBS uses challenge-response authentication, which does not replace transport encryption on an untrusted network. The bridge refuses an OBS server with authentication disabled.

The password is held in private server fields, never in localStorage, API responses, logs, or client bundles. Error output is a fixed code, without raw websocket errors, close reasons, authentication frames, or provider comments. Provider scene text that exactly contains the configured password is masked with `[redacted]`. The bridge adds no dependencies and changes no database schema or LiveLift authentication code.

## V1 state and truth

| Field/state | Meaning |
| --- | --- |
| `not_configured` | Bridge disabled; no network work. |
| `connecting` | Transport/authentication pending. |
| `connected` | OBS acknowledged authentication; individual observations can still be unknown while reads are pending. |
| `disconnected` | Observations cleared; reconnect scheduled, or explicitly stopped. |
| `unavailable` | Invalid configuration, terminal protocol/auth failure, or retry budget exhausted. |
| `currentProgramScene` | OBS program scene; preview scene is not substituted. `null` means unknown. |
| `scenes` | OBS scene-name list; event updates and periodic reconciliation. |
| `streamActive` | OBS's `outputActive` boolean; `null` means unknown, never implicitly inactive. |
| `streamSupported` | `false` only when OBS reports the stream request unsupported; `null` until support is known. |

All observations identify `provider: "obs"` and `provenance: "provider_observed"`. Each value has an ISO UTC `receivedAt` from the bridge clock. These OBS messages supply no provider wall-clock time, so `providerTimestamp` is explicitly `null`. The UI labels timestamps as receipt times. `statusChangedAt` timestamps the bridge connection state, not a broadcast/platform transition.

The adapter reads `GetSceneList` (including the program scene) and `GetStreamStatus`, and subscribes only to Config, Scenes and Outputs events. It resynchronizes on scene mutations/collection changes and every 30 seconds. An event received after a read was sent takes precedence over that read. Scene reads pause while a collection is changing. Unknown unrelated events confer no additional truth.

**LiveLift does not infer any of the following from OBS:** TikTok LIVE/offline status, product pins, product availability, audience, platform delivery, or successful commerce actions. An active OBS stream output does not confirm that TikTok received it. A scene named “TikTok LIVE” or “product pinned” is just an OBS scene name. OBS observations never update a show's lifecycle, authority revision, command receipts, or transition engine. Those semantics remain with their existing authorities/providers.

## Failures and reconnects

The handshake and each read have a 5-second deadline. Connection/timeout/read failures clear all observations before retrying. Silent loss is detected by periodic reads, normally within 35 seconds; displayed values always retain their receipt times. Malformed relevant messages fail closed and clear state. The parser bounds message/scene collection sizes; the native websocket still buffers frames before parsing, so connect only to the configured trusted OBS endpoint.

There are **at most five automatic reconnects per bridge lifetime**, delayed 1, 2, 4, 8, and 16 seconds. Successful authentication does not reset this budget, preventing endless flapping. Browser polling does not restart an exhausted bridge. Password failures, disabled OBS authentication, and invalid protocol messages stop immediately. After fixing the cause, restart the LiveLift process to reset the budget and reread configuration.

The bridge is designed for the existing single-process installation with one OBS instance. Multiple Node workers would each connect independently; coordinate ownership before deploying it across workers. OBS is optional: its failure does not gate LiveLift readiness or alter show authority.

## Linux / CachyOS workflow

1. Launch your installed OBS Studio (`obs` on a native installation), or launch the `com.obsproject.Studio` Flatpak. Verify OBS is version 28+.
2. Enable and authenticate the WebSocket server in OBS as above. Keep OBS and LiveLift on the same machine for the simplest setup.
3. Save the LiveLift variables in its protected environment file; restart the Node 22.23.3 process. Port 4455 is OBS; port 3130 is LiveLift development.
4. Sign in, visit `/obs`, and change the **program** scene in OBS. Confirm the scene and receipt time update. In Studio Mode, changing only the preview should not change the program observation.
5. Start/stop streaming manually in OBS only if your broadcast destination is configured and it is appropriate to transmit. Check the OBS streaming-output field; separately verify actual platform state through that platform.
6. Close OBS and confirm observations become unknown. Reopen OBS within the retry budget to check reconnection; otherwise restart LiveLift after OBS is ready.

For OBS on a remote Linux computer, an example private tunnel is:

```sh
ssh -N -L 127.0.0.1:4456:127.0.0.1:4455 user@obs-host
```

Set LiveLift's host to `127.0.0.1` and port to `4456`, and retain the OBS password. A Flatpak's network sandbox/firewall can affect reachability; check that the loopback port is reachable from the LiveLift process before changing exposure rules.

## Automated verification

No OBS installation, network, stream credentials, or real transmission is required for tests. The deterministic `MockObsSocket` fixture supplies V5 handshakes, requests, events and disconnects with fake timers. Adapter tests cover disabled/invalid config, authentication, scene/list updates, streams, unsupported streams, receipt timestamps, stale response races, collection changes, transport loss, retry exhaustion, malformed messages, private/redacted secrets and absence of TikTok inference. Endpoint tests exercise the existing authorization boundary with storage isolated; panel tests cover visible status and loss of access/contact.

From `next/`, under Node 22.23.3:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

An optional real smoke test follows steps 3–6 above with locally configured OBS. Never require it in CI, print the password, or start a broadcast solely to validate the adapter.
