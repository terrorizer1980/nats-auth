import { BaseLogger } from "pino";
import { AuthService } from "ts-natsutil";
import { utils } from "ethers";

const nonceTTL = 24 * 60 * 60 * 1000; // 1 day

const MESSAGE_PREFIX = `Hi there from Connext! Sign this message to make sure that no one can communicate on the Connext Network on your behalf. This will not cost you any Ether!
  
To stop hackers from using your wallet, here's a unique message ID that they can't guess: `;

type AuthConfig = {
  clusterId?: string;
  messagingUrl: string | string[];
  options?: any;
  privateKey?: string;
  publicKey?: string;
  token?: string;
};

export class MessagingAuthService {
  private auth: AuthService;
  private defaultJWTAudience: string;
  private nonces: { [key: string]: { nonce: string; expiry: number } } = {};

  constructor(
    private readonly config: AuthConfig,
    private readonly logger: BaseLogger,
    private readonly adminToken: string
  ) {
    this.logger.info({ ...config, privateKey: "*********" }, `Created messaging auth service`);

    this.defaultJWTAudience = this.config.messagingUrl as string;
    this.auth = new AuthService(
      this.logger.child({ module: "AuthService" }),
      this.defaultJWTAudience,
      this.config.privateKey!,
      this.config.publicKey!
    );
  }

  public async getNonce(userIdentifier: string): Promise<string> {
    const nonce = utils.hexlify(utils.randomBytes(32));
    const expiry = Date.now() + nonceTTL;
    // currently storing nonces in memory
    this.nonces[userIdentifier] = { expiry, nonce };
    this.logger.info({ userIdentifier, expiry, nonce, method: "getNonce" });
    return nonce;
  }

  public async verifyAndVend(
    signedNonce: string,
    signerAddress: string,
    adminToken?: string
  ): Promise<string> {
    if (adminToken === this.adminToken) {
      this.logger.warn(`Vending admin token to ${signerAddress}`);
      return this.vendAdminToken(signerAddress);
    }

    if (!this.nonces[signerAddress]) {
      throw new Error(`User hasn't requested a nonce yet`);
    }

    const { nonce, expiry } = this.nonces[signerAddress];
    const recovered = utils.verifyMessage(MESSAGE_PREFIX + nonce, signedNonce);
    if (recovered !== signerAddress) {
      throw new Error(
        `Verification failed, expected ${signerAddress}, got ${recovered}`
      );
    }
    if (Date.now() > expiry) {
      throw new Error(
        `Verification failed... nonce expired for address: ${signerAddress}`
      );
    }

    // publish as "to.from.subject", respond to _INBOX
    const permissions = {
      publish: {
        allow: [`*.${signerAddress}.>`, `_INBOX.>`],
      },
      subscribe: {
        allow: [`>`],
      },
    };

    const jwt = await this.vend(signerAddress, nonceTTL, permissions);
    this.logger.info({ jwt, signerAddress, permissions }, "Vended token");
    return jwt;
  }

  private async vendAdminToken(userIdentifier: string): Promise<string> {
    const permissions = {
      publish: {
        allow: [`>`],
      },
      subscribe: {
        allow: [`>`],
      },
    };

    const jwt = this.vend(userIdentifier, nonceTTL, permissions);
    return jwt;
  }

  private vend(
    subject: string,
    ttl: number,
    permissions: any
  ): Promise<string> {
    return this.auth.vendBearerJWT(subject, ttl, permissions);
  }

  private verify(bearerToken: string): boolean {
    return this.auth.verifyBearerJWT(bearerToken);
  }
}
