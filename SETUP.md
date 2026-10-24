# Local setup

Follow the repository [README](README.md) for requirements, dependency
installation, environment setup, Docker/PostgreSQL startup, database setup,
development servers and test commands.

The backend uses `backend/.env.example` as its environment template. Copy it to
`backend/.env`, replace example secrets with local random values, and keep the
file private and untracked. Local PostgreSQL hostnames should use `127.0.0.1`.

If Docker is unavailable, continue with frontend-only build checks and
non-database tests. The API reports a degraded health state until its database
connection is available; do not treat that state as ready for customer orders.
