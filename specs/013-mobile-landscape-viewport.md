# Mobile landscape viewport corrections

## Requirement
Camera centering, scroll bounds, selection logic, and positional audio that rely on the gameplay viewport must exclude regions obscured by mobile landscape UI overlays (e.g., sidebar controls on the left and build menu on the right). The playable viewport width should subtract:

- Safe-area insets on both sides.
- The visible mobile action bar/control stack on the left when in mobile landscape mode.
- The mobile build menu panel width on the right when visible in mobile landscape mode.

## Acceptance criteria
- Centering shortcuts (H/E keys, control group double-tap) position the target in the actual visible center of the playfield when mobile landscape UI overlays are open.
- Camera panning reaches map edges correctly without stopping early due to overestimated viewport width.
- Spatial audio panning/attenuation uses the unobstructed viewport center so sounds align with on-screen positions in mobile landscape mode.
