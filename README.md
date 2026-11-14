# RoadMap2 🚀

A web application built with Node.js and Express.

## 🛠 Features
- **Authentication:** Secure login and user management (see `src/controllers/authController.js`).
- **Clean Architecture:** Separated into routes, services, and controllers for scalability.
- **Database Integration:** Configured via `src/config/db.js`.

## 📁 Project Structure
Based on the current development state:
- `public/`: Static assets (HTML, CSS, Client-side JS).
- `src/`: Backend logic, including middleware and utility functions.
- `server.js`: The main entry point for the application.

## Release hardening

This source package includes a release-hardening pass and a record of changes, required environment variables, and outstanding deployment/legal steps in [`RELEASE_READINESS.md`](./RELEASE_READINESS.md).

Run the built-in checks with `npm test`. Before production deployment, configure the required secrets and trusted origins described in that document. Back up PostgreSQL before running `npm run encrypt:spotify-tokens` to migrate existing Spotify token rows to encrypted storage.
