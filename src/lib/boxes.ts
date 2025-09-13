import { Detection } from "./types";

export function clampBox(box: Detection["box"], w: number, h: number) {
  const xmin = Math.max(0, Math.min(box.xmin, w));
  const ymin = Math.max(0, Math.min(box.ymin, h));
  const xmax = Math.max(0, Math.min(box.xmax, w));
  const ymax = Math.max(0, Math.min(box.ymax, h));
  return {
    xmin: Math.min(xmin, xmax),
    ymin: Math.min(ymin, ymax),
    xmax: Math.max(xmin, xmax),
    ymax: Math.max(ymin, ymax),
  };
}

export function scaleDetections(
  dets: Detection[],
  naturalW: number,
  naturalH: number,
  displayW: number,
  displayH: number
) {
  const sx = displayW / naturalW;
  const sy = displayH / naturalH;
  return dets.map((d) => {
    const b = clampBox(d.box, naturalW, naturalH);
    return {
      ...d,
      box: {
        xmin: b.xmin * sx,
        ymin: b.ymin * sy,
        xmax: b.xmax * sx,
        ymax: b.ymax * sy,
      },
    };
  });
}
