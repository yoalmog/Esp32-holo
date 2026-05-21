import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RefreshCw, Upload, Eye, EyeOff, Gauge } from 'lucide-react';
import { SimulationConfig } from '../types';

interface PovSimulatorProps {
  config: SimulationConfig;
  onChangeConfig: (newConfig: Partial<SimulationConfig>) => void;
  onSampleDataGenerated?: (pixelArray: number[][][]) => void; // Send polar data back to generate firmware header
}

export default function PovSimulator({ config, onChangeConfig, onSampleDataGenerated }: PovSimulatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [fps, setFps] = useState(60);
  const lastTimeRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Image element for uploaded files
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Read uploaded image pixels
  useEffect(() => {
    if (uploadedImage) {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 120, 120);
        
        // Draw image keeping ratio
        const scale = Math.min(120 / uploadedImage.width, 120 / uploadedImage.height);
        const w = uploadedImage.width * scale;
        const h = uploadedImage.height * scale;
        const x = (120 - w) / 2;
        const y = (120 - h) / 2;
        ctx.drawImage(uploadedImage, x, y, w, h);
        offscreenCanvasRef.current = canvas;
        
        // Generate pre-sampled polar data for C++ array header
        generatePolarPreset(canvas);
      }
    } else {
      offscreenCanvasRef.current = null;
      // Trigger preset code refresh
      generatePolarPreset(null);
    }
  }, [uploadedImage, config.currentPattern]);

  // Helper: Generates polar data that firmware code generator can display
  const generatePolarPreset = (sourceCanvas: HTMLCanvasElement | null) => {
    if (!onSampleDataGenerated) return;
    
    // We want 60 angular slices, 45 radial LEDs
    // Arm 1 handles indices 0..44, Arm 2 handles another 180 deg.
    // For simplicity, we sample a 3D matrix: [arm][slice_index][led_index] -> RGB (3 bytes)
    const slices = 60;
    const leds = 45;
    const res: number[][][] = []; // [slice][led][r,g,b]
    
    let ctx: CanvasRenderingContext2D | null = null;
    if (sourceCanvas) {
      ctx = sourceCanvas.getContext('2d');
    }
    
    for (let s = 0; s < slices; s++) {
      const angle = (s / slices) * Math.PI * 2;
      const sliceLeds: number[][] = [];
      
      for (let l = 0; l < leds; l++) {
        const radiusFraction = l / leds; // 0.0 to 1.0
        // Find corresponding coordinate in 120x120 canvas
        const posX = Math.cos(angle) * radiusFraction * 58 + 60;
        const posY = Math.sin(angle) * radiusFraction * 58 + 60;
        
        let r = 0, g = 0, b = 0;
        
        if (ctx) {
          try {
            const data = ctx.getImageData(Math.floor(posX), Math.floor(posY), 1, 1).data;
            r = data[0];
            g = data[1];
            b = data[2];
          } catch (e) {
            // Out of bounds
          }
        } else {
          // Generate procedural pattern for header code
          const pattern = config.currentPattern;
          if (pattern === 'spiral') {
            const spiralVal = (angle * 3 + radiusFraction * 12) % (Math.PI * 2);
            if (spiralVal < 1.5) {
              r = Math.floor(255 * radiusFraction);
              g = 0;
              b = 255;
            }
          } else if (pattern === 'test-card') {
            const ring = Math.floor(radiusFraction * 6);
            if (ring % 2 === 0) {
              r = s % 3 === 0 ? 255 : 0;
              g = s % 3 === 1 ? 255 : 0;
              b = s % 3 === 2 ? 255 : 0;
            } else {
              r = 100; g = 100; b = 100;
            }
          } else if (pattern === 'nuclear') {
            const normalizedAngle = angle % (Math.PI * 2);
            const isInBlade = (normalizedAngle % (Math.PI * 2 / 3)) < (Math.PI / 3);
            if (isInBlade && radiusFraction > 0.25 && radiusFraction < 0.85) {
              r = 255; g = 190; b = 0; // Hazard Yellow
            } else if (radiusFraction < 0.15) {
              r = 255; g = 190; b = 0;
            }
          } else {
            // Default concentric rings
            if (Math.abs(radiusFraction - 0.5) < 0.05 || Math.abs(radiusFraction - 0.8) < 0.04) {
              r = 0; g = 255; b = 255;
            }
          }
        }
        
        sliceLeds.push([r, g, b]);
      }
      res.push(sliceLeds);
    }
    
    onSampleDataGenerated(res);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const img = new Image();
        img.onload = () => {
          setUploadedImage(img);
          onChangeConfig({ currentPattern: 'uploaded' });
        };
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let animationId: number;
    let localAngle = rotationAngle;

    const render = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      // FPS tracking
      if (dt > 0) {
        setFps(Math.round(1 / dt));
      }

      // 1. Exponential retinal persistence decay (Physics-accurate & Frame-rate independent)
      // Standard overlays flicker or fade too fast if frame times (dt) fluctuate.
      // We calculate continuous exponential decay based on LED persistence in milliseconds.
      const persistenceMs = config.ledPersistenceMs || 80;
      const decayFraction = Math.max(0.01, Math.min(0.99, Math.exp(-dt * (1000 / persistenceMs))));
      const decayOpacity = 1 - decayFraction;

      ctx.fillStyle = `rgba(8, 8, 12, ${isPlaying && config.rpm > 100 ? decayOpacity : 1})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY) - 20;

      // Helper to sample coordinates (normalized x/y: -1.0 to 1.0)
      const samplePattern = (nx: number, ny: number, angleRad: number, radiusFract: number) => {
        // Procedural samplers
        const pattern = config.currentPattern;

        // Custom image uploader
        if (pattern === 'uploaded' && offscreenCanvasRef.current) {
          const offscreen = offscreenCanvasRef.current;
          const oCtx = offscreen.getContext('2d');
          if (oCtx) {
            // Find coordinate on 120x120 canvas
            const sX = Math.floor(nx * 58 + 60);
            const sY = Math.floor(ny * 58 + 60);
            if (sX >= 0 && sX < 120 && sY >= 0 && sY < 120) {
              const p = oCtx.getImageData(sX, sY, 1, 1).data;
              return { r: p[0], g: p[1], b: p[2] };
            }
          }
          return { r: 50, g: 50, b: 60 };
        }

        // Animated Spiral
        if (pattern === 'spiral') {
          const t = timestamp / 400;
          const dist = Math.sqrt(nx * nx + ny * ny);
          const angle = Math.atan2(ny, nx) - t;
          const wave = Math.sin(6 * Math.log(dist + 0.05) - angle * 2);
          if (wave > 0.4) {
            return {
              r: Math.floor(100 + 155 * Math.sin(t)),
              g: Math.floor(50 + 80 * Math.cos(dist * 6)),
              b: 255
            };
          }
          return { r: 0, g: 0, b: 0 };
        }

        // Diagnostic Grid Test Card
        if (pattern === 'test-card') {
          const rFract = radiusFract;
          const a = Math.atan2(ny, nx);
          
          // Concentric circles
          if (Math.abs(rFract - 0.25) < 0.015 || Math.abs(rFract - 0.5) < 0.015 || Math.abs(rFract - 0.75) < 0.015 || Math.abs(rFract - 0.95) < 0.015) {
            return { r: 0, g: 255, b: 255 }; // Cyan gridlines
          }
          // Crosshairs
          if (Math.abs(nx) < 0.015 || Math.abs(ny) < 0.015) {
            return { r: 255, g: 0, b: 128 }; // Magenta lines
          }

          // Pie slices color wheel
          const slice = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8);
          if (rFract < 0.8) {
            switch (slice) {
              case 0: return { r: 255, g: 0, b: 0 };
              case 1: return { r: 255, g: 128, b: 0 };
              case 2: return { r: 255, g: 255, b: 0 };
              case 3: return { r: 0, g: 255, b: 0 };
              case 4: return { r: 0, g: 255, b: 255 };
              case 5: return { r: 0, g: 0, b: 255 };
              case 6: return { r: 128, g: 0, b: 255 };
              case 7: return { r: 255, g: 0, b: 255 };
            }
          }
          return { r: 20, g: 20, b: 25 };
        }

        // Real-Time Tech Clock Face
        if (pattern === 'clock') {
          const rFract = radiusFract;
          const a = Math.atan2(ny, nx);
          const positiveAngle = a < 0 ? a + Math.PI * 2 : a;
          const d = new Date();
          const ms = d.getMilliseconds() / 1000;
          const sec = d.getSeconds() + ms;
          const min = d.getMinutes() + sec / 60;
          const hour = (d.getHours() % 12) + min / 60;

          // Outermost gear ticker
          if (rFract > 0.88 && rFract < 0.94) {
            const ticks = 60;
            const tAngle = Math.floor((positiveAngle / (Math.PI * 2)) * ticks);
            const isTick = (tAngle % 5 === 0) ? (positiveAngle % (Math.PI * 2 / ticks) < 0.04) : (positiveAngle % (Math.PI * 2 / ticks) < 0.012);
            if (isTick) return { r: 0, g: 200, b: 255 };
          }

          // Second Hand (Neon Pulsing Dot + Line)
          const secAngle = (sec / 60) * Math.PI * 2 - Math.PI / 2;
          const secDiff = Math.abs(positiveAngle - (secAngle < 0 ? secAngle + Math.PI * 2 : secAngle));
          if (secDiff < 0.04 && rFract < 0.85 && rFract > 0.15) {
            return { r: 255, g: 80, b: 0 }; // Vivid orange sweep
          }

          // Minute Hand (Cyan)
          const minAngle = (min / 60) * Math.PI * 2 - Math.PI / 2;
          const minDiff = Math.abs(positiveAngle - (minAngle < 0 ? minAngle + Math.PI * 2 : minAngle));
          if (minDiff < 0.06 && rFract < 0.72 && rFract > 0.15) {
            return { r: 0, g: 255, b: 200 };
          }

          // Hour Hand (Cyan-Blue thick)
          const hourAngle = (hour / 12) * Math.PI * 2 - Math.PI / 2;
          const hourDiff = Math.abs(positiveAngle - (hourAngle < 0 ? hourAngle + Math.PI * 2 : hourAngle));
          if (hourDiff < 0.09 && rFract < 0.5 && rFract > 0.15) {
            return { r: 0, g: 150, b: 255 };
          }

          // Concentric neon rings
          if (Math.abs(rFract - 0.85) < 0.01 || Math.abs(rFract - 0.15) < 0.015) {
            return { r: 0, g: 100, b: 255 };
          }

          // Hologram Text Indicator "UTC ONLINE" / "SYS OK"
          if (rFract > 0.18 && rFract < 0.45) {
            // Render text procedural ring
            // Let's draw horizontal indicator directly over the center disk
            if (Math.abs(ny) < 0.08 && Math.abs(nx) < 0.4) {
              return { r: 0, g: 255, b: 150 }; // Green HUD bar
            }
          }

          return { r: 5, g: 10, b: 15 };
        }

        // Rotating Nuclear warning circle
        if (pattern === 'nuclear') {
          const rFract = radiusFract;
          const a = Math.atan2(ny, nx);
          const positiveAngle = (a < 0 ? a + Math.PI * 2 : a) + timestamp / 500;
          const modAngle = positiveAngle % (Math.PI * 2);

          // Standard tri-foil hazard shape
          const inTriLeif = (modAngle % (Math.PI * 2 / 3)) < (Math.PI / 3);
          if (rFract < 0.15) {
            return { r: 255, g: 180, b: 0 }; // Yellow center cap
          }
          if (rFract > 0.28 && rFract < 0.82 && inTriLeif) {
            return { r: 255, g: 180, b: 0 }; // Yellow blades
          }
          if (Math.abs(rFract - 0.88) < 0.015) {
            return { r: 255, g: 180, b: 0 }; // Yellow outer ring
          }
          return { r: 5, g: 5, b: 5 };
        }

        // Earth Globe Globe spinning
        if (pattern === 'globe') {
          const rFract = radiusFract;
          const a = Math.atan2(ny, nx);
          const posAngle = a < 0 ? a + Math.PI * 2 : a;
          const rotationOffset = timestamp / 1400; // Continents drift
          const mapX = (posAngle + rotationOffset) % (Math.PI * 2);
          
          // Generate procedural continents
          const longitudeVal = Math.sin(mapX * 3.5) * Math.cos(rFract * Math.PI) * 1.5;
          const noiseGrid = Math.cos(mapX * 1.5 + rFract * 4) + Math.sin(mapX * 5 - rFract * 8);
          
          if (rFract < 0.85) {
            if (longitudeVal + noiseGrid > 0.2) {
              return { r: 34, g: 197, b: 94 }; // Green landmass
            } else {
              return { r: 29, g: 78, b: 216 }; // Blue ocean
            }
          }
          if (Math.abs(rFract - 0.87) < 0.01) {
            return { r: 255, g: 255, b: 255 }; // Atmosphere glow
          }
          return { r: 0, g: 0, b: 0 };
        }

        // Circular Text Ring
        if (pattern === 'custom-text' && config.customText) {
          const rFract = radiusFract;
          const a = Math.atan2(ny, nx);
          const positiveAngle = a < 0 ? a + Math.PI * 2 : a;
          
          // Render character outline around the outer band (0.65 to 0.85 radius)
          if (rFract > 0.65 && rFract < 0.85) {
            const txt = config.customText.toUpperCase();
            const charSpacing = (Math.PI * 2) / Math.max(txt.length, 12);
            const index = Math.floor(positiveAngle / charSpacing);
            const offsetInChar = (positiveAngle % charSpacing) / charSpacing; // 0..1
            
            // Simple modular segment font emulation
            const char = txt[index % txt.length] || ' ';
            if (char !== ' ' && offsetInChar > 0.2 && offsetInChar < 0.8) {
              // Standard pixelated visual dots
              const rowIdx = Math.floor((rFract - 0.65) / 0.04); // 0..5 rows
              // Dummy display matrices for characters to make it look hyper realistic
              const alphabet: Record<string, number[]> = {
                'A': [0x1F, 0x0A, 0x0A, 0x0A, 0x1F],
                'B': [0x1F, 0x15, 0x15, 0x15, 0x0A],
                'C': [0x0E, 0x11, 0x11, 0x11, 0x11],
                'D': [0x1F, 0x11, 0x11, 0x11, 0x0E],
                'E': [0x1F, 0x15, 0x15, 0x11, 0x11],
                'H': [0x1F, 0x04, 0x04, 0x04, 0x1F],
                'I': [0x11, 0x11, 0x1F, 0x11, 0x11],
                'L': [0x1F, 0x10, 0x10, 0x10, 0x10],
                'O': [0x0E, 0x11, 0x11, 0x11, 0x0E],
                'P': [0x1F, 0x09, 0x09, 0x09, 0x06],
                'S': [0x12, 0x15, 0x15, 0x15, 0x09],
                'T': [0x01, 0x01, 0x1F, 0x01, 0x01],
                'U': [0x1F, 0x10, 0x10, 0x10, 0x1F],
                'X': [0x1B, 0x04, 0x04, 0x04, 0x1B],
                'Y': [0x03, 0x04, 0x18, 0x04, 0x03],
                'Z': [0x11, 0x19, 0x15, 0x13, 0x11]
              };
              const colIdx = Math.floor(offsetInChar * 5); // 5 cols
              const code = alphabet[char] ? alphabet[char][colIdx] : 0x15;
              if ((code & (1 << rowIdx)) !== 0) {
                return { r: 255, g: 0, b: 128 }; // Magenta text glow
              }
            }
          }
          if (Math.abs(rFract - 0.6) < 0.015 || Math.abs(rFract - 0.9) < 0.015) {
            return { r: 0, g: 180, b: 255 }; // Light blue borders
          }
          return { r: 0, g: 0, b: 0 };
        }

        // Default: Concentric procedural energy core
        if (Math.sin(radiusFract * 15 - timestamp / 150) > 0.75) {
          return { r: 0, g: 255, b: 180 };
        }
        return { r: 5, g: 5, b: 8 };
      };

      // 2. Physics-Based Rotational Mechanics & Sub-Stepping Frame Interpolation
      // At 60FPS in browser, if the simulated RPM is 1200, the arm rotates 120 deg per update frame.
      // To prevent showing a static 2-blade propeller and instead show a connected physical POV image,
      // we must compute and draw the states in "sub-steps" integrated over that 120-degree sweep!
      const rpm = config.rpm;
      const anglePerSec = (rpm / 60) * Math.PI * 2; // Rad per sec
      const angleThisFrame = isPlaying ? anglePerSec * dt : 0;
      
      // Calculate how many sub-steps are needed based on speed to ensure complete spatial fill
      // Max 60 sub-steps per render cycle to avoid locking the UI thread
      let numSubsteps = 1;
      if (isPlaying && rpm > 50) {
        numSubsteps = Math.min(32, Math.ceil(Math.abs(angleThisFrame) * 200)); // Dynamic sub-stepping!
      }

      const pulseFreq = timestamp / 300;
      const baseJitterRad = ((Math.random() - 0.5) * config.sensorJitterUs / 1000000) * anglePerSec; // Real sensor microsecond jitter

      const numArms = 2;
      const stripsPerArm = 3;
      const ledsPerStrip = 45;

      // Step through all angular subdivisions of this frame slice
      for (let step = 0; step < numSubsteps; step++) {
        const stepFactor = numSubsteps > 1 ? step / (numSubsteps - 1) : 1;
        const currentSweptAngle = localAngle + angleThisFrame * stepFactor + baseJitterRad;

        // Draw 2 Arms (Arm A: currentSweptAngle, Arm B: currentSweptAngle + PI)
        for (let arm = 0; arm < numArms; arm++) {
          const armAngle = currentSweptAngle + (arm * Math.PI * 2 / numArms);

          // Draw 3 Parallel LED Strips per arm: Left, Center, Right
          // Placed adjacent to simulate commercial dense rendering and antialiasing
          for (let strip = 0; strip < stripsPerArm; strip++) {
            // High-end stagger: Center strip is straight, Left/Right are offset by a tiny radial stagger (1.8 degrees)
            const stripStaggerRad = (strip - (stripsPerArm - 1) / 2) * 0.024;
            const absoluteStripAngle = armAngle + stripStaggerRad;

            // Draw 45 LEDs per strip (Outwards from central axis of spin)
            // Starts at radius 8px buffer, extends to maxRadius
            for (let i = 0; i < ledsPerStrip; i++) {
              const ledRadiusFract = (i + 1) / ledsPerStrip; // 0.02 to 1.0
              const ledRadius = 8 + ledRadiusFract * maxRadius;

              // Calculate (x,y) coordinates in Cartesian space
              const ledX = centerX + Math.cos(absoluteStripAngle) * ledRadius;
              const ledY = centerY + Math.sin(absoluteStripAngle) * ledRadius;

              // Normalized Cartesian coordinate for pattern sampling (-1 to +1 relative to radius)
              const normX = Math.cos(absoluteStripAngle) * ledRadiusFract;
              const normY = Math.sin(absoluteStripAngle) * ledRadiusFract;

              // Sample the pattern at this space
              const rgb = samplePattern(normX, normY, absoluteStripAngle, ledRadiusFract);

              // Apply device brightness multiplier
              const brightnessMul = config.brightness / 255;
              const r = Math.floor(rgb.r * brightnessMul);
              const g = Math.floor(rgb.g * brightnessMul);
              const b = Math.floor(rgb.b * brightnessMul);

              // Skip rendering black LEDs entirely to optimize drawing performance
              if (r < 5 && g < 5 && b < 5) continue;

              // Compute glow properties for physical visual rendering
              // In rotating systems, outer LEDs travel significantly faster and appear slightly blurred
              const physicalVelocityFactor = ledRadiusFract * (rpm / 1200);
              const size = isPlaying && rpm > 100 
                ? 1.2 + physicalVelocityFactor * 1.5 // Outer LEDs draw wider radial arcs (smears slightly)
                : 2.5; // Large crisp dots when stopped

              const pulseCoeff = Math.abs(Math.sin(pulseFreq + i * 0.1));
              const intensityGlow = config.showLeds ? 1.0 : (0.55 + pulseCoeff * 0.15);

              if (isPlaying && rpm > 100) {
                // Highly realistic continuous arc sweep
                ctx.beginPath();
                const subStepAngleSize = angleThisFrame / numSubsteps;
                // Add a tiny overlap of 0.005 radians to ensure smooth rendering boundaries without micro-gaps
                const startA = absoluteStripAngle - subStepAngleSize - 0.005;
                const endA = absoluteStripAngle + 0.005;
                ctx.arc(centerX, centerY, ledRadius, startA, endA, false);
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${intensityGlow})`;
                ctx.lineWidth = size;
                ctx.lineCap = 'round';
                ctx.stroke();
              } else {
                // Draw physical LED pixel dot when stopped or at standby
                ctx.beginPath();
                ctx.arc(ledX, ledY, size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${intensityGlow})`;
                ctx.fill();
              }

              // Add subtle specular highlights on top of LEDs for highly realistic high-density feel
              if (config.showLeds && (!isPlaying || rpm < 400)) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fillRect(ledX - 0.5, ledY - 0.5, 1, 1);
              }
            }
          }
        }
      }

      // 3. Optional Overlay: Draw physical PCB lines (Arms) when stopped or running slow
      if (config.showLeds && (rpm < 300 || !isPlaying)) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(localAngle);
        
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)'; // Ghost green outline of physical PCB substrate
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(-maxRadius - 5, 0);
        ctx.lineTo(maxRadius + 5, 0);
        ctx.stroke();

        // Draw central spindle mount / bearing hub
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw physical Hall sensor package
        ctx.fillStyle = '#dc2626'; // Red hall element on stator
        ctx.fillRect(centerX - 10, -5, 6, 10);
        
        ctx.restore();
      }

      // Step rotation angle forward
      if (isPlaying) {
        localAngle = (localAngle + angleThisFrame) % (Math.PI * 2);
        setRotationAngle(localAngle);
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [config, isPlaying]);

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  const handleRpmSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRpm = parseInt(e.target.value);
    onChangeConfig({ rpm: newRpm });
  };

  const handleBlurSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBlur = parseFloat(e.target.value);
    // Bi-directionally sync physical ledPersistenceMs (20ms to 400ms range)
    const pms = Math.round(20 + (newBlur * 380));
    onChangeConfig({ motionBlur: newBlur, ledPersistenceMs: pms });
  };

  const handlePersistenceSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pms = parseInt(e.target.value);
    // Sync motionBlur (0.05 to 0.99 range)
    const newBlur = Math.min(0.99, Math.max(0.05, (pms - 20) / 380));
    onChangeConfig({ ledPersistenceMs: pms, motionBlur: newBlur });
  };

  return (
    <div className="bg-[#0E1012] border border-[#2A2D33] rounded-sm p-6 flex flex-col h-full justify-between" id="pov-simulator-panel">
      {/* Title Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#2A2D33]">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#00F0FF] rounded-none"></div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-[#E0E2E5] font-semibold">01 // ROTATIONAL POV PHYSICS</h3>
            <p className="font-mono text-[#8E9299] text-[10px] uppercase">Retinal Photon Integration & Slew Speed</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#15171A] px-3 py-1.5 border border-[#2A2D33]">
          <span className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] animate-pulse"></span>
          <span className="font-mono text-[11px] text-[#00F0FF] font-bold">{fps} FPS</span>
        </div>
      </div>

      {/* Main Simulator Canvas Surface */}
      <div className="relative flex-1 flex items-center justify-center p-4 min-h-[300px] h-[360px] bg-[#000] overflow-hidden border border-[#2A2D33]">
        
        {/* Hologram Grid HUD background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `radial-gradient(#00F0FF 1.5px, transparent 1.5px)`, backgroundSize: '16px 16px' }}></div>
        
        {/* Rotation alignment concentric HUD tracks */}
        <div className="absolute inset-4 border border-dashed border-[#2A2D33]/15 rounded-full pointer-events-none" />
        <div className="absolute inset-14 border border-dashed border-[#2A2D33]/10 rounded-full pointer-events-none" />
        <div className="absolute inset-28 border border-dashed border-[#2A2D33]/5 rounded-full pointer-events-none" />

        <canvas
          id="pov-canvas-viewport"
          ref={canvasRef}
          width={400}
          height={400}
          className="w-[330px] h-[330px] md:w-[350px] md:h-[350px] rounded-full relative z-10 select-none bg-[#000]/40"
        />

        {/* Dynamic Telemetry HUD */}
        <div className="absolute bottom-3 left-4 right-4 z-20 flex justify-between pointer-events-none select-none">
          <div className="font-mono text-[9px] text-[#8E9299] flex flex-col bg-[#0E1012]/90 p-1.5 border border-[#2A2D33] uppercase">
            <span>R-COORDINATE: 0..44</span>
            <span>THETA-DIV: 60 SLICES</span>
            <span>DMA CORE: AR1+AR2</span>
          </div>
          <div className="font-mono text-[9px] text-[#8E9299] flex flex-col bg-[#0E1012]/90 p-1.5 border border-[#2A2D33] items-end uppercase">
            <span className="text-[#00F0FF] font-bold">MODE: {config.rpm > 100 ? 'ROTATING_DMA' : 'STALLED_LOCK'}</span>
            <span>OMEGA: {config.rpm > 0 ? ((config.rpm * 2 * Math.PI) / 60).toFixed(1) : '0.0'} RAD/S</span>
            <span>STRIPS: 3X STAGGER</span>
          </div>
        </div>
      </div>

      {/* Control Panel Area */}
      <div className="mt-5 space-y-4">
        {/* Speed Adjustment Slider */}
        <div>
          <div className="flex justify-between items-center mb-1 font-mono text-xs">
            <span className="text-[#8E9299] uppercase tracking-wider">Target Rotor Velocity</span>
            <span className="text-[#00F0FF] bg-[#15171A] border border-[#2A2D33] px-2 py-0.5 rounded-none font-bold">
              {config.rpm} RPM {config.rpm === 0 ? '(STALL)' : `(${(config.rpm / 60).toFixed(1)} HZ)`}
            </span>
          </div>
          <input
            id="rpm-range-slider"
            type="range"
            min={0}
            max={1800}
            step={50}
            value={config.rpm}
            onChange={handleRpmSliderChange}
            className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#00F0FF] outline-none"
          />
          <div className="grid grid-cols-4 font-mono text-[9px] text-[#8E9299] mt-1 uppercase text-center">
            <span className="text-left">0 RPM</span>
            <span>600 (FLICKER)</span>
            <span>1200 (STABLE)</span>
            <span className="text-right">1800 (POV HD)</span>
          </div>
        </div>

        {/* Retinal Fade / Motion Blur Retention */}
        <div>
          <div className="flex justify-between items-center mb-1 font-mono text-xs">
            <span className="text-[#8E9299] uppercase tracking-wider">Retinal Integration (Persistence)</span>
            <span className="text-[#00F0FF] bg-[#15171A] border border-[#2A2D33] px-2 py-0.5 rounded-none font-bold">
              {(config.motionBlur * 100).toFixed(0)}%
            </span>
          </div>
          <input
            id="blur-range-slider"
            type="range"
            min={0.05}
            max={0.99}
            step={0.02}
            value={config.motionBlur}
            onChange={handleBlurSliderChange}
            className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#00F0FF] outline-none"
          />
          <div className="grid grid-cols-3 font-mono text-[9px] text-[#8E9299] mt-1 uppercase text-center">
            <span className="text-left">INSTANT FLASH</span>
            <span>BALANCED DECAY</span>
            <span className="text-right">MAX PERSISTENCE</span>
          </div>
        </div>

        {/* Finer Retinal Constant Controller */}
        <div>
          <div className="flex justify-between items-center mb-1 font-mono text-xs">
            <span className="text-[#8E9299] uppercase tracking-wider">Decay Time Constant (Physical)</span>
            <span className="text-[#FFB800] bg-[#15171A] border border-[#2A2D33] px-2 py-0.5 rounded-none font-bold">
              {config.ledPersistenceMs || 80} ms
            </span>
          </div>
          <input
            id="persistence-range-slider"
            type="range"
            min={20}
            max={400}
            step={5}
            value={config.ledPersistenceMs || 80}
            onChange={handlePersistenceSliderChange}
            className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#FFB800] outline-none"
          />
          <div className="grid grid-cols-3 font-mono text-[9px] text-[#8E9299] mt-1 uppercase text-center">
            <span className="text-left">20 ms (rapid discharge)</span>
            <span>120 ms (average human)</span>
            <span className="text-right">400 ms (slow embers)</span>
          </div>
        </div>

        {/* Playback controls & File dropper */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex gap-2">
            <button
              id="playback-toggle-btn"
              onClick={togglePlayback}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-none font-mono text-[11px] uppercase tracking-wider font-bold transition border cursor-pointer select-none ${
                isPlaying
                  ? 'bg-[#15171A] text-[#FF4E00] border-[#FF4E00] hover:bg-[#FF4E00]/10 shadow-[0_0_8px_rgba(255,78,0,0.1)]'
                  : 'bg-[#00F0FF] text-[#000] border-[#00F0FF] hover:brightness-110 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'PAUSE ROTOR' : 'SPIN ROTOR'}
            </button>
            <button
              id="show-pcb-toggle-btn"
              onClick={() => onChangeConfig({ showLeds: !config.showLeds })}
              className={`p-2.5 rounded-none border transition cursor-pointer ${
                config.showLeds 
                  ? 'bg-[#15171A] text-[#00F0FF] border-[#00F0FF]' 
                  : 'bg-[#1A1D21] text-[#8E9299] border-[#2A2D33] hover:bg-[#2A2D33]'
              }`}
              title="Show Arm Physical Overlays"
            >
              {config.showLeds ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-none flex items-center justify-center gap-2 py-2 px-3 transition text-center select-none ${
              isDragging
                ? 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]'
                : 'bg-[#15171A] text-[#8E9299] border-[#2A2D33] hover:bg-[#2A2D33] hover:border-[#8E9299]'
            }`}
          >
            <Upload className="w-4 h-4 text-[#00F0FF] shrink-0" />
            <div className="text-left leading-none">
              <span className="font-mono text-[10px] text-[#E0E2E5] block font-bold uppercase">UPLOAD MEDIA</span>
              <span className="font-mono text-[9px] text-[#8E9299] block mt-0.5">DRAG & DROP BIN/PNG</span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
