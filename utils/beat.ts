
const ENERGY_HISTORY_SIZE = 120; // Corresponds to ~2 seconds at 60fps

export class BeatDetector {
  private energyHistory: number[] = new Array(ENERGY_HISTORY_SIZE).fill(0);
  private envelope: number = 0;

  private getMedian(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  
  private getMAD(arr: number[], median: number): number {
    const deviations = arr.map(val => Math.abs(val - median));
    return this.getMedian(deviations);
  }

  public update(
    rms: number,
    deltaTime: number, // in seconds
    settings: { enabled: boolean, attack: number, decay: number, threshold: number }
  ): { isBeat: boolean, envelope: number } {
    if (!settings.enabled) {
      return { isBeat: false, envelope: 0 };
    }

    const median = this.getMedian(this.energyHistory);
    const mad = this.getMAD(this.energyHistory, median);
    const threshold = median + settings.threshold * mad;
    
    let isBeat = false;
    if (rms > threshold && rms > 0.01) {
      isBeat = true;
    }
    
    // Update history
    this.energyHistory.push(rms);
    if (this.energyHistory.length > ENERGY_HISTORY_SIZE) {
      this.energyHistory.shift();
    }
    
    // Update envelope with attack and decay
    if (isBeat) {
      // Attack: Instant jump to 1 for a punchy feel
      this.envelope = 1.0;
    } else {
      // Decay
      if (this.envelope > 0) {
        const decayAmount = (1 / (settings.decay || 0.1)) * deltaTime;
        this.envelope = Math.max(0, this.envelope - decayAmount);
      }
    }
    
    return { isBeat, envelope: this.envelope };
  }
}
