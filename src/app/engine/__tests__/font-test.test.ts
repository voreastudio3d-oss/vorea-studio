import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import helvetikerJson from 'three/examples/fonts/helvetiker_regular.typeface.json';
import { ShapeUtils } from 'three';
import { describe, test, expect } from 'vitest';

const font = new Font(helvetikerJson as any);

function signedArea2D(pts: number[][]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return a / 2;
}

describe('Font shape analysis', () => {
  test('VOREA - all shapes winding and holes', () => {
    const chars = ['V', 'O', 'R', 'E', 'A'];
    for (const ch of chars) {
      const shapes = font.generateShapes(ch, 10);
      console.log(`${ch}: ${shapes.length} shape(s)`);
      for (let si = 0; si < shapes.length; si++) {
        const shape = shapes[si];
        const outer = shape.getPoints(4).map(p => [p.x, p.y]);
        const area = signedArea2D(outer);
        console.log(`  Shape ${si}: outer=${outer.length}pts, area=${area.toFixed(2)} (${area>=0?'CCW':'CW'}), holes=${shape.holes.length}`);
        for (let hi = 0; hi < shape.holes.length; hi++) {
          const hole = shape.holes[hi].getPoints(4).map(p => [p.x, p.y]);
          const hArea = signedArea2D(hole);
          console.log(`    Hole ${hi}: ${hole.length}pts, area=${hArea.toFixed(2)} (${hArea>=0?'CCW':'CW'})`);
        }
      }
    }
  });

  test('ShapeUtils.triangulateShape on A - winding check', () => {
    const shapes = font.generateShapes('A', 10);
    const shape = shapes[0];
    const outer = shape.getPoints(4);
    const holes = shape.holes.map(h => h.getPoints(4));
    console.log('A outer pts:', outer.length, 'holes:', holes.length, 'hole[0] pts:', holes[0]?.length);

    const tris = ShapeUtils.triangulateShape(outer, holes);
    console.log('Triangles:', tris.length);

    // Build combined array same way as extrudeWithHoles does
    const combined: number[][] = outer.map(p => [p.x, p.y]);
    for (const h of holes) combined.push(...h.map(p => [p.x, p.y]));
    console.log('Combined vertices:', combined.length);

    // Check winding of ALL triangles
    let ccwCount = 0, cwCount = 0;
    for (const [a, b, c] of tris) {
      expect(a).toBeLessThan(combined.length);
      expect(b).toBeLessThan(combined.length);
      expect(c).toBeLessThan(combined.length);
      const pa = combined[a], pb = combined[b], pc = combined[c];
      const cross = (pb[0]-pa[0])*(pc[1]-pa[1]) - (pb[1]-pa[1])*(pc[0]-pa[0]);
      if (cross > 0) ccwCount++; else cwCount++;
    }
    console.log(`Triangle winding: CCW=${ccwCount}, CW=${cwCount}`);
    // ShapeUtils.triangulateShape returns CCW triangles (positive cross product)
    // This tells us what winding the top cap should use
  });
});
