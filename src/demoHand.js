/**
 * Demo: 3-finger hand whose distal joints are driven by a four-bar linkage,
 * exported the way URDF forces you to — with the linkage loop cut. Each
 * finger has:
 *
 *   palm -> fingerbase (fixed)
 *        -> knuckle joint (ACTUATED)  -> proximal link
 *        -> distal joint  (passive)   -> distal link (fingertip)
 *   fingerbase -> coupler joint (passive, the "back joint") -> coupler bar
 *
 * The coupler bar's tip should attach to a tab on the distal link, but that
 * closes a loop, so the URDF leaves it dangling. DEMO_CLOSURES tells the
 * solver how to reconnect it.
 */

// Finger-local geometry (meters). The rocker pivot sits behind and above the
// knuckle axis, the tab sticks out in front of the distal axis; that four-bar
// gives ~1:1 distal/knuckle flexion over the whole range without locking up.
// The linkage plane is offset sideways (y) so the rod clears the finger body.
const L1 = 0.04; // proximal length
const L2 = 0.03; // distal length
const COUPLER_PIVOT = [-0.01, 0.013, 0.008]; // rocker pivot on fingerbase
const TAB = [0.012, 0.013, 0]; // attachment tab on distal link
// Coupler rod length so the loop closes exactly at knuckle=0, distal=0
// (y offsets are equal, so the planar distance is the true 3D distance)
const COUPLER_LEN = Math.hypot(
  TAB[0] - COUPLER_PIVOT[0],
  (L1 + TAB[2]) - COUPLER_PIVOT[2],
);

function finger(i) {
  const phi = (i * 2 * Math.PI) / 3;
  const r = 0.035;
  const x = (r * Math.cos(phi)).toFixed(6);
  const y = (r * Math.sin(phi)).toFixed(6);
  // Local +x points at the palm center so positive flexion curls inward
  const yaw = (phi + Math.PI).toFixed(6);
  const n = `finger${i}`;
  return `
  <link name="${n}_base">
    <visual>
      <origin xyz="0 0 -0.004"/>
      <geometry><box size="0.018 0.024 0.018"/></geometry>
      <material name="dark"/>
    </visual>
    <visual>
      <origin xyz="${COUPLER_PIVOT[0]} ${COUPLER_PIVOT[1]} 0"/>
      <geometry><box size="0.008 0.006 0.018"/></geometry>
      <material name="dark"/>
    </visual>
  </link>
  <joint name="${n}_mount" type="fixed">
    <parent link="palm"/>
    <child link="${n}_base"/>
    <origin xyz="${x} ${y} 0.014" rpy="0 0 ${yaw}"/>
  </joint>

  <link name="${n}_proximal">
    <visual>
      <origin xyz="0 0 ${L1 / 2}"/>
      <geometry><box size="0.014 0.018 ${L1}"/></geometry>
      <material name="shell"/>
    </visual>
  </link>
  <joint name="${n}_knuckle" type="revolute">
    <parent link="${n}_base"/>
    <child link="${n}_proximal"/>
    <origin xyz="0 0 0"/>
    <axis xyz="0 1 0"/>
    <limit lower="0" upper="1.45" effort="10" velocity="3"/>
  </joint>

  <link name="${n}_distal">
    <visual>
      <origin xyz="0 0 ${L2 / 2}"/>
      <geometry><box size="0.012 0.016 ${L2}"/></geometry>
      <material name="shell"/>
    </visual>
    <visual>
      <origin xyz="${TAB[0] / 2} ${TAB[1] / 2} ${TAB[2]}"/>
      <geometry><box size="${TAB[0] + 0.005} ${TAB[1] + 0.004} 0.005"/></geometry>
      <material name="accent"/>
    </visual>
  </link>
  <joint name="${n}_distal_joint" type="revolute">
    <parent link="${n}_proximal"/>
    <child link="${n}_distal"/>
    <origin xyz="0 0 ${L1}"/>
    <axis xyz="0 1 0"/>
    <limit lower="-0.3" upper="1.9" effort="10" velocity="3"/>
  </joint>

  <link name="${n}_coupler">
    <visual>
      <origin xyz="0 0 ${COUPLER_LEN / 2}"/>
      <geometry><box size="0.005 0.008 ${COUPLER_LEN.toFixed(6)}"/></geometry>
      <material name="accent"/>
    </visual>
  </link>
  <joint name="${n}_coupler_joint" type="revolute">
    <parent link="${n}_base"/>
    <child link="${n}_coupler"/>
    <origin xyz="${COUPLER_PIVOT.join(' ')}"/>
    <axis xyz="0 1 0"/>
    <limit lower="-0.5" upper="2.2" effort="10" velocity="3"/>
  </joint>
`;
}

export const DEMO_URDF = `<?xml version="1.0"?>
<robot name="demo_three_finger_hand">
  <material name="shell"><color rgba="0.78 0.8 0.84 1"/></material>
  <material name="dark"><color rgba="0.25 0.27 0.3 1"/></material>
  <material name="accent"><color rgba="0.95 0.55 0.15 1"/></material>

  <link name="palm">
    <visual>
      <origin xyz="0 0 0"/>
      <geometry><cylinder radius="0.05" length="0.02"/></geometry>
      <material name="dark"/>
    </visual>
  </link>
${[0, 1, 2].map(finger).join('\n')}
</robot>
`;

export const DEMO_CLOSURES = [0, 1, 2].map((i) => ({
  name: `finger${i}_linkage`,
  linkA: `finger${i}_coupler`,
  anchorA: [0, 0, Number(COUPLER_LEN.toFixed(6))],
  linkB: `finger${i}_distal`,
  anchorB: [...TAB],
  passiveJoints: [`finger${i}_coupler_joint`, `finger${i}_distal_joint`],
  enabled: true,
}));
