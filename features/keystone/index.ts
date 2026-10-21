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

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const databaseURL = requiredEnv("DATABASE_URL");
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
      // send the email
      await sendPasswordResetEmail(args.token, args.identity);
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
      url: databaseURL,
      extendPrismaSchema: schema => preserveLegacyMoneyColumns(enforceRequiredBrokerageRelations(schema)),
    },
    lists: models,
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