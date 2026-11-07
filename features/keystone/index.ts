import { createAuth } from "@keystone-6/auth";
import { config } from "@keystone-6/core";
import "dotenv/config";
import { models } from "./models";
import { statelessSessions } from "@keystone-6/core/session";
import { extendGraphqlSchema } from "./mutations";
import { sendPasswordResetEmail } from "./lib/mail";
import { installInitialOwnerResolver } from './lib/initialOwnerBootstrap';
import { permissions } from './access';
import { preserveLegacyMoneyColumns } from './lib/money';
import { s3ForcePathStyle } from './lib/s3-storage';
import { pooledDatabaseUrl } from './database-url';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const databaseURL = requiredEnv("DATABASE_URL");

// As in E-commerce: placeholder storage only outside production.
function productionEnv(name: string, developmentFallback: string): string {
  if (process.env[name]) return process.env[name]!;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`);
  }
  return developmentFallback;
}

const bucketName = productionEnv("S3_BUCKET_NAME", "keystone-test");
const region = productionEnv("S3_REGION", "ap-southeast-2");
const accessKeyId = productionEnv("S3_ACCESS_KEY_ID", "keystone");
const secretAccessKey = productionEnv("S3_SECRET_ACCESS_KEY", "keystone");
const endpoint = productionEnv("S3_ENDPOINT", "https://sfo3.digitaloceanspaces.com");
const sessionSecret = requiredEnv("SESSION_SECRET");
if (sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters long");
}

const requiredBrokerageModels = [
  "AgentTask",
  "DealDocument",
  "SavedSearch",
  "SavedSearchAlert",
  "SourceFeed",
  "TransactionMilestone",
] as const;

function enforceRequiredBrokerageRelations(schema: string) {
  let next = schema;
  for (const model of requiredBrokerageModels) {
    const blockPattern = new RegExp(`(model ${model} \\{[\\s\\S]*?\\n\\})`);
    const match = next.match(blockPattern);
    if (!match) throw new Error(`Generated Prisma model ${model} is missing.`);
    const updated = match[1]
      .replace(/brokerage(\s+)Brokerage\?(\s+)@relation/, "brokerage$1Brokerage$2@relation")
      .replace(/brokerageId(\s+)String\?(\s+)@map\("brokerage"\)/, 'brokerageId$1String$2@map("brokerage")');
    if (updated === match[1]) throw new Error(`Generated Prisma model ${model} no longer has the expected brokerage relation shape.`);
    next = next.replace(match[1], updated);
  }
  return next;
}

export const basePath = "/dashboard";

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 30,
  secret: sessionSecret,
};

const { withAuth } = createAuth({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    // The generated createInitialUser resolver is replaced below so the user,
    // authority roots, required membership, and active brokerage commit together.
    itemData: {},
  },
  passwordResetLink: {
    async sendToken(args) {
      // Storefront customers hold no brokerage memberships; their link opens the storefront reset page.
      const user = await args.context.sudo().query.User.findOne({ where: { id: String(args.itemId) }, query: "id brokerageMemberships(take: 1) { id }" });
      const customer = Boolean(user && !user.brokerageMemberships?.length);
      await sendPasswordResetEmail(args.token, args.identity, undefined, customer ? "/password-reset" : undefined);
    },
  },
  sessionData: `
    id
    name
    email
    activeBrokerage { id slug status }
    brokerageMemberships {
      id
      membershipRole
      status
      isPrimary
      brokerage { id slug status }
    }
    role {
      id
      name
      canSeeOtherPeople
      canEditOtherPeople
      canManagePeople
      canManageRoles
      canAccessDashboard
      canManageListings
      canManageLeads
      canManageShowings
      canManageDeals
      canViewReports
      canManageOnboarding
    }
  `,
});

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: pooledDatabaseUrl(databaseURL),
      extendPrismaSchema: schema => preserveLegacyMoneyColumns(enforceRequiredBrokerageRelations(schema)),
    },
    lists: models,
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint,
        signed: { expiry: 5000 },
        forcePathStyle: s3ForcePathStyle(endpoint),
      },
    },
    ui: {
      isAccessAllowed: ({ session }) => permissions.canAccessDashboard({ session }),
      basePath,
    },
    session: statelessSessions(sessionConfig),
    graphql: {
      extendGraphqlSchema: schema => installInitialOwnerResolver(extendGraphqlSchema(schema)),
    },
  })
);