# Franklin Planner

A Franklin-Covey-style daily planner web app.

## Project structure

```
franklin-planner/
├── .github/workflows/          # Azure Static Web Apps CI/CD
│   └── azure-static-web-apps.yml
├── src/                        # All deployed site files (app_location)
│   ├── index.html
│   ├── staticwebapp.config.json
│   ├── css/
│   │   └── planner.css
│   └── js/
│       ├── calendar.js
│       ├── fp-schedule.js
│       ├── notes.js
│       ├── schedule-behavior.js
│       ├── storage-adapter.js
│       └── tasks.js
└── README.md
```

## Current status

Client-side prototype using `localStorage` for persistence via `js/storage-adapter.js`.
A SharePoint-backed storage adapter is the next major piece of work — it will replace
`localStorageAdapter` with calls to Microsoft Graph, authenticated via Entra ID (Azure AD).

## Deployment

Hosted on Azure Static Web Apps. Deploys automatically on push to `main` via the
GitHub Actions workflow in `.github/workflows/azure-static-web-apps.yml`.
