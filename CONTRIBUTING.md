# Contributing

Thanks for helping make attachment references clearer in DSH.

Before a change, read the known limits in [README](README.md) and the ownership rules in [Architecture](docs/ARCHITECTURE.md). Prefer public host contracts; do not overwrite native Factory definitions or guess file-preview URLs.

## Local checks

```bash
npm run check
npm pack
npm run verify:package
```

Commit both changed source files and the generated [client.js](client.js). No npm dependency installation is required for these checks. Python + Pillow are optional media-authoring tools.

## A useful bug report

Include the DSH version, OS, reproducible steps, expected versus actual behavior, and a sanitized screenshot. State whether the failure occurred before send, in a submission echo, after admission, or after a refresh. Distinguish a native path chip from an uploaded attachment.

Never post authentication URLs, API keys, local credentials, private attachments, or raw logs that may contain them. The files used in the repository screenshots contain synthetic data.

## Evidence standards

Keep claims proportional to evidence. Unit tests with mocked React or slots do not establish browser E2E correctness; screenshots are not performance benchmarks. New preview formats need a real authorization/loader contract. Changes to chip deletion or Undo must account for actual File lifetime, not only editor nodes.
