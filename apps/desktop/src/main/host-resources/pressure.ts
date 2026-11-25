export type PressureLevel = 0 | 1 | 2;
export type UnavailablePressureSample = 'cold_start' | 'resume' | 'stale_interval' | 'sensor_failed' | 'invalid_memory' | 'invalid_cpu';

type PressureSample = {
  availableMiB: number | null;
  delayMs: number | null;
  cpuRatio: number | null;
  unavailable?: UnavailablePressureSample;
};

export class HostPressurePolicy {
  private level: PressureLevel = 0;
  private elevated = 0;
  private healthy = 0;

  observe(sample: PressureSample) {
    const {availableMiB, delayMs, cpuRatio, unavailable} = sample;
    const previousLevel = this.level;
    let reason: UnavailablePressureSample | 'critical_memory' | 'low_memory' | 'event_loop_delay' |
      'busy_cpu' | 'stable' | 'recovery_step' = unavailable ?? 'stable';
    if (unavailable || availableMiB === null || delayMs === null || cpuRatio === null || availableMiB < 1024) {
      if (!unavailable) reason = availableMiB === null ? 'invalid_memory' : delayMs === null ? 'stale_interval' :
        cpuRatio === null ? 'invalid_cpu' : 'critical_memory';
      this.level = 2;
      this.elevated = this.healthy = 0;
    } else {
      reason = availableMiB < 2048 ? 'low_memory' : delayMs > 80 ? 'event_loop_delay' : cpuRatio > .92 ? 'busy_cpu' : 'stable';
      const observed = reason === 'stable' ? 0 : 1;
      this.elevated = observed > this.level ? this.elevated + 1 : 0;
      this.healthy = observed < this.level && availableMiB >= 2560 && delayMs < 40 && cpuRatio < .85 ?
        this.healthy + 1 : 0;
      if (this.elevated >= 2) {
        this.level = 1;
        this.elevated = 0;
      } else if (this.healthy >= 5) {
        this.level = this.level === 2 ? 1 : 0;
        this.healthy = 0;
        reason = 'recovery_step';
      }
    }
    return {level:this.level, previousLevel, reason};
  }
}
