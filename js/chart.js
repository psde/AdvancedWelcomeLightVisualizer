// ============================================================================
// Chart: p5.js brightness diagrams
// ============================================================================
let chartSketches = [];

/**
 * parseForChart(seq): Sum up Duration => Time, Brightness => {maxT, points[]}
 */
function parseForChart(seq) {
  if (!seq || seq.identifier === "RAW") {
    return { maxT: 0, points: [] };
  }
  let sumT = 0;
  let pts = [];

  // Start with 0ms and 0%
  pts.push({ t: 0, b: 0 });

  // Process the data pairs: First Byte pair creates the first datapoint
  for (let i = 0; i < seq.data.length; i += 2) {
    let durHex = parseInt(seq.data[i], 16) || 0;
    let briHex = parseInt(seq.data[i + 1], 16) || 0;
    sumT += durHex * 10; // Duration in ms (Byte-Value * 10)
    let bri = Math.min(briHex, 100); // Brigthness (0-100%)
    pts.push({ t: sumT, b: bri });
  }

  return { maxT: sumT, points: pts };
}

/**
 * Compare two arrays of {t, b} chart points for equality
 */
function arePointsIdentical(leftPoints, rightPoints) {
  if (leftPoints.length !== rightPoints.length) return false;
  for (let i = 0; i < leftPoints.length; i++) {
    if (leftPoints[i].t !== rightPoints[i].t || leftPoints[i].b !== rightPoints[i].b) return false;
  }
  return true;
}

/**
 * create ONE p5 instance for every Diagram #i
 */
