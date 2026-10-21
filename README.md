# Openfront Real Estate

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fopenshiporg%2Fopenfront-real-estate&env=DATABASE_URL%2CSESSION_SECRET)

Openfront Real Estate is a self-hostable property-listing and brokerage-operations application. Visitors can explore properties and request information or showings. Brokerage teams manage listings, leads, showings, offers, deals, documents, tasks, and commission records.

## Demo

![Skyline image used by the Real Estate storefront](public/images/real-estate/photos/hero-austin-skyline.jpg)

Explore the application locally using the setup instructions below.

| | |
|---|---|
| **Public application** | `/` on your development URL |
| **Dashboard** | `/dashboard` on your development URL |

[Learn more →](https://openship.org/products/openfront-real-estate)

[Documentation →](https://docs.openship.org/docs/openfront/real-estate/)

## The Openfront Ecosystem

Openfront is part of an ecosystem of open-source commerce tools:

- **[Openfront E-commerce](https://github.com/openshiporg/openfront)**: Headless e-commerce for retail.
- **[Openfront Restaurant](https://github.com/openshiporg/openfront-restaurant)**: Restaurant ordering, point of sale, and kitchen operations.
- **[Openship](https://github.com/openshiporg/openship)**: Order routing for multi-channel fulfillment.
- **Openfront Real Estate**: (This repository) a self-hostable property-listing and brokerage-operations application.

## Core Features

### Admin Dashboard
Manage pipeline, leads, listings, store settings, showings, operations, people, reports through dedicated dashboard workspaces and permission-controlled data screens.

### Storefront
The public site exposes property discovery and `/listings/[slug]`, with inquiries, showing requests, saved discovery, and customer account workflows.

### Listings & Lead Relationships
Manage properties and media, capture inquiries, route leads, and track activities, saved searches, alerts, and agent tasks.

### Showings & Transactions
Request and schedule showings, collect feedback, manage offers and counteroffers, and coordinate deal stages, documents, inspections, and milestones.

### Brokerage Records
Maintain brokerage memberships, publication and representation authority, attributable document evidence, commission ledger entries, and retention records. Feed and syndication records do not by themselves establish an external MLS connection.

## Architecture

### Technology Stack
- **Frontend**: Next.js 16 with App Router and React 19.
- **Backend**: KeystoneJS 6 with a GraphQL API.
- **Database**: PostgreSQL with Prisma ORM.
- **Styling**: Tailwind CSS 4 and shared shadcn/ui components.
- **Authentication**: Password-based user accounts and session-based access with role capabilities.

### Application Structure
```text
openfront-real-estate/
├── app/                    # Public pages, dashboard routes, and HTTP endpoints
├── features/
│   ├── keystone/           # Backend models, access rules, and GraphQL workflows
│   ├── platform/           # Operator workspaces and onboarding
│   ├── storefront/         # Public application components and screens
│   └── dashboard/          # Authentication and shared dashboard shell
└── components/             # Shared UI components
```

### Data Models
The [model registry](features/keystone/models/index.ts) and [Prisma schema](schema.prisma) cover:

- Brokerages, memberships, settings, users, and roles.
- Properties, media, neighborhoods, inspections, valuations, and publication authority.
- Leads, activities, routing, showing requests, saved searches, and alerts.
- Offers, deals, documents, milestones, commissions, audit events, and outbox records.

## Getting Started

### Prerequisites
- Node.js 22, compatible with the [package requirements](package.json) and Next.js 16.
- A PostgreSQL database you can migrate.
- npm.

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/openshiporg/openfront-real-estate.git
   cd openfront-real-estate
   npm install
   ```

2. **Configure environment variables:**
   Create a local `.env` file using the [runtime configuration](features/keystone/index.ts) as the authority.

   ```env
   DATABASE_URL=postgresql://user:password@host/database
   SESSION_SECRET=replace-with-a-new-private-random-secret
   ```

   Generate the session secret with `openssl rand -hex 32`; use the generated value, not the placeholder. Never commit `.env`.

   Review [runtime configuration](features/keystone/index.ts) for additional application settings before building or deploying. Configure enabled integrations separately; the two values above are not a complete production configuration.

3. **Start development server:**
   ```bash
   npm run dev
   ```

   The development script prepares the backend schema, applies checked-in migrations, and starts Next.js.

4. **Access the application:**
   Open the URL `npm run dev` prints, then use these paths:

   - **Public application**: `/`
   - **Admin dashboard**: `/dashboard`
   - **GraphQL API**: `/api/graphql`

5. **Create your first admin user:**
   Visit `/dashboard/init` on an empty database to create the initial administrator, then sign in to the dashboard.

6. **Run application onboarding:**
   Run brokerage onboarding, review the active brokerage and memberships, and configure listing publication, agent assignments, and public identity.

## Development Commands

- `npm run dev` - Prepare the backend schema, apply migrations, and start Next.js development.
- `npm run build` - Build the backend and Next.js for production; does not apply migrations.
- `npm start` - Start the production Next.js server.
- `npm run migrate:gen` - Prepare the schema and generate/apply development migrations.
- `npm run migrate` - Apply checked-in Prisma migrations.
- `npm run lint` - Run the repository's ESLint script.

Use a disposable development database for migration generation. Review the script before running it against any existing data.

### Listing & Transaction Workflows
The [registered commands](features/keystone/mutations/index.ts) include inquiries, showing requests, saved discovery, listing publication authority, document evidence, and commission entries. Configure and implement external feed delivery separately from recording a feed or syndication request.

## Documentation

See the [Openfront Real Estate documentation](https://docs.openship.org/docs/openfront/real-estate/) for the application guide. The [backend models](features/keystone/models), [registered business workflows](features/keystone/mutations/index.ts), [access rules](features/keystone/access.ts), and [application routes](app) document the implementation in this repository.

## Security & Permissions

### Role-Based Access Control
- `canAccessDashboard` - Access dashboard.
- `canManageListings` - Manage listings.
- `canManageLeads` - Manage leads.
- `canManageShowings` - Manage showings.
- `canManageDeals` - Manage deals.
- `canViewReports` - View reports.

### Security Features
- Session-based authentication for signed-in users.
- Backend list access and workflow authorization, rather than dashboard visibility alone.
- Access combines an active brokerage membership, the selected brokerage, capability flags, and assignment filters. An agent's record access is not equivalent to global brokerage administration.

Review the [access implementation](features/keystone/access.ts) and individual workflow checks before extending permissions.

## Platform Components

### Admin Platform (`/dashboard`)
- **Pipeline**: `/dashboard/platform/pipeline`.
- **Leads**: `/dashboard/platform/leads`.
- **Listings**: `/dashboard/platform/listings`.
- **Store Settings**: `/dashboard/platform/store-settings`.
- **Showings**: `/dashboard/platform/showings`.
- **Operations**: `/dashboard/platform/operations`.
- **People**: `/dashboard/platform/people`.
- **Reports**: `/dashboard/platform/reports`.

### Storefront Experience
The public site exposes property discovery and `/listings/[slug]`, with inquiries, showing requests, saved discovery, and customer account workflows.

Manage properties and media, capture inquiries, route leads, and track activities, saved searches, alerts, and agent tasks.

## Deployment

### Production Deployment
The Vercel button imports this application's own repository. Provision PostgreSQL and configure the application's complete runtime requirements, storage, mail, and enabled providers before building. Importing the source does not configure these services.

Build the application and apply checked-in migrations as a release step before starting the server. Back up existing data before migration.

```bash
npm run build
npm run migrate
npm start
```

The included [Railway configuration](railway.toml) defines this app's build and startup lifecycle. Provision services and secrets separately.

### Scaling Considerations
Keep the shared PostgreSQL database, session secrets, and configured object storage consistent across application processes. Review background delivery and integration requirements before choosing a serverless runtime; a source import does not supply persistent workers.

## Contributing

Use the development commands above when preparing changes. Keep model changes and their migrations together, and describe workflow and permission changes in pull requests.

## License

No top-level license file or package license declaration is included in this repository.

## Support

- **Documentation**: [Openfront Real Estate guide](https://docs.openship.org/docs/openfront/real-estate/).
- **Issues**: [Report bugs and feature requests](https://github.com/openshiporg/openfront-real-estate/issues).
- **Product**: [Learn more about Openfront Real Estate](https://openship.org/products/openfront-real-estate).

---

Built with [Next.js](https://nextjs.org) and [KeystoneJS](https://keystonejs.com).
