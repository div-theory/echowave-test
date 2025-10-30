
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { EchoWavePage } from './pages/EchoWavePage';
import { CreateRoomRedirector } from './pages/CreateRoomRedirector';

const App: React.FC = () => {
  const [avgVolume, setAvgVolume] = useState(0);

  const hue = 220 + avgVolume * 1.5; // Start from blue and shift towards purple/pink
  const backgroundStyle = {
    background: `radial-gradient(circle at top, hsl(${hue}, 80%, 15%), #020617 70%)`,
  };

  return (
    <div
      style={backgroundStyle}
      className="w-screen h-screen text-white overflow-hidden transition-all duration-500 ease-in-out"
    >
      <HashRouter>
        <Routes>
          <Route path="/" element={<EchoWavePage setAvgVolume={setAvgVolume} />} />
          <Route path="/join/:roomCode" element={<EchoWavePage setAvgVolume={setAvgVolume} />} />
          <Route path="/new" element={<CreateRoomRedirector />} />
        </Routes>
      </HashRouter>
    </div>
  );
};

export default App;
