export const TABLER_ICON_PATHS = Object.freeze({
  "ruler-measure": Object.freeze([
    "M19.875 12c.621 0 1.125 .512 1.125 1.143v5.714c0 .631 -.504 1.143 -1.125 1.143h-15.875a1 1 0 0 1 -1 -1v-5.857c0 -.631 .504 -1.143 1.125 -1.143h15.75",
    "M9 12v2",
    "M6 12v3",
    "M12 12v3",
    "M18 12v3",
    "M15 12v2",
    "M3 3v4",
    "M3 5h18",
    "M21 3v4"
  ]),
  "terminal-2": Object.freeze([
    "M8 9l3 3l-3 3",
    "M13 15l3 0",
    "M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -12"
  ]),
  school: Object.freeze([
    "M22 9l-10 -4l-10 4l10 4l10 -4v6",
    "M6 10.6v5.4a6 3 0 0 0 12 0v-5.4"
  ]),
  "list-check": Object.freeze([
    "M3.5 5.5l1.5 1.5l2.5 -2.5",
    "M3.5 11.5l1.5 1.5l2.5 -2.5",
    "M3.5 17.5l1.5 1.5l2.5 -2.5",
    "M11 6l9 0",
    "M11 12l9 0",
    "M11 18l9 0"
  ]),
  gavel: Object.freeze([
    "M13 10l7.383 7.418c.823 .82 .823 2.148 0 2.967a2.11 2.11 0 0 1 -2.976 0l-7.407 -7.385",
    "M6 9l4 4",
    "M13 10l-4 -4",
    "M3 21h7",
    "M6.793 15.793l-3.586 -3.586a1 1 0 0 1 0 -1.414l2.293 -2.293l.5 .5l3 -3l-.5 -.5l2.293 -2.293a1 1 0 0 1 1.414 0l3.586 3.586a1 1 0 0 1 0 1.414l-2.293 2.293l-.5 -.5l-3 3l.5 .5l-2.293 2.293a1 1 0 0 1 -1.414 0"
  ]),
  robot: Object.freeze([
    "M6 6a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -4",
    "M12 2v2",
    "M9 12v9",
    "M15 12v9",
    "M5 16l4 -2",
    "M15 14l4 2",
    "M9 18h6",
    "M10 8v.01",
    "M14 8v.01"
  ]),
  "message-exclamation": Object.freeze([
    "M8 9h8",
    "M8 13h6",
    "M15 18h-2l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v5.5",
    "M19 16v3",
    "M19 22v.01"
  ])
});

export function hasTablerIcon(iconName) {
  return typeof iconName === "string" && Object.hasOwn(TABLER_ICON_PATHS, iconName);
}
