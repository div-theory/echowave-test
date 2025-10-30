
import React from 'react';

interface SoundWaveProps {
  frequencyData: Uint8Array;
}

const NUM_BARS = 30;

export const SoundWave: React.FC<SoundWaveProps> = ({ frequencyData }) => {
  const bars = [...Array(NUM_BARS)].map((_, i) => {
    // Map frequency data across the bars for a fuller look
    const index = Math.floor((i / NUM_BARS) * (frequencyData.length * 0.7));
    const value = frequencyData[index] || 0;
    const height = Math.max(2, (value / 255) * 100);
    const hue = Math.floor((value / 255) * 120 + 200); // Shift from blue to green/yellow

    return (
      <div
        key={i}
        className="w-full rounded-full transition-all duration-75 ease-in-out"
        style={{
          height: `${height}%`,
          backgroundColor: `hsla(${hue}, 100%, 60%, 0.8)`,
        }}
      />
    );
  });

  return (
    <div className="w-full max-w-lg h-48 flex items-end justify-center gap-1.5 p-6 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
      {bars}
    </div>
  );
};
