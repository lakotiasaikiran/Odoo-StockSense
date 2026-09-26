# StockSense Sprint Plan

## Sprint 1 — Foundation and database
- Define the warehouse, location, product, stock quant, and stock move schema.
- Configure PostgreSQL connection parameters and Docker support.
- Create a reusable inventory service layer and validation tests.

## Sprint 2 — Core stock operations
- Implement receipt, delivery, internal transfer, and stock adjustment logic.
- Enforce status logic for waiting/ready/done flows.
- Add dashboard KPIs and low-stock calculations.

## Sprint 3 — Web application and UX
- Build a purple Odoo-inspired dashboard and stock management screens.
- Add product, warehouse, move, and dashboard pages.
- Expose the inventory workflow through the browser.

## Sprint 4 — Hardening and release readiness
- Run end-to-end validation and smoke tests.
- Verify PostgreSQL setup and app startup behavior.
- Document usage and expected environment variables.
