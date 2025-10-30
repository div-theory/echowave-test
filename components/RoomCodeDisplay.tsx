
import React, { useState } from 'react';
import { CopyIcon } from './icons/CopyIcon';
import { ShareIcon } from './icons/ShareIcon';

interface RoomCodeDisplayProps {
  roomCode: string;
}

export const RoomCodeDisplay: React.FC<RoomCodeDisplayProps> = ({ roomCode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#/join/${roomCode}`;
    if (navigator.share) {
      navigator.share({
        title: 'Join my EchoWave Room',
        text: `Let's talk! Join my room on EchoWave with code: ${roomCode}`,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm border border-white/10 rounded-full py-2 px-4">
        <span className="text-sm text-gray-300">Room:</span>
        <span className="font-mono tracking-widest text-lg text-white">{roomCode}</span>
        <button onClick={handleCopy} className="p-2 rounded-full hover:bg-white/20 transition-colors">
          <CopyIcon className="w-4 h-4" />
        </button>
        <button onClick={handleShare} className="p-2 rounded-full hover:bg-white/20 transition-colors">
          <ShareIcon className="w-4 h-4" />
        </button>
      </div>
       {copied && <div className="text-xs text-green-400">Copied!</div>}
      <div className="text-sm bg-green-500/80 text-white font-bold rounded-full px-3 py-1">
        1 friend connected
      </div>
    </div>
  );
};