function createSingleChart(seqIndex, containerDiv) {
  return new p5((sketch) => {
    let maxTime = 0;
    let margin = 40;
    let w = 0;
    let h = 0;

    sketch.setup = () => {
      // Use clientWidth to get full width
      let cw = containerDiv.clientWidth;
      let ch = containerDiv.clientHeight || 250;
      let canvas = sketch.createCanvas(cw, ch);
      canvas.parent(containerDiv);

      w = sketch.width - 2 * margin;
      h = sketch.height - 2 * margin;

      // Only start interaction if clicking directly on the canvas
      canvas.mousePressed(() => {
        isDragging = true;
        handleInteraction();
      });
    };

    sketch.windowResized = () => {
      let cw = containerDiv.clientWidth;
      sketch.resizeCanvas(cw, sketch.height);
      w = sketch.width - 2 * margin;
    };

    sketch.draw = () => {
      sketch.background(255);
      let leftSeq = sideData.left.sequences[seqIndex];
      let rightSeq = sideData.right.sequences[seqIndex];
      let leftData = parseForChart(leftSeq);
      let rightData = parseForChart(rightSeq);

      // Re-calc maxTime every frame just in case seq changed
      maxTime = Math.max(leftData.maxT, rightData.maxT);
      if (maxTime === 0) maxTime = 1000; // default view

      // Border
      sketch.stroke(0);
      sketch.strokeWeight(1);
      sketch.noFill();
      sketch.rect(margin, margin, w, h);

      // Axis
      sketch.textSize(11);
      sketch.fill(0);
      sketch.noStroke();
      sketch.textAlign(sketch.CENTER);
      sketch.text("Time (ms)", margin + w / 2, margin + h + 30);
      sketch.push();
      sketch.translate(margin - 30, margin + h / 2);
      sketch.rotate(-sketch.HALF_PI);
      sketch.text("Brightness (%)", 0, 0);
      sketch.pop();

      // Define the steps for the X-axis grid
      let gridStep = (maxTime <= 2500) ? 50 : 200;
      let labelStep = maxTime > 2500 ? 1000 : 500;

      // X-axis grid
      sketch.stroke(220);
      sketch.textAlign(sketch.CENTER, sketch.TOP);
      for (let t = 0; t <= maxTime; t += gridStep) {
        let x = sketch.map(t, 0, maxTime, margin, margin + w);
        if (t % labelStep === 0) {
          sketch.noStroke();
          sketch.fill(0);
          sketch.text(`${t}`, x, margin + h + 5);
          sketch.stroke(220);
          sketch.fill(255);
        }
        if (x <= margin + w) {
          sketch.line(x, margin, x, margin + h);
        }
      }
      // Y-axis grid
      sketch.textAlign(sketch.RIGHT, sketch.CENTER);
      for (let bright = 0; bright <= 100; bright += 10) {
        let y = sketch.map(bright, 0, 100, margin + h, margin);
        sketch.noStroke();
        sketch.fill(0);
        sketch.text(`${bright}`, margin - 5, y);
        sketch.stroke(220);
        sketch.fill(255);
        sketch.line(margin, y, margin + w, y);
      }

      // Helper to draw a polyline
      const drawLine = (pts, color) => {
        if (!pts || pts.length === 0) return;
        sketch.stroke(color);
        sketch.strokeWeight(2);
        sketch.noFill();
        sketch.beginShape();
        for (let p of pts) {
          let x = sketch.map(p.t, 0, maxTime, margin, margin + w);
          let y = sketch.map(p.b, 0, 100, margin + h, margin);
          sketch.vertex(x, y);
        }
        sketch.endShape();
      };

      // Helper to draw a single segment between two points
      const drawSegment = (p1, p2, color) => {
        sketch.stroke(color);
        sketch.strokeWeight(2);
        sketch.noFill();
        let x1 = sketch.map(p1.t, 0, maxTime, margin, margin + w);
        let y1 = sketch.map(p1.b, 0, 100, margin + h, margin);
        let x2 = sketch.map(p2.t, 0, maxTime, margin, margin + w);
        let y2 = sketch.map(p2.b, 0, 100, margin + h, margin);
        sketch.line(x1, y1, x2, y2);
      };

      if (arePointsIdentical(leftData.points, rightData.points)) {
        drawLine(leftData.points, sketch.color(0, 180, 0)); // Green = identical
      } else {
        const lp = leftData.points;
        const rp = rightData.points;
        const maxPts = Math.max(lp.length, rp.length);

        // Draw segment-by-segment: green where both endpoints match, blue/red where they differ
        for (let s = 0; s < maxPts - 1; s++) {
          const lHas = s + 1 < lp.length;
          const rHas = s + 1 < rp.length;
          const bothMatch = lHas && rHas &&
            lp[s].t === rp[s].t && lp[s].b === rp[s].b &&
            lp[s + 1].t === rp[s + 1].t && lp[s + 1].b === rp[s + 1].b;

          if (bothMatch) {
            drawSegment(lp[s], lp[s + 1], sketch.color(0, 180, 0)); // Green
          } else {
            if (lHas) drawSegment(lp[s], lp[s + 1], sketch.color(0, 0, 255)); // Blue
            if (rHas) drawSegment(rp[s], rp[s + 1], sketch.color(255, 0, 0)); // Red
          }
        }
      }

      // Current Position Indicator
      if (typeof currentAnimTime !== 'undefined') {
        let xPos = sketch.map(currentAnimTime, 0, maxTime, margin, margin + w);

        if (xPos >= margin && xPos <= margin + w) {
          sketch.stroke(50);
          sketch.strokeWeight(2);
          sketch.line(xPos, margin, xPos, margin + h);

          sketch.fill(50);
          sketch.noStroke();
          sketch.triangle(xPos, margin + h, xPos - 5, margin + h + 10, xPos + 5, margin + h + 10);
        }
      }
    };

    let isDragging = false;

    // Helper to handle both click and drag
    const handleInteraction = () => {
      // Check if mouse is inside canvas bounds
      if (sketch.mouseX >= 0 && sketch.mouseX <= sketch.width &&
        sketch.mouseY >= 0 && sketch.mouseY <= sketch.height) {

        // Check if within the graph area (with a little tolerance)
        if (sketch.mouseX >= margin && sketch.mouseX <= margin + w) {
          let clickedTime = sketch.map(sketch.mouseX, margin, margin + w, 0, maxTime);
          // Clamp
          if (clickedTime < 0) clickedTime = 0;
          if (clickedTime > maxTime) clickedTime = maxTime;

          // Seek
          seekAnimation(clickedTime);

          // Highlight Lights
          const leftLight = document.getElementById(`left_light_${seqIndex}`);
          const rightLight = document.getElementById(`right_light_${seqIndex}`);
          if (leftLight) leftLight.classList.add('focused');
          if (rightLight) rightLight.classList.add('focused');

          return false;
        }
      }
    };

    const clearInteraction = () => {
      const leftLight = document.getElementById(`left_light_${seqIndex}`);
      const rightLight = document.getElementById(`right_light_${seqIndex}`);
      if (leftLight) leftLight.classList.remove('focused');
      if (rightLight) rightLight.classList.remove('focused');
    };

    // DRAG INTERACTION - Only continue if we started on this canvas
    sketch.mouseDragged = () => {
      if (isDragging) {
        handleInteraction();
      }
    };

    // RELEASE INTERACTION
    sketch.mouseReleased = () => {
      if (isDragging) {
        isDragging = false;
        clearInteraction();
      }
    };

  });
}

// ============================================================================
// Update diagram for a given sequence index
// ============================================================================
function updateSingleDiagram(seqIndex) {
  let s = chartSketches[seqIndex];
  if (s) s.remove();

  // Create new
  let chartDiv = document.getElementById(`chartCanvas_${seqIndex}`);
  chartSketches[seqIndex] = createSingleChart(seqIndex, chartDiv);
}
