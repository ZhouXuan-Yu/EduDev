// Adapted from ZCode (Apache-2.0). Provenance in source.json and ZCODE-LICENSE.
const WINDOWS_TITLE_BAR_HEIGHT_PX = 36;
const resolveDesktopZoomFactorForLevel = (level: number) => 1.2 ** level;

function resolveWindowsTitleBarOverlayHeightForZoomLevel(zoomLevel: number) {
  return Math.round(WINDOWS_TITLE_BAR_HEIGHT_PX * resolveDesktopZoomFactorForLevel(zoomLevel));
}

export function buildWindowsTitleBarOverlayForZoomLevel(
  zoomLevel: number,
  theme: "light" | "dark",
) {
  return {
    color: "#00000000",
    symbolColor: theme === "dark" ? "#f5f5f5" : "#1f1f1f",
    height: resolveWindowsTitleBarOverlayHeightForZoomLevel(zoomLevel),
  };
}
