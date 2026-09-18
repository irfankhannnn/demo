# @realtyflow/contracts

The one package every unit may depend on. It holds no runtime code, only the
shapes units agree on:

- `events/` — one JSON Schema per EventBridge event, named
  `<source>/<detail-type>.v<n>.json`. See `events/README.md` for the envelope
  rules.
- `openapi/` — OpenAPI specs per gateway prefix (`public`, `agency`, `auth`).
  Empty until the gateway is regrouped; see `platform/gateway/README.md`.

`npm test` checks every schema parses and carries the required metadata. It
has no dependencies, so it runs anywhere Node 20 does.

Changing a contract: additive fields go into the existing `v<n>` file; a
breaking change is a new `v<n+1>` file, and the old one stays until no
consumer reads it.
