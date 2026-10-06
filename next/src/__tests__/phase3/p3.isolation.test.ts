// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ProductionClient, isBackendAvailable } from "../../../acceptance/productionClient";
import {
  TEST_WORKSPACE_ID,
  TEST_ROOM_ID,
  TEST_GENERATION,
  TEST_PRODUCTION_CONTEXT,
} from "../../../acceptance/contractFixtures";

const hasLiveServer = isBackendAvailable();

describe("P3-ISOLATION: Deployment Isolation & Context Binding Acceptance", () => {
  describe("In-Process Isolation Contract & Context Specifications", () => {
    it("defines immutable production deployment binding (workspace, room, generation)", () => {
      expect(TEST_PRODUCTION_CONTEXT.workspaceId).toBe(TEST_WORKSPACE_ID);
      expect(TEST_PRODUCTION_CONTEXT.roomId).toBe(TEST_ROOM_ID);
      expect(TEST_PRODUCTION_CONTEXT.generation).toBe(TEST_GENERATION);
    });

    it("verifies headers contract for production context transport", () => {
      const client = new ProductionClient();
      const headers = client.getHeaders();
      expect(headers.get("X-LiveLift-Workspace")).toBe(client.config.workspaceId);
      expect(headers.get("X-LiveLift-Generation")).toBe(client.config.generation);
      expect(headers.get("X-LiveLift-Room")).toBe(client.config.roomId);
    });
  });

  describe.skipIf(!hasLiveServer)(
    "Live Deployment Context & Cross-Authorization Rejections",
    () => {
      const client = new ProductionClient();

      it("missing X-LiveLift-Workspace header returns 400 context_required", async () => {
        await client.login();
        const headers = client.getHeaders();
        headers.delete("X-LiveLift-Workspace");

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect(res.status).toBe(400);
      });

      it("missing X-LiveLift-Generation header returns 400 context_required", async () => {
        await client.login();
        const headers = client.getHeaders();
        headers.delete("X-LiveLift-Generation");

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect(res.status).toBe(400);
      });

      it("wrong workspace ID header returns 404 not_found", async () => {
        await client.login();
        const headers = client.getHeaders();
        headers.set(
          "X-LiveLift-Workspace",
          "99999999-9999-4999-8999-999999999999"
        );

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect(res.status).toBe(404);
      });

      it("wrong room ID in request returns 404 not_found", async () => {
        await client.login();
        const headers = client.getHeaders();
        headers.set("X-LiveLift-Room", "room-unconfigured-foreign");

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect(res.status).toBe(404);
      });

      it("outdated restore generation header returns 409 recovery_required", async () => {
        await client.login();
        const headers = client.getHeaders();
        // Client uses old generation prior to a restore
        headers.set(
          "X-LiveLift-Generation",
          "00000000-0000-4000-8000-000000000000"
        );

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect(res.status).toBe(409);
      });

      it("cross-installation / foreign session isolation: token from installation A fails on installation B", async () => {
        // Foreign session cookie from another deployment
        const foreignCookie = "__Host-livelift_session=foreign_random_token_from_another_tenant_123456789";
        const headers = client.getHeaders({ includeCookie: false });
        headers.set("Cookie", foreignCookie);

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect(res.status).toBe(401);
      });
    }
  );
});
