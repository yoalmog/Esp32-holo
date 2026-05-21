import React from 'react';
import { BookOpen, AlertTriangle, ShieldCheck, HelpCircle, Landmark, Compass, Sliders, Settings } from 'lucide-react';

export default function SetupGuide() {
  return (
    <div className="bg-[#0E1012] border border-[#2A2D33] rounded-sm p-6 text-slate-300 text-left" id="assembly-documentation-manual">
      {/* Panel header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#2A2D33] mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#00F0FF] rounded-none"></div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-[#E0E2E5] font-semibold">06 // ASSEMBLY & OPERATIONAL ENGINEERING MANUAL</h3>
            <p className="font-mono text-[#8E9299] text-[10px] uppercase">Mechanical balancing dynamics // Interrupt sync protocols // Isolation</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 leading-relaxed text-sm">
        
        {/* Step 1: Mechanical Balancing */}
        <div className="space-y-4 bg-[#15171A] p-5 border border-[#2A2D33]">
          <h4 className="font-mono text-[10px] uppercase text-[#00F0FF] tracking-wider border-l-2 border-[#00F0FF] pl-2 font-bold flex items-center gap-1.5 pb-2 border-b border-[#2A2D33]">
            <Compass className="w-4 h-4 text-[#00F0FF]" />
            1. Rotor Mechanical Centroid Balancing
          </h4>
          <p className="text-[11px] text-[#8E9299] leading-relaxed font-mono uppercase">
            A dual-arm rotor spinning at 1200 RPM and 20cm length moves its tip at nearly <strong>90 km/h</strong>. Under <strong>1,610 G's of centrifugal pressure</strong>, any asymmetrical mass distributions creates deep lateral torque stress, leading to high-frequency structural vibration, sound pollution, motor bearing wear, and eventual joint rupture.
          </p>
          <ul className="text-[10px] space-y-2 text-[#8E9299] list-disc list-inside font-mono uppercase leading-relaxed">
            <li>
              <strong className="text-[#E0E2E5]">Asymmetric load balancing:</strong> If you place a heavier component (e.g., the ESP32 chip or buck converter) on Arm 1, secure dummy weights (lead tape or metal rivets) on the opposite arm quadrant.
            </li>
            <li>
              <strong className="text-[#E0E2E5]">Solder structural bond:</strong> Massive G-loading pulls components outward. Apply standard viscous cyanoacrylate adhesive or high-grade conformal coating on LED beads.
            </li>
            <li>
              <strong className="text-[#E0E2E5]">Aero drag shielding:</strong> Enclose the spinning armature inside an acrylic safety dome to prevent high-speed particle collisions and protect hands.
            </li>
          </ul>
        </div>

        {/* Step 2: Electrical Connection Schema */}
        <div className="space-y-4 bg-[#15171A] p-5 border border-[#2A2D33]">
          <h4 className="font-mono text-[10px] uppercase text-[#00F0FF] tracking-wider border-l-2 border-[#00F0FF] pl-2 font-bold flex items-center gap-1.5 pb-2 border-b border-[#2A2D33]">
            <Settings className="w-4 h-4 text-[#00F0FF]" />
            2. System Electrical Schematics
          </h4>
          <p className="text-[10px] text-[#8E9299] leading-relaxed font-mono uppercase">
            Maintain rigorous separation of supply rails. Heavy brushless motor transient loads easily disrupt logic state machines:
          </p>
          <pre className="font-mono text-[9px] bg-[#000] p-3 rounded-none text-[#00F0FF] border border-[#2A2D33] overflow-x-auto leading-normal uppercase">
{`[STATIONARY Hub: Stator Base]
Power Source (12V/3A) ───────────┐
                                │  (Capsule Slip Ring)
[SPINNING Plate: Rotor PCB]       ▼
Core Slip-Ring (V+, GND) ─────► Buck Regulator (5V/5A Out)
                                ├───► LED Power Rail (5V, GND)
                                └───► ESP32-S3 Pin VCC & GND
  
ESP32 Pin 12 (3.3V) ──────► Level Shifter ──► LED Line 1 (5V Data)
ESP32 Pin 13 (3.3V) ──────► Level Shifter ──► LED Line 2 (5V Data)
Hall Sensor Pin 11  ◄─────► Pullup Resistor to 3.3V`}
          </pre>
        </div>

        {/* Calibration section */}
        <div className="space-y-4 bg-[#15171A] p-5 border border-[#2A2D33]">
          <h4 className="font-mono text-[10px] uppercase text-[#FFB800] tracking-wider border-l-2 border-[#FFB800] pl-2 font-bold flex items-center gap-1.5 pb-2 border-b border-[#2A2D33]">
            <Sliders className="w-4 h-4 text-[#FFB800]" />
            3. Angular Synchronization Calibration
          </h4>
          <p className="text-[11px] text-[#8E9299] leading-relaxed font-mono uppercase">
            The unipolar hall sensor provides the physical 0° trigger datum. Any angular misalignment causes projected hologram geometries to appear visually rotated or upside-down.
          </p>
          <ul className="text-[10px] space-y-2 text-[#8E9299] list-disc list-inside font-mono uppercase leading-relaxed">
            <li>
              <strong className="text-[#E0E2E5]">Magnetic Polarity:</strong> Unipolar latches like AH3503 only trigger on a strong <strong>South pole face</strong>. If state triggers fail to interrupt, invert the stator magnet direction.
            </li>
            <li>
              <strong className="text-[#E0E2E5]">Digital Skew Tuning:</strong> Rather than physical adjustments, use the dynamic **Phase Offset Calibration** slider or configure the C++ variable <span className="font-mono bg-[#000] px-1 py-0.5 border border-[#2A2D33] text-[#FFB800]">sensor_phase_offset_rad</span> in software.
            </li>
          </ul>
        </div>

        {/* Technical Troubleshooting */}
        <div className="space-y-4 bg-[#15171A] p-5 border border-[#2A2D33]">
          <h4 className="font-mono text-[10px] uppercase text-[#FF4E00] tracking-wider border-l-2 border-[#FF4E00] pl-2 font-bold flex items-center gap-1.5 pb-2 border-b border-[#2A2D33]">
            <AlertTriangle className="w-4 h-4 text-[#FF4E00]" />
            4. Critical Troubleshooting Matrix
          </h4>
          
          <div className="space-y-4 text-[10px] font-mono uppercase leading-relaxed">
            <div className="border-b border-[#2A2D33]/40 pb-2">
              <strong className="text-[#E0E2E5] block font-mono">Symptom: Display Shear & Angular Tearing</strong>
              <span className="text-[#8E9299] text-[9.5px] block leading-relaxed mt-1">
                Reason: Sector frame updates overlapping. Core pixel communications (WS2812 speed cap 800kHz) is bottlenecking. Reduce target sector subdivisions or split strips across parallel I2S hardware registers.
              </span>
            </div>
            <div>
              <strong className="text-[#E0E2E5] block font-mono">Symptom: High Spatial Jitter</strong>
              <span className="text-[#8E9299] text-[9.5px] block leading-relaxed mt-1">
                Reason: Fluctuations in rotor angular rate. Isolate FastLED updates to Core 1 in firmware, and run Wi-Fi server loops strictly on Core 0. Eliminate block-level delay commands across routines.
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
