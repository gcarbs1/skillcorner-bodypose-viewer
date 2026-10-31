# Arena visual direction

## Concept

The replay remains the subject. A large, contemporary arena surrounds it as a quiet
spatial instrument: a continuous bowl establishes scale, the pitch stays the
brightest surface, and the yellow shooter remains the single visual accent.

The stadium is static so the live body-pose replay owns the motion budget. Repeated
parts are instanced to keep draw calls low.

## Arena architecture

Every architectural layer derives from the same rounded-rectangle contour. This avoids
the overlaps and visible seams created by joining four independent grandstands.

- Footprint: approximately 228 × 190 m on a 260 × 220 m ground plane.
- Lower bowl: 14 continuous rows around a 132 × 94 m opening.
- Concourse: a five-metre circulation ring with twelve framed portals.
- Upper bowl: 10 continuous rows on all four sides.
- Roof: one continuous, gently sloped canopy with an open centre and exterior columns.
- Lighting: eight open 3 × 6 lamp banks fixed below the inner roof edge; there are no freestanding towers.
- Field edge: instanced matte-black advertising boards, with clear goal openings.

Seats are deliberately abstracted into instanced low-poly parts. They add human scale
without becoming a noisy crowd texture or distracting from the pose skeletons. The
blue and red sections only change at a wide corner aisle, so no seating block mixes teams.

## Material hierarchy

- Pitch and replay actors: highest contrast.
- Concrete bowl: warm, low-contrast grey.
- Seating: complete cardinal sections are blue or red, separated by neutral aisles.
- Roof and columns: medium graphite above a lighter concrete shell.
- Advertising: matte near-black to frame the pitch.
- Lighting: warm emissive lenses inside an open graphite frame.

## Performance guardrails

- Reuse geometries and materials.
- Use instancing for seating, columns, roof ribs, advertising and lamp modules.
- Keep stadium objects static and outside the actor group cleared each frame.
- Do not enable shadows on hundreds of seats.
- Keep the POV renderer below the main renderer's pixel ratio.
- Preserve reduced-motion behavior and the existing render-on-intersection policy.
