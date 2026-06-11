/**
 * Built-in loop closures for the Hand robot (Hand_description package).
 *
 * Each finger is a four-bar: the joint holder is the ground link, the
 * servo-driven BACK_PUSHER is the input crank, the FINGERTIP is the coupler
 * and the passive LINKAGE is the rocker. The pusher-to-fingertip pin closes
 * the loop, which URDF cannot represent, so the Fusion exporter dropped it
 * and recorded it in robot_data.yaml under `closing_joints`.
 *
 * Anchors below are that pin: anchorA is the closing joint's origin straight
 * from robot_data.yaml (expressed in the parent link's frame), anchorB is the
 * same physical point expressed in the other link's frame, computed by
 * forward kinematics at the export (all-zero) pose where the assembly is
 * consistent.
 */
export const HAND_CLOSURES = [
  {
    name: 'finger_second_loop',
    linkA: 'Hand_BACK_PUSHER',
    anchorA: [-0.005, -0.0302, 0.045],
    linkB: 'Hand_FINGERTIP_1',
    anchorB: [0.014999, 0.00505, -0.000154],
    passiveJoints: ['Revolute_19', 'revolute_1'],
    enabled: true,
  },
  {
    name: 'finger_first_loop',
    linkA: 'FINGERTIP_2',
    anchorA: [0.014999, 0.01915, 0.000154],
    linkB: 'Hand_BACK_PUSHER_3',
    anchorB: [-0.005, 0.03005, 0.045],
    passiveJoints: ['Revolute_27', 'Revolute'],
    enabled: true,
  },
  {
    name: 'thumb_loop',
    linkA: 'Hand_BACK_PUSHER_2',
    anchorA: [-0.005, -0.0302, 0.045],
    linkB: 'Hand_FINGERTIP_1_2',
    anchorB: [0.014999, 0.00505, -0.000154],
    passiveJoints: ['Revolute_23', 'revolute'],
    enabled: true,
  },
];

/** True when a loaded robot is (a re-export of) this hand. */
export function isHandRobot(robot) {
  return HAND_CLOSURES.every(
    (c) =>
      robot.links?.[c.linkA] &&
      robot.links?.[c.linkB] &&
      c.passiveJoints.every((j) => robot.joints?.[j]),
  );
}
