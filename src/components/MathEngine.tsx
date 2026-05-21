import React, { useState } from 'react';
import { HelpCircle, AlertTriangle, Lightbulb, Zap, Info, Binary } from 'lucide-react';

export default function MathEngine() {
  const [rpm, setRpm] = useState(1200);
  const [radiusCm, setRadiusCm] = useState(20); // 20cm arm length
  const [sectors, setSectors] = useState(60); // 60 angular slices
  const [ledMassMg, setLedMassMg] = useState(120); // 120mg per typical SK6812 LED package

  // 1. Calculations
  const periodMs = 60000 / Math.max(1, rpm); // Period for one full rotation in milliseconds
  const periodUs = periodMs * 1000;
  const sectorDurationUs = periodUs / sectors; // Microseconds available to draw each sector

  // Angular speed (radians / second)
  const omega = (2 * Math.PI * rpm) / 60;

  // Tip Linear Speed: v = \omega * r
  const radiusMeters = radiusCm / 100;
  const velocityMps = omega * radiusMeters;
  const velocityKmh = velocityMps * 3.6;
  const velocityMph = velocityKmh * 0.621371;

  // Centrifugal Acceleration: a_c = \omega^2 * r
  const accMps2 = Math.pow(omega, 2) * radiusMeters;
  const gForce = accMps2 / 9.80665; // Divided by standard gravity G

  // Force pulling the critical outermost LED package outward
  const massKg = ledMassMg / 1000000;
  const forceNewtons = massKg * accMps2;
  const forceGramsEquivalent = forceNewtons * 101.97; // 1 Newton ~ 102 grams of pull force

  // FastLED/DMA timing check
  // Standard WS2812B takes exactly 1.25 microseconds per bit, or 30 microseconds per 24-bit pixel.
  // Plus reset duration (typically 280us-300us).
  // Total write duration to update 45 LEDs: (45 * 30us) + 300us = 1650 microseconds!
  // Wait! Under serial routing, 45 LEDs of WS2812B takes 1.65ms to write!
  // If sector duration is less than 1.65ms (at high RPMs or slices), the display will overlap and tear!
  // This is a REAL physical limitation of standard WS2812B serial protocols!
  const singleStripRefreshUs = (45 * 30) + 300; // 1650 microseconds for serial WS2812
  // But wait, our ESP32-S3 uses parallel DMA write!
  // It writes all arms simultaneously, so we divide the total led count by parallel outputs!
  // Since we run Arm 1 and Arm 2 on dedicated parallel lines, write time is governed by max LEDs per single pin: 45 LEDs.
  // Parallel DMA write bypasses serial lag, taking exactly the single strip write time: 1.65ms.
  const isSerialFeasible = sectorDurationUs > singleStripRefreshUs;

  return (
    <div className="bg-[#0E1012] border border-[#2A2D33] rounded-sm p-6 flex flex-col h-full justify-between" id="math-physics-engine">
      {/* Panel header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#2A2D33] mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#00F0FF] rounded-none"></div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-[#E0E2E5] font-semibold">05 // ROTATIONAL MATHEMATICAL ENGINE</h3>
            <p className="font-mono text-[#8E9299] text-[10px] uppercase">Centrifugal vectors // Angular timing parameters // DMA protocol limits</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Input Sliders */}
        <div className="lg:col-span-4 bg-[#15171A] p-5 border border-[#2A2D33] space-y-5">
          <h4 className="font-mono text-[10px] uppercase text-[#00F0FF] tracking-wider border-l-2 border-[#00F0FF] pl-2 font-bold select-none">
            Rotational Input Parameters
          </h4>

          {/* RPM Slider */}
          <div>
            <div className="flex justify-between font-mono text-[9px] uppercase mb-1">
              <span className="text-[#8E9299]">Rotor Target Speed</span>
              <span className="text-[#00F0FF] font-bold">{rpm} RPM</span>
            </div>
            <input
              type="range"
              min={300}
              max={1800}
              step={50}
              value={rpm}
              onChange={(e) => setRpm(parseInt(e.target.value))}
              className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#00F0FF] outline-none"
            />
          </div>

          {/* Rotor Radius Slider */}
          <div>
            <div className="flex justify-between font-mono text-[9px] uppercase mb-1">
              <span className="text-[#8E9299]">Rotor Arm Radius</span>
              <span className="text-[#00F0FF] font-bold">{radiusCm} cm</span>
            </div>
            <input
              type="range"
              min={10}
              max={40}
              step={1}
              value={radiusCm}
              onChange={(e) => setRadiusCm(parseInt(e.target.value))}
              className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#00F0FF] outline-none"
            />
          </div>

          {/* Slices Slider */}
          <div>
            <div className="flex justify-between font-mono text-[9px] uppercase mb-1">
              <span className="text-[#8E9299]">Angular Slices (Sectors)</span>
              <span className="text-[#FFB800] font-bold">{sectors} divisions</span>
            </div>
            <input
              type="range"
              min={30}
              max={120}
              step={10}
              value={sectors}
              onChange={(e) => setSectors(parseInt(e.target.value))}
              className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#FFB800] outline-none"
            />
          </div>

          {/* LED chip weight */}
          <div>
            <div className="flex justify-between font-mono text-[9px] uppercase mb-1">
              <span className="text-[#8E9299]">Outermost LED Mass</span>
              <span className="text-[#FF4E00] font-bold">{ledMassMg} mg</span>
            </div>
            <input
              type="range"
              min={50}
              max={250}
              step={10}
              value={ledMassMg}
              onChange={(e) => setLedMassMg(parseInt(e.target.value))}
              className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#FF4E00] outline-none"
            />
          </div>
        </div>

        {/* Right Mathematical Outputs Grid */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Linear speed block */}
            <div className="bg-[#15171A] p-4 border border-[#2A2D33] rounded-none flex flex-col justify-between">
              <span className="font-mono text-[9px] text-[#8E9299] uppercase tracking-wider">LED Tip Linear Speed</span>
              <div className="my-2.5 text-left">
                <span className="font-mono font-extrabold text-2xl text-[#E0E2E5] tracking-tight">
                  {velocityKmh.toFixed(1)} <span className="text-xs font-normal text-[#8E9299]">KM/H</span>
                </span>
                <span className="block font-mono text-[9px] text-[#8E9299] mt-1 uppercase">
                  &approx; {velocityMph.toFixed(1)} MPH (TIP LINEAR OUT VELOCITY)
                </span>
              </div>
              <div className="font-mono text-[10px] leading-relaxed text-[#8E9299] mt-2 bg-[#000] p-2.5 border border-[#2A2D33]">
                <span className="font-bold block text-[#00F0FF] mb-1">PHYSICS EQUATION:</span>
                {"v_tip = \u03c9 \u00b7 r = (2\u03c0 \u00b7 RPM / 60) \u00b7 r"}
              </div>
            </div>

            {/* Tip Acceleration / G-Force */}
            <div className="bg-[#15171A] p-4 border border-[#2A2D33] rounded-none flex flex-col justify-between">
              <span className="font-mono text-[9px] text-[#8E9299] uppercase tracking-wider">Centrifugal G-Force load</span>
              <div className="my-2.5 text-left">
                <span className="font-mono font-extrabold text-2xl text-[#FF4E00] tracking-tight">
                  {Math.round(gForce).toLocaleString()} <span className="text-xs font-normal text-[#8E9299]">G'S</span>
                </span>
                <span className="block font-mono text-[9px] text-[#FF4E00]/80 mt-1 font-bold uppercase">
                  LED Pull weight: {forceGramsEquivalent.toFixed(0)} grams ({forceNewtons.toFixed(2)} N)
                </span>
              </div>
              <div className="font-mono text-[10px] leading-relaxed text-[#8E9299] mt-2 bg-[#000] p-2.5 border border-[#2A2D33]">
                <span className="font-bold block text-[#FF4E00] mb-1">PHYSICS EQUATION:</span>
                {"F_c = m \u00b7 a_c = m \u00b7 \u03c9\u00b2 \u00b7 r"}
              </div>
            </div>

            {/* Sector Timing constraints */}
            <div className="bg-[#15171A] p-4 border border-[#2A2D33] rounded-none flex flex-col justify-between">
              <span className="font-mono text-[9px] text-[#8E9299] uppercase tracking-wider">Sector Frame Duration</span>
              <div className="my-2.5 text-left">
                <span className="font-mono font-extrabold text-2xl text-[#00F0FF] tracking-tight">
                  {sectorDurationUs.toFixed(1)} <span className="text-xs font-normal text-[#8E9299]">&mu;S</span>
                </span>
                <span className="block font-mono text-[9px] text-[#8E9299] mt-1 uppercase">
                  Period time per rotation: {periodMs.toFixed(1)} ms
                </span>
              </div>
              <div className="font-mono text-[10px] leading-relaxed text-[#8E9299] mt-2 bg-[#000] p-2.5 border border-[#2A2D33]">
                <span className="font-bold block text-[#00F0FF] mb-1">PHYSICS EQUATION:</span>
                {"T_sector = T_rev / N_slices = 60,000,000 / (RPM \u00b7 N_slices)"}
              </div>
            </div>

            {/* DMA / Feasibility review */}
            <div className="bg-[#15171A] p-4 border border-[#2A2D33] rounded-none flex flex-col justify-between">
              <span className="font-mono text-[9px] text-[#8E9299] uppercase tracking-wider">Serial Protocol Bottleneck</span>
              <div className="my-2.5 text-left">
                <span className={`font-mono font-bold text-base ${isSerialFeasible ? 'text-emerald-400' : 'text-[#FF4E00]'}`}>
                  {isSerialFeasible ? 'FEASIBLE FOR SER PIX' : 'DMA OVERLAP WARNING'}
                </span>
                <span className="block font-mono text-[9px] text-[#8E9299] mt-1 uppercase">
                  Serial write delay: 45 leds &approx; {singleStripRefreshUs} &mu;s
                </span>
              </div>
              <div className="font-mono text-[10px] leading-relaxed text-[#8E9299] mt-2 bg-[#000] p-2.5 border border-[#2A2D33] select-none">
                <span className="font-bold block text-[#00F0FF] mb-1">REAL-WORLD CONSEQUENCE:</span>
                {isSerialFeasible ? (
                  "The microcontroller writing serial protocol pixels can finish writing state transitions prior to entering the next angular sector. Frame tearing is avoided."
                ) : (
                  "The rotor is spinning faster than the pixel communication channel can transfer. Black blank blocks, flickering, or severe layout shear will occur. Hardware parallel I2S DMA pins is MANDATORY!"
                )}
              </div>
            </div>

          </div>

          {/* Structural Danger Warnings */}
          {gForce > 1200 && (
            <div className="bg-[#FF4E00]/10 border border-[#FF4E00]/30 rounded-none p-4 flex gap-3 text-xs leading-relaxed text-[#FF4E00]">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#FF4E00] animate-bounce" />
              <div>
                <p className="font-mono font-bold text-[11px] uppercase tracking-wider">High Torque Force Warning (&gt;1200 G-load)</p>
                <p className="mt-1 font-mono uppercase text-[#8E9299] text-[9.5px]">
                  At {rpm} RPM with a {radiusCm}cm arm, the outermost LED experiences a literal centrifugal acceleration of <strong>{Math.round(gForce).toLocaleString()} times earth gravity</strong> (G's). A regular solder pad will buckle and peel right off under shearing forces. Epoxy coat the joints or secure them using structural adhesive sleeves to prevent high-velocity flying components.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
