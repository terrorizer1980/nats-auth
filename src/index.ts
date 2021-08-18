import fastify from "fastify";
import fastifyCors from "fastify-cors";
import pino from "pino";

import { MessagingAuthService } from "./auth/messaging-auth-service";
import { config } from "./config";
import {
  getNonceParamsSchema,
  GetNonceRequestParams,
  getNonceResponseSchema,
  postAuthBodySchema,
  PostAuthRequestBody,
  postAuthResponseSchema,
} from "./schemas";

const logger = pino({ level: "debug" });

const server = fastify({ logger });

server.register(fastifyCors, {
  origin: "*",
  methods: ["GET", "PUT", "POST", "OPTIONS"],
  preflightContinue: true,
});

const messagingService = new MessagingAuthService(
  {
    messagingUrl: config.messagingUrl,
    privateKey: config.privateKey!,
    publicKey: config.publicKey!,
  },
  logger.child({ module: "MessagingAuthService" }),
  config.adminToken
);

// Used during startup to monitor whether this service is awake & responsive
server.get("/ping", async () => {
  return "pong\n";
});

server.get<{ Params: GetNonceRequestParams }>(
  "/auth/:signerAddress",
  {
    schema: { params: getNonceParamsSchema, response: getNonceResponseSchema },
  },
  async (request, reply) => {
    const nonce = await messagingService.getNonce(request.params.signerAddress);
    return reply.status(200).send(nonce);
  }
);

server.post<{ Body: PostAuthRequestBody }>(
  "/auth",
  { schema: { body: postAuthBodySchema, response: postAuthResponseSchema } },
  async (request, reply) => {
    try {
      const token = await messagingService.verifyAndVend(
        request.body.sig,
        request.body.signerAddress,
        request.body.adminToken
      );
      return reply.status(200).send(token);
    } catch (err) {
      logger.error({ err }, "Error verifying and vending");
      if (err.message.includes("Verification failed")) {
        return reply.status(401).send(err.message);
      }
      return reply.status(500).send(err.message);
    }
  }
);

server.listen(config.port, "0.0.0.0", (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});
