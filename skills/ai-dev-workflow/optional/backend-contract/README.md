# Optional: backend schema / contract

**Use only when** the backend does not exist yet (the app is built first and the API must be specified for a backend
team), or the user asks for it. Otherwise skip this module: the core workflow works against whatever backend the
project already has.

## What it adds
1. **An API schema** written before the client code that uses it (e.g. OpenAPI 3.1 in `api/openapi.yaml`, or
   GraphQL SDL, or JSON Schema): shared envelope, paging, error shape and error codes declared once; one path file
   per endpoint group; schemas mirror the data-model spec field by field.
2. **Example responses** per endpoint (happy, empty, page 2, one per error code), named
   `<group>/<operation>.<status>[.<code>].json`, validated against the schema by a fast check
   (Redocly lint + ajv, or the stack's equivalent). Add it to the gate as a conditional step (`?contract`).
3. **Optionally, a local stand-in** that serves those examples and enforces the same server rules and error codes, so
   UI work does not wait for the backend. Switch per data source (`DATA_SOURCE=fake|remote`), never shipped in
   production (startup refuses prod + stand-in). One shared test suite runs against the stand-in now and the real
   backend later.
4. **A backend hand-off doc** per area (`docs/backend/<area>.md`, template `backend-handoff.md` here) + a PDF for the
   team: `node tool/design/md_to_pdf.mjs docs/backend/<area>.md docs/backend/<Area>-API.pdf --brand "<Project>" --footer "For the backend team"`,
   and a bundled schema (`npx @redocly/cli bundle api/openapi.yaml -o dist/api.yaml`).
5. **Versioning**: tag a version per phase; every later change goes through a CHANGELOG labelled
   `additive`/`breaking`, and the hand-off doc + PDF are regenerated in the same PR.

## Rules when it is used
- The schema serves the app: when the app needs something, add it to the schema in the same slice instead of a
  client workaround (still ask the owner for anything touching rules, privacy or who sees what).
- What the server decides (permissions, ranking, visibility) is never computed by the client.
- Read-heavy GETs whose body rarely changes use `ETag` / `If-None-Match` → `304` with `Cache-Control`; not for
  cursor-paged lists.
- New error codes are added to the schema and to the client's error-code list in the same PR (a test checks parity).
- Integration later: run the shared suite against staging, switch one feature at a time to remote.
