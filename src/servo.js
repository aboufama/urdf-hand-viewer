/**
 * Web Serial driver for Feetech STS-series bus servos (Waveshare ST3215)
 * behind a USB bus adapter (e.g. Waveshare Bus Servo Adapter / Driver Board).
 *
 * Collision safety, by construction:
 * - Bus: every command is one broadcast SYNC WRITE (instruction 0x83 to
 *   ID 0xFE). Servos send no status packets in response, so the half-duplex
 *   bus never has two talkers — no bus collisions, no reads to arbitrate.
 * - Mechanical: callers pass radians; this module clamps to the joint's
 *   software limits before converting to ticks, and every move carries a
 *   bounded speed and acceleration so linkages are never slammed.
 *
 * STS3215 register map (relevant part):
 *   40 TORQUE_ENABLE (1B) | 41 ACC (1B) | 42 GOAL_POSITION (2B LE)
 *   44 GOAL_TIME (2B LE)  | 46 GOAL_SPEED (2B LE)
 * 4096 ticks per revolution, mid-stroke (straight servo horn) = 2048.
 */

export const TICKS_PER_RAD = 4096 / (2 * Math.PI);
export const CENTER_TICKS = 2048;

const SYNC_WRITE = 0x83;
const BROADCAST_ID = 0xfe;
const ADDR_TORQUE = 40;
const ADDR_ACC = 41; // ACC + GOAL_POSITION + GOAL_TIME + GOAL_SPEED in one block

export class ServoBus {
  constructor() {
    this.port = null;
    this.writer = null;
  }

  get supported() {
    return typeof navigator !== 'undefined' && !!navigator.serial;
  }

  get connected() {
    return !!this.writer;
  }

  /** Must be called from a user gesture (browser requirement). */
  async connect(baudRate = 1_000_000) {
    if (!this.supported) {
      throw new Error('Web Serial is not available — use Chrome/Edge over localhost or https');
    }
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate });
    this.writer = this.port.writable.getWriter();
  }

  async disconnect() {
    const { writer, port } = this;
    this.writer = null;
    this.port = null;
    try {
      writer?.releaseLock();
      await port?.close();
    } catch {
      /* port already gone */
    }
  }

  _checksum(bytes) {
    let s = 0;
    for (const b of bytes) s += b;
    return ~s & 0xff;
  }

  /** One broadcast packet writing `perLen` bytes at `addr` on every row's servo. */
  async syncWrite(addr, perLen, rows) {
    if (!this.writer || !rows.length) return;
    const params = [addr, perLen];
    for (const { id, data } of rows) {
      if (data.length !== perLen) throw new Error('syncWrite row length mismatch');
      params.push(id & 0xff, ...data);
    }
    const len = params.length + 2; // instruction + checksum
    const body = [BROADCAST_ID, len, SYNC_WRITE, ...params];
    const packet = new Uint8Array([0xff, 0xff, ...body, this._checksum(body)]);
    await this.writer.write(packet);
  }

  /** @param {{id: number, on: boolean}[]} rows */
  async setTorque(rows) {
    await this.syncWrite(ADDR_TORQUE, 1, rows.map(({ id, on }) => ({ id, data: [on ? 1 : 0] })));
  }

  /**
   * Command positions for several servos in one collision-free packet.
   * @param {{id: number, ticks: number, speed?: number, acc?: number}[]} targets
   *   ticks 0..4095; speed in ticks/s (bounded); acc in 100 ticks/s² units.
   */
  async writePositions(targets) {
    const rows = targets.map(({ id, ticks, speed = 800, acc = 50 }) => {
      const p = Math.round(Math.min(4095, Math.max(0, ticks)));
      const v = Math.round(Math.min(3000, Math.max(50, speed)));
      const a = Math.round(Math.min(150, Math.max(1, acc)));
      return {
        id,
        data: [a, p & 0xff, (p >> 8) & 0xff, 0, 0, v & 0xff, (v >> 8) & 0xff],
      };
    });
    await this.syncWrite(ADDR_ACC, 7, rows);
  }
}

/**
 * Map one joint's angle (radians) to servo ticks: clamps to the software
 * limits first (mechanical-collision guard), then applies the per-servo
 * calibration (sign + center).
 */
export function radToTicks(rad, { lower, upper, sign = 1, center = CENTER_TICKS }) {
  const clamped = Math.min(upper, Math.max(lower, rad));
  return Math.round(center + sign * clamped * TICKS_PER_RAD);
}
