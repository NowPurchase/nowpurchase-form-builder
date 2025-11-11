# Admin Panel Frontend

A modern React-based admin panel for managing dynamic forms with a drag-and-drop form builder.

## 🚀 Features

- **Form Builder**: Create and edit dynamic forms with drag-and-drop interface
- **Form Management**: List, view, edit, and duplicate forms
- **Authentication**: Secure login with token-based authentication
- **Customer Management**: Associate forms with customers
- **Multi-Step Forms**: Support for both single and multi-step form types
- **Auto-Save**: Automatic draft saving to prevent data loss
- **Responsive Design**: Modern, compact UI optimized for productivity

## 📋 Prerequisites

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher (comes with Node.js)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AdminpannelFE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create `.env.qa` file for QA environment:
   ```bash
   VITE_API_BASE_URL=https://test-api.nowpurchase.com/api
   ```

   Create `.env.production` file for production environment:
   ```bash
   VITE_API_BASE_URL=https://api.nowpurchase.com/api
   ```

   > **Note**: Environment files are gitignored. Make sure to create them before running the project.

## 🏃 Running the Project

### Development Mode (QA Environment)

Start the development server with hot-reload:

```bash
npm run dev
```

The application will be available at `http://localhost:5174` (or the next available port).

### Preview Production Build

Preview the production build locally:

```bash
npm run build:prod
npm run preview
```

## 🏗️ Building for Production

### Build for QA Environment

```bash
npm run build:qa
```

This creates an optimized build in the `dist/` folder using the QA API endpoint.

### Build for Production Environment

```bash
npm run build:prod
```

This creates an optimized build in the `dist/` folder using the production API endpoint.

> **Note**: The build output will be in the `dist/` directory. Deploy the contents of this folder to your web server.

## 📁 Project Structure

```
src/
├── components/
│   ├── pages/              # Route-level page components
│   │   ├── Home.jsx        # Dashboard with form list
│   │   ├── Login.jsx       # Authentication page
│   │   ├── NewForm.jsx    # Form builder page
│   │   └── ViewForm.jsx   # Form viewer page
│   ├── shared/             # Reusable components
│   │   ├── CustomerDropdown.jsx
│   │   ├── LoadingSpinner.jsx
│   │   └── Toast.jsx
│   └── ui/                 # UI primitives
│       └── table.jsx
├── services/               # API service layer
│   ├── api.js             # Base API functions
│   └── dynamicLogApi.js   # Dynamic log API endpoints
├── utils/                  # Utility functions
│   ├── dataTransform.js   # Data transformation utilities
│   └── errorHandler.js   # Error handling utilities
├── App.jsx                # Main app component with routing
└── main.jsx               # Application entry point
```

## 🔑 Environment Variables

| Variable | Description | QA Value | Production Value |
|----------|-------------|----------|------------------|
| `VITE_API_BASE_URL` | Base URL for API requests | `https://test-api.nowpurchase.com/api` | `https://api.nowpurchase.com/api` |

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (QA environment) |
| `npm run build:qa` | Build for QA environment |
| `npm run build:prod` | Build for production environment |
| `npm run lint` | Run ESLint to check code quality |
| `npm run preview` | Preview production build locally |

## 🔐 Authentication

The application uses token-based authentication:

1. Login with mobile number and password
2. Token is stored in `localStorage` with key `'auth'`
3. Token is automatically included in API requests via `Authorization: Token <token>` header
4. Logout clears the token and redirects to login page

## 🎨 Key Features Explained

### Form Builder
- **Single Form**: Simple form with one section
- **Multi-Step Form**: Form with multiple sections/steps
- **Auto-Save**: Form data is automatically saved to localStorage every 2 seconds
- **Draft Recovery**: If you refresh the page, your draft is automatically restored

### Form Management
- **List Forms**: View all forms with search, filter, and sort capabilities
- **Edit Form**: Click the edit icon to modify an existing form
- **Duplicate Form**: Click the duplicate icon to create a copy (auto-opens save modal)
- **View Form**: Click on a form row to preview the form

### Form Actions
- **Clear Form**: Reset form builder to default state (only for new forms)
- **Save Form**: Save form with template name, customer, and status
- **Edit Mode**: Uses PUT request to update existing form
- **Duplicate Mode**: Uses POST request to create new form

## 🐛 Troubleshooting

### Build fails with "VITE_API_BASE_URL is not set"
- Make sure `.env.qa` or `.env.production` file exists in the root directory
- Check that the file contains `VITE_API_BASE_URL=...`

### API calls failing
- Verify the API base URL in your environment file
- Check that the API server is running and accessible
- Verify your authentication token is valid

### Components not found after reorganization
- Make sure all import paths are updated to use the new structure:
  - Pages: `./components/pages/ComponentName`
  - Shared: `./components/shared/ComponentName`
  - UI: `./components/ui/componentName`

## 🚢 Deployment

### QA Deployment
```bash
npm run build:qa
# Deploy the dist/ folder contents
```

### Production Deployment
```bash
npm run build:prod
# Deploy the dist/ folder contents
```

> **Important**: Make sure to set the correct `VITE_API_BASE_URL` in your environment file before building.

## 📚 Technology Stack

- **React 18.3** - UI library
- **React Router 6.30** - Routing
- **Vite 5.4** - Build tool and dev server
- **RSuite 5.83** - UI component library
- **FormEngine** - Form builder library
- **Lucide React** - Icon library

## 👥 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

Private project - All rights reserved

---

**Last Updated**: November 2025

