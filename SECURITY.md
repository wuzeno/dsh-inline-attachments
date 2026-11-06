# Security and privacy notes

This is an experimental client-side DSH plugin. Installed plugins execute within the host's trust boundary; a UI feature is not a sandbox or a security guarantee.

The plugin reuses DSH's attachment transport and authorized image loader. It does not introduce a separate upload endpoint. Model requests and attachment handling still follow the host's configured providers and policies.

Versioned text markers can contain filenames, attachment order, kind and durable document IDs. They do not contain upload receipt IDs, but they are not anonymous or metadata-free. Copying a message or viewing it without the plugin may expose these markers.

Please do not post credentials, authentication links, private files or unsanitized logs in public issues. Use GitHub's private vulnerability-reporting channel if available; otherwise open an issue with only a non-sensitive description requesting a private reporting route.

Missing post-send document preview, unsent File refresh recovery and chip Undo support are documented limitations, not claims of protected behavior.
