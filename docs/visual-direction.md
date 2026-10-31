# Stadium visual direction

## Concept

The replay remains the subject. A compact, contemporary stadium surrounds it as a
quiet spatial instrument: stepped seating establishes scale, the pitch stays the
brightest surface, and the yellow shooter remains the single visual accent.

The stadium is static so the live body-pose replay owns the motion budget. Repeated
parts are instanced to keep draw calls low.

## Hero parts inventory

The initial build targets 151 authored structural parts, plus instanced seats and lamps:

- Ground and pitch threshold (5): outer ground plane, four apron thresholds.
- Lower bowl (36): nine stepped rows on each of four sides.
- Concourse (8): four circulation decks and four fascia bands.
- Upper bowl (24): six stepped rows on each side.
- Roofs (12): two canopies, ten supporting columns.
- Corners (16): four corner decks, eight retaining blocks, four access landings.
- Field edge (24): sixteen advertising boards, four corner barriers, four gates.
- Stadium equipment (6): two tunnel shells and four technical boxes.
- Lighting (20): four truss towers, four yokes and twelve open frame rails; each frame carries 32 instanced lamps.

Seats are deliberately abstracted into repeated, muted blocks. They add human scale
without becoming a noisy crowd texture or distracting from the pose skeletons.

## Material hierarchy

- Pitch and replay actors: highest contrast.
- Concrete bowl: warm, low-contrast grey.
- Seating: each complete grandstand belongs to one team; negative stadium sides are blue and positive sides are red, with no mixed blocks.
- Roof and towers: dark graphite structure.
- Advertising: matte near-black to frame the pitch.

## Performance guardrails

- Reuse geometries and materials.
- Use instancing for seating and repeated light panels.
- Keep stadium objects static and outside the actor group cleared each frame.
- Do not enable shadows on hundreds of seats.
- Preserve reduced-motion behavior and the existing render-on-intersection policy.
