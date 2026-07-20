"""Google Sheets data layer.

The ESolution website (Next.js) and this MCP server are co-tenants of the
same spreadsheet: one tab of invoices (30+ columns) and one KarmaDB tab of
client reputation rows. This package mirrors the read/write/enrich logic of
`src/lib/sheets.js` so both sides always agree on derived fields.
"""
