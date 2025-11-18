# Product Catalog

SAP CAP Application with Product Catalog

## Project Structure

```
├── app/                    # UI Applications
│   └── products/          # Fiori Elements List Report & Object Page
├── db/                     # Database artifacts
│   ├── schema.cds         # Data model
│   └── data/              # Mock data (CSV)
├── srv/                    # Service layer
│   └── catalog-service.cds # Service definitions & annotations
├── package.json           # Project dependencies
└── mta.yaml              # Multi-Target Application descriptor
```

## Features

- **Product Catalog**: Manage products with name, description, price, stock, and category
- **Worklist (List Report)**: Browse and filter products
- **Object Page**: View and edit product details
- **Mock Database**: SQLite with sample data

## Running the Application

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
- Service endpoint: http://localhost:4004
- Fiori Launchpad: http://localhost:4004/fiori.html
- Products app: http://localhost:4004/products/webapp/index.html

## Development

- **Watch mode**: `npm run watch` - Auto-reload on changes
- **Build**: `npm run build` - Build for production
- **Deploy data**: Automatic on first start

## Technologies

- SAP Cloud Application Programming Model (CAP)
- SAP Fiori Elements
- Node.js
- SQLite (development database)
- OData V4
