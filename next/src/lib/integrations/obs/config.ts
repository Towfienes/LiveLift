import { isIP } from "node:net";
import { z } from "zod";

const flag = z.enum(["0", "1"]);
const schema = z.object({
  host: z.string().min(1).max(253).refine((host) => isIP(host) !== 0 || /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)),
  port: z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().int().min(1).max(65535)),
  password: z.string().min(1).max(1024),
  tls: flag,
});

export function readObsConfig(env: Readonly<Record<string, string | undefined>>) {
  if (env.LIVELIFT_OBS_ENABLED === undefined || env.LIVELIFT_OBS_ENABLED === "0") return { kind: "not_configured" } as const;
  const parsed = schema.safeParse({
    host: env.LIVELIFT_OBS_HOST ?? "127.0.0.1",
    port: env.LIVELIFT_OBS_PORT ?? "4455",
    password: env.LIVELIFT_OBS_PASSWORD,
    tls: env.LIVELIFT_OBS_TLS ?? "0",
  });
  if (env.LIVELIFT_OBS_ENABLED !== "1" || !parsed.success) return { kind: "invalid_config" } as const;
  const { host, port, password, tls } = parsed.data;
  // Remote connections require TLS. For stock OBS, use an SSH tunnel to loopback.
  if (tls === "0" && !["localhost", "127.0.0.1", "::1"].includes(host)) return { kind: "invalid_config" } as const;
  const address = isIP(host) === 6 ? `[${host}]` : host;
  return { kind: "configured", url: `${tls === "1" ? "wss" : "ws"}://${address}:${port}`, password } as const;
}
