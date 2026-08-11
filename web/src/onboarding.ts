export const ONBOARDING_STORAGE_KEY = "ikimono-scan:onboarding:v1";

export function hasCompletedOnboarding(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "complete";
  } catch {
    return false;
  }
}

export function rememberCompletedOnboarding(): void {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "complete");
  } catch {
    // Implementation: Keep the current session usable when storage is unavailable.
  }
}
