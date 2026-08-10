# AGENTS.md

Ikimono Scan is a nonprofit, open-source web app that classifies species locally from an image. The MVP covers beetles observed in Japan and prioritizes Aromia bungii. Keep the supported scope and uncertainty explicit in the UI.

Never commit datasets, model weights, API keys, or credentials. Before acquiring or redistributing training data or publishing a model, verify the iNaturalist terms and each photo license.

Submit changes with tests through a pull request. Never push directly to `main`.

## Fast feedback workflow

- Keep `task dev` running during UI work. Use the model-free `/__dev/result` fixtures for result presentation changes.
- Use `task ui:test -- src/App.test.tsx` for a focused test and `task ui` for the normal UI checkpoint. `task ui` runs tests, lint, and type-checking in parallel; it deliberately skips the production build.
- Run `task check` before committing. It selects Web and Python checks from the current working-tree paths.
- Run `task release:check` only for releases or changes to dependencies, production builds, runtime configuration, model loading, inference, or preprocessing, unless the user asks for full validation.
- Browser-check affected frontend states. Exercise a real camera, image, and model only when their integration changed; fixture-based verification is sufficient for presentation-only result changes.
- Batch related visual edits and push at a review checkpoint. Do not push and wait for CI after every small UI adjustment unless the user asks.
