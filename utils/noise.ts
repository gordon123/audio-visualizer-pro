// Adapted from a public domain implementation of Perlin noise.
export class PerlinNoise {
  private p: number[];

  constructor(seed: number = Math.random()) {
    // This is a seeded pseudo-random number generator.
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    const p_temp: number[] = [];
    for (let i = 0; i < 256; i++) {
      p_temp[i] = i;
    }
    
    // Shuffle the array
    for (let i = p_temp.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p_temp[i], p_temp[j]] = [p_temp[j], p_temp[i]];
    }
    
    // Duplicate the permutation array to avoid buffer-overflow issues
    this.p = [...p_temp, ...p_temp];
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }
  
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  public noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = this.fade(x);
    const v = this.fade(y);
    
    const p = this.p;
    const A = p[X] + Y;
    const B = p[X + 1] + Y;

    const val = this.lerp(v,
      this.lerp(u, this.grad(p[A], x, y), this.grad(p[B], x - 1, y)),
      this.lerp(u, this.grad(p[A + 1], x, y - 1), this.grad(p[B + 1], x - 1, y - 1))
    );
    // Return value in range [-1, 1]
    return val;
  }
}
