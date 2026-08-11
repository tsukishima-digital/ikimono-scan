# AGENTS.md

Ikimono Scan is a nonprofit, open-source web app that classifies species locally from an image. The MVP covers beetles observed in Japan and prioritizes Aromia bungii. Keep the supported scope and uncertainty explicit in the UI.

Never commit datasets, model weights, API keys, or credentials. Before acquiring or redistributing training data or publishing a model, verify the iNaturalist terms and each photo license.

Submit changes with tests through a pull request. Never push directly to `main`.

## Fast feedback workflow

- Treat pre-commit and pre-push as the canonical local automated quality gates. Install both with `task hooks:install` before the first commit.
- Do not manually repeat checks already completed successfully by the applicable hook unless files changed or you are diagnosing a failure. If a hook is unavailable or was bypassed, run that hook stage explicitly before delivery.
- Keep `task dev` running during UI work. Use the model-free `/__dev/result` fixtures for result presentation changes.
- During implementation, run focused checks such as `task ui:test -- src/App.test.tsx` as needed. The pre-push hook owns the full tests, lint, and type-checking checkpoint.
- Run `task release:check` only for releases or changes to dependencies, production builds, runtime configuration, model loading, inference, or preprocessing, unless the user asks for full validation.
- Browser-check affected frontend states. Exercise a real camera, image, and model only when their integration changed; fixture-based verification is sufficient for presentation-only result changes.
- Batch related visual edits and push at a review checkpoint. Do not push and wait for CI after every small UI adjustment unless the user asks.
