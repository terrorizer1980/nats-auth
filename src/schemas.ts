import { Static, Type } from "@sinclair/typebox";

const TSignerAddress = Type.String({
  example: "0xE540998865aFEB054021dc849Cc6191b8E09dC08",
  description: "Signer address",
});

// GET NONCE
export const getNonceParamsSchema = Type.Object({
  signerAddress: TSignerAddress,
});

export type GetNonceRequestParams = Static<typeof getNonceParamsSchema>;

export const getNonceResponseSchema = {
  200: Type.Object({
    nonce: Type.String({ example: "abc" }),
  }),
};
export type GetNonceResponseBody = Static<typeof getNonceResponseSchema["200"]>;

// POST AUTH
export const postAuthBodySchema = Type.Object({
  signerAddress: TSignerAddress,
  sig: Type.String({
    description: "Signature of nonce using signer private key",
  }),
  adminToken: Type.Optional(
    Type.String({
      example: "connext123",
      description: "Admin token to grant full permissions",
    })
  ),
});

export type PostAuthRequestBody = Static<typeof postAuthBodySchema>;

export const postAuthResponseSchema = {
  200: Type.Object({
    token: Type.String({
      example: "abc",
      description: "Token to be used for messaging auth",
    }),
  }),
};
export type PostAuthResponseBody = Static<typeof postAuthResponseSchema["200"]>;
