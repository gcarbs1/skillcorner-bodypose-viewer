# Stadium Visual Direction

## Concept

The replay remains the focal point. A large contemporary stadium surrounds it as a restrained spatial instrument: continuous stands establish scale, the pitch is the brightest surface, and the shooter in yellow is the only visual accent.

The stadium is static so the Body Pose replay alone uses the motion budget. Repeated elements are instanced to keep draw calls low.

## Stadium Architecture

Every layer follows the same rounded-rectangle outline. This prevents the overlaps and seams that appear when four independent stands are joined.

- Footprint: approximately 228 × 190 m on a 260 × 220 m plane.
- Lower tier: 14 continuous rows around a 132 × 94 m opening.
- Concourse: a five-meter circulation ring with twelve framed portals.
- Upper tier: 10 continuous rows on all four sides.
- Roof: a continuous, gently sloped canopy with an open center and external columns.
- Lighting: eight open 3 × 6 floodlight modules mounted beneath the inner roof edge, with no isolated towers.
- Pitch perimeter: matte black advertising boards with openings behind the goals.

The seats are simplified as low-polygon instanced pieces. They provide human scale without becoming a noisy crowd texture or distracting from the pose skeletons. All seats are blue and divided into sections by neutral aisles.

## Material Hierarchy

- Pitch and replay actors: highest contrast.
- Concrete stands: low-contrast warm gray.
- Seats: blue throughout, separated by neutral aisles.
- Roof and columns: medium graphite over a lighter concrete shell.
- Advertising: nearly matte black to frame the pitch.
- Lighting: warm emissive lenses inside an open graphite frame.

## Performance Constraints

- Reuse geometries and materials.
- Use instancing for seats, columns, roof ribs, advertising boards, and floodlight modules.
- Keep stadium objects static and outside the actor group cleared on each frame.
- Do not enable shadows on hundreds of seats.
- Keep the first-person renderer at a lower resolution than the main renderer.
- Preserve reduced-motion behavior and render only while the viewer is visible.
