import { env } from "cloudflare:workers";
import {
  OAuthResourceServer,
  type AuthorizationServerBinding,
  type OAuthResourceContext,
} from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import { z } from "zod";
import {
  loadLinkedCowilaTrainingRecord,
  type CowilaServiceConfig,
} from "./cowila-service";
import type { D1DatabaseLike } from "./firebase-credential-store";
import type { CowilaTrainingRecord } from "./firestore-cowila";

interface CowilaAuthProps {
  userId: string;
  email: string;
}

interface Env {
  AUTH_SERVER: AuthorizationServerBinding<CowilaAuthProps>;
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_DATABASE_ID: string;
  FIREBASE_API_KEY: string;
  FIREBASE_VAULT_KEY: string;
}

const MCP_RESOURCE = "https://cowila-mcp.example.invalid/mcp";
const AUTH_ISSUER = "https://cowila-auth.example.invalid";

function principal(): CowilaAuthProps {
  const props = getMcpAuthContext()?.props as Record<string, unknown> | undefined;
  if (
    !props ||
    typeof props.userId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(props.userId) ||
    props.email !== "antonyopintor@gmail.com"
  ) {
    throw new Error("The authenticated Cowila operator identity is unavailable.");
  }
  return { userId: props.userId, email: props.email };
}

function serviceConfig(bindings: Env): CowilaServiceConfig {
  return {
    projectId: bindings.FIREBASE_PROJECT_ID,
    databaseId: bindings.FIREBASE_DATABASE_ID,
    firebaseApiKey: bindings.FIREBASE_API_KEY,
    vaultKey: bindings.FIREBASE_VAULT_KEY,
  };
}

async function loadRecord(bindings: Env): Promise<CowilaTrainingRecord> {
  const identity = principal();
  const record = await loadLinkedCowilaTrainingRecord(
    bindings.DB as unknown as D1DatabaseLike,
    identity.userId,
    serviceConfig(bindings),
  );
  if (!record) throw new Error("The Cowila training record does not exist yet.");
  return record;
}

function createCowilaMcpServer() {
  const server = new McpServer({
    name: "Cowila Private Training History",
    version: "0.1.0",
  });

  server.registerTool(
    "cowila_get_training_summary",
    {
      description: "Read a compact summary of the authenticated operator's Cowila training record. Does not expose message content.",
    },
    async () => {
      try {
        const record = await loadRecord(env as unknown as Env);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              schemaVersion: record.schemaVersion,
              messageCount: record.messages.length,
              userMessageCount: record.messages.filter((message) => message.role === "user").length,
              assistantMessageCount: record.messages.filter((message) => message.role === "assistant").length,
              approvedForTrainingCount: record.messages.filter((message) => message.approvedForTraining === true).length,
              instructions: record.instructions,
              updatedAt: record.updatedAt,
            }),
          }],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Cowila record could not be read." }] };
      }
    },
  );

  server.registerTool(
    "cowila_get_recent_messages",
    {
      description: "Read the most recent messages from the authenticated operator's Cowila training record. Message text is private; request only the number of messages needed.",
      inputSchema: { limit: z.number().int().min(1).max(25).optional().default(10) },
    },
    async ({ limit }) => {
      try {
        const record = await loadRecord(env as unknown as Env);
        const messages = record.messages.slice(-limit).map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content.slice(0, 5_000),
          createdAt: message.createdAt,
          rating: message.rating,
          feedback: message.feedback,
          approvedForTraining: message.approvedForTraining,
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ returned: messages.length, total: record.messages.length, messages }) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Cowila messages could not be read." }] };
      }
    },
  );

  server.registerTool(
    "cowila_search_messages",
    {
      description: "Search message text in the authenticated operator's Cowila training record. Search is local to the single permitted v2 document and returns at most 20 matches.",
      inputSchema: {
        query: z.string().trim().min(2).max(200),
        limit: z.number().int().min(1).max(20).optional().default(10),
      },
    },
    async ({ query, limit }) => {
      try {
        const record = await loadRecord(env as unknown as Env);
        const needle = query.toLocaleLowerCase("pt-BR");
        const matches = record.messages
          .map((message, index) => ({ message, index }))
          .filter(({ message }) => message.content.toLocaleLowerCase("pt-BR").includes(needle))
          .slice(-limit)
          .map(({ message, index }) => ({
            index,
            id: message.id,
            role: message.role,
            content: message.content.slice(0, 2_000),
            createdAt: message.createdAt,
          }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ matchCountReturned: matches.length, matches }) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Cowila search failed." }] };
      }
    },
  );

  return server;
}

const mcpHandler = createMcpHandler(createCowilaMcpServer, {
  route: "/mcp",
  legacy: "reject",
});

const resourceServer = new OAuthResourceServer<Env, CowilaAuthProps>({
  resourceMetadata: {
    resource: MCP_RESOURCE,
    authorization_servers: [AUTH_ISSUER],
    resource_name: "Cowila private training history",
    bearer_methods_supported: ["header"],
  },
  requiredScopes: ["mcp:read"],
  validateToken: (bindings) => bindings.AUTH_SERVER.validateToken,
  handler: {
    fetch(request: Request, bindings: Env, context: OAuthResourceContext<CowilaAuthProps>) {
      if (!context.auth.scope.includes("mcp:read")) {
        return new Response("Insufficient scope", {
          status: 403,
          headers: { "cache-control": "no-store" },
        });
      }
      if (
        !context.props ||
        typeof context.props.userId !== "string" ||
        context.props.email !== "antonyopintor@gmail.com" ||
        context.auth.userId !== context.props.userId
      ) {
        return new Response("Authenticated Cowila principal is invalid", {
          status: 403,
          headers: { "cache-control": "no-store" },
        });
      }
      return mcpHandler(request, bindings, context);
    },
  },
});

export default {
  fetch(request: Request, bindings: Env, context: ExecutionContext) {
    return resourceServer.fetch(request, bindings, context);
  },
} satisfies ExportedHandler<Env>;
