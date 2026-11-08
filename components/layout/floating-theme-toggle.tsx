import { ThemeToggle } from "@/components/application/theme/theme-toggle";

/**
 * Phones only: the light/dark switch floats in the bottom corner on every page, since the
 * header has no room for it there. From sm up the header shows its own switch.
 */
export function FloatingThemeToggle() {
  return (
    <div
      // Clears the home indicator on phones with one.
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      className="fixed end-4 z-40 rounded-full border border-border-button-default shadow-lg sm:hidden"
    >
      <ThemeToggle appearance="segmented" />
    </div>
  );
}
