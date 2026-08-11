import { describe, expect, it } from "vitest";

import { shouldDismissPhotoSheet } from "./photo-sheet-motion";

describe("photo sheet dismissal", () => {
  it("returns a short, slow drag to its resting position", () => {
    expect(
      shouldDismissPhotoSheet({
        offset: 110,
        sheetHeight: 776,
        velocity: 440,
      }),
    ).toBe(false);
  });

  it("dismisses after a sufficiently long downward drag", () => {
    expect(
      shouldDismissPhotoSheet({
        offset: 220,
        sheetHeight: 776,
        velocity: 0,
      }),
    ).toBe(true);
  });

  it("dismisses a short drag when its downward velocity is high", () => {
    expect(
      shouldDismissPhotoSheet({
        offset: 90,
        sheetHeight: 776,
        velocity: 900,
      }),
    ).toBe(true);
  });
});
