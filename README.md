# Product Catalog

Full-stack SAP CAP Application with Fiori Elements UI

## Project Structure

```
├── app/                        # UI Applications
│   └── products/              # Fiori Elements App
│       ├── webapp/            # Application code
│       │   ├── localService/  # Mock server for development
│       │   │   ├── metadata.xml
│       │   │   ├── mockserver.js
│       │   │   └── mockdata/  # JSON mock data
│       │   ├── test/          # Test pages
│       │   │   ├── flpSandbox.html  # Launchpad (recommended)
│       │   │   ├── mockServer.html   # Standalone with mock
│       │   │   └── initMockServer.js
│       │   ├── index.html     # Standalone entry point
│       │   └── manifest.json  # App descriptor
│       └── package.json       # UI dependencies
├── db/                        # Database layer
│   ├── schema.cds            # Data model (Products entity)
│   └── data/                 # CSV seed data
├── srv/                       # Service layer
│   ├── catalog-service.cds   # OData V4 service
│   └── annotations/          # UI annotations
│       └── Products/         # Entity-specific annotations
│           ├── ui.cds
│           ├── valuehelps.cds
│           └── constraints.cds
├── package.json              # Backend dependencies
└── mta.yaml                  # Cloud Foundry deployment
```

## Features

- **OData V4 Service**: Modern protocol with full CRUD support
- **Fiori Elements**: List Report + Object Page patterns
- **Managed Aspects**: Built-in createdAt, modifiedAt, createdBy, modifiedBy
- **Currency Integration**: Price with currency code (USD)
- **Mock Server**: Frontend development without backend
- **SQLite Database**: Local development with 15 sample products

## Running the Application

### Option 1: Full Stack (Backend + Frontend)

1. Install dependencies:

   ```bash
   npm install
   cd app/products && npm install && cd ../..
   ```

2. Start the CAP server:

   ```bash
   npm run watch
   ```

3. Access the application:
   - Service endpoint: <http://localhost:4004>
   - Metadata: <http://localhost:4004/odata/v4/catalog/$metadata>
   - Fiori Launchpad: <http://localhost:4004/products/webapp/test/flpSandbox.html>

### Option 2: Frontend Only (Mock Server)

Run without backend using mock data:

```bash
cd app/products
npm run start-mock
```

Opens: <http://localhost:8080/test/mockServer.html>

## Available Scripts

### Backend (from root)

- `npm run watch` - Start CAP server with auto-reload
- `npm run build` - Build for production
- `npm run deploy` - Deploy database schema

### Frontend (from app/products)

- `npm run start-mock` - Run with mock server (no backend needed)

## Entry Points

1. **flpSandbox.html** (Recommended) - Full Fiori Launchpad sandbox
2. **mockServer.html** - Standalone with mock data
3. **index.html** - Standalone with Launchpad shell

## Technologies

### Backend

- **SAP CAP** - Cloud Application Programming Model v8
- **Node.js** - Runtime with Express
- **SQLite** - Development database (@cap-js/sqlite)
- **OData V4** - Protocol for REST APIs

### Frontend

- **SAP Fiori Elements** - Template-based UI (sap.fe.templates)
- **SAPUI5** - Latest version from CDN
- **UI5 Tooling** - Build and development tools
- **Sinon.js** - HTTP mocking for testing (built-in UI5)

## Mock Server Details

The mock server (`localService/mockserver.js`) uses **Sinon.js** to intercept OData V4 requests:

- Metadata served from `metadata.xml`
- Data loaded from `mockdata/Products.json`
- Supports GET requests for collections and single entities
- No backend required for frontend development

**Note**: `sap.ui.core.util.MockServer` does not support OData V4, so we use Sinon.js fake server instead.

## Data Model

```cds
entity Products : managed {
  key ID          : UUID;
  name            : String(100);
  description     : String(500);
  price           : Decimal(10,2);
  currency        : Currency;
  stock           : Integer;
  category        : String(50);
  imageUrl        : String(255);
}
```

### Built-in Fields (managed aspect)

- `createdAt` / `createdBy`
- `modifiedAt` / `modifiedBy`
