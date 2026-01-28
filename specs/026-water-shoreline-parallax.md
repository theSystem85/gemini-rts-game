# Water Shoreline Gradient + Sand/Water Parallax

## Summary
Enhance shoreline rendering so water sits atop a sand bed with a translucent surface, and add a subtle parallax effect between sand and water. Provide runtime settings to toggle the shoreline gradient and parallax behaviors.

## Requirements
- Render sand (`public/images/map/sand01.jpg`) beneath every water tile.
- Render the water surface at ~80% opacity on top of the sand bed.
- Add a 6px gradient on edges where land (including street) meets water so land fades into water tiles.
- Apply the gradient to SOT water corners as well (diagonal edges).
- Add a subtle parallax effect between sand and water when the camera scrolls.
- Provide settings checkboxes to toggle:
  - Water edge gradient.
  - Water/sand parallax.

## Implementation Notes
- The sand layer should move slightly slower than the water surface to create the parallax illusion.
- Ensure the gradient size is capped to half the tile size to avoid visual artifacts.
- When GPU base rendering is active, overlay the water/sand rendering in the 2D pass so the effects remain visible.
