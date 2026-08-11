// Business: exploratory movement returns to rest; a deliberate pull or quick downward flick dismisses.
const DISMISS_DISTANCE_RATIO = 0.28;
const DISMISS_VELOCITY = 850;

interface PhotoSheetRelease {
  offset: number;
  sheetHeight: number;
  velocity: number;
}

export function shouldDismissPhotoSheet({
  offset,
  sheetHeight,
  velocity,
}: PhotoSheetRelease) {
  return (
    offset > sheetHeight * DISMISS_DISTANCE_RATIO ||
    velocity > DISMISS_VELOCITY
  );
}
