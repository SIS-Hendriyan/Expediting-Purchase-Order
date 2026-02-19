# Expediting-PO

This repository contains a full-stack application for managing and expediting purchase orders. It is organized into two main parts:

- **backend/**: ASP.NET Core Web API (C#)
- **frontend/**: Vite + React (TypeScript)

---

## Backend

- **Location:** `backend/`
- **Tech Stack:**
  - ASP.NET Core 8.0
  - RESTful API
  - Entity Framework (if used)
  - SSO integration (see `ConnectedServices/SsoService/`)
- **Key Files/Folders:**
  - `Controllers/`: API endpoints
  - `Models/`: Data models
  - `Services/`: Business logic and data access
  - `Helpers/`: Utility classes
  - `appsettings.json`: Configuration
- **Run Locally:**
  1. Navigate to `backend/`
  2. Restore dependencies: `dotnet restore`
  3. Run the API: `dotnet run`

---

## Frontend

- **Location:** `frontend/`
- **Tech Stack:**
  - React 18
  - TypeScript
  - Vite
- **Key Files/Folders:**
  - `src/`: Application source code
    - `components/`: UI components
    - `services/`: API and auth logic
    - `utils/`: Utility functions
    - `styles/`: Global and component styles
  - `vite.config.ts`: Vite configuration
- **Run Locally:**
  1. Navigate to `frontend/`
  2. Install dependencies: `npm install`
  3. Start dev server: `npm run dev`

---

## Development

- Clone the repository
- Set up both backend and frontend as described above
- Adjust configuration files as needed (e.g., API URLs, connection strings)

---

## License

Specify your license here (e.g., MIT, Apache 2.0, etc.)

---

## Contact

For questions or support, please contact the repository maintainer.
