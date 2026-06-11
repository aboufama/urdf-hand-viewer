# URDF Hand Viewer

Web-based URDF visualizer with a **closed-kinematic-loop solver**, built for
robot hands whose fingers use linkage assemblies (four-bars, couplers) for
their last degree of freedom.

URDF can only describe kinematic *trees*, so a finger linkage forces you to
export with the loop cut — e.g. the coupler rod's back joint is in the URDF,
but its connection to the fingertip link is dropped. This viewer reconnects
that joint in software: you declare a **closure** (two anchor points that must
coincide, plus the passive joints in the loop), and a numeric solver drives
the passive joints so the loop stays closed while you move the actuated
joints. The fingertip then follows its real, linkage-driven trajectory.

## Run it

```sh
npm install
npm run dev        # open the printed localhost URL
```

`npm run build` produces a static site in `dist/` you can host anywhere.

## Usage

1. **Load your robot** — drag & drop the folder containing your `.urdf` and
   meshes anywhere in the window (or use *Load URDF folder*). Meshes
   referenced via `package://` or relative paths are matched against the
   dropped files by path suffix; STL, DAE, OBJ and GLB/GLTF are supported.
   *Load demo hand* loads a built-in 3-finger linkage hand to play with.
2. **Add a closure** for each cut loop (*+ Add closure*):
   - **Anchor A**: the link on one side of the disconnected joint (e.g. the
     coupler rod) and the joint's position in that link's local frame, in mm.
     Use **pick** to click the spot on the mesh instead of typing numbers —
     click where the disconnected pivot sits on each part.
   - **Anchor B**: same for the other side (e.g. the tab on the fingertip
     link).
   - **Passive joints**: every non-actuated joint in the loop (typically the
     coupler's back joint and the fingertip joint). These become solver-owned:
     their sliders lock and show the solved values live.
3. **Move the actuated joints** with their sliders (or *Drive all actuated*).
   The solver runs on every change; each closure card shows the live gap
   between its anchors (green = closed).

Closure definitions are saved to `localStorage` per robot name automatically,
and can be exported/imported as JSON to keep them with your robot files:

```json
{
  "robot": "my_hand",
  "closures": [
    {
      "name": "finger0_linkage",
      "linkA": "finger0_coupler",  "anchorA": [0, 0, 0.0388],
      "linkB": "finger0_distal",   "anchorB": [0.012, 0.013, 0],
      "passiveJoints": ["finger0_coupler_joint", "finger0_distal_joint"],
      "enabled": true
    }
  ]
}
```

Anchors in the JSON are in **meters** (link-local frame); the UI displays mm.

## How to export your URDF for this

Keep both halves of each loop in the export, just disconnected:

- the main finger chain: `palm → knuckle (actuated) → proximal → distal joint
  (passive, revolute with real limits) → fingertip`
- the linkage rod as a dangling branch: `palm/base → back joint (passive,
  revolute) → coupler link`

Give the passive joints real axes and limits — the solver respects them. The
anchor points are simply the two halves of the pivot you removed: the rod-end
center on the coupler link, and the matching hole center on the fingertip
link.

## How the solver works

All enabled closures are solved simultaneously as one damped least-squares
(Levenberg–Marquardt) problem: residuals are the 3D gaps `pA − pB` of each
closure, unknowns are the union of passive joint values, with a
finite-difference Jacobian and joint-limit clamping. It warm-starts from the
current pose, so tracking slider motion typically converges in ~3 iterations
at sub-micron error. If a pose is geometrically unreachable (linkage lock-up
or a passive joint limit), the solver leaves the loop at the minimum-gap
configuration and the gap readout turns red.

## Tests

```sh
npm test                       # solver math: closes the demo four-bar over its full range
node test/smoke.browser.mjs    # headless-browser smoke test (needs `npm run dev` running)
```
