
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ConversationState, Summary } from '../types';
import { SoundWave } from '../components/SoundWave';
import { SummaryCard } from '../components/SummaryCard';
import { RoomCodeDisplay } from '../components/RoomCodeDisplay';
import { UsersIcon } from '../components/icons/UsersIcon';

interface EchoWavePageProps {
  setAvgVolume: (volume: number) => void;
}

const fakeSummary: Summary = {
    title: "A Spirited Conversation",
    keyPoints: [
      "Explored creative ideas and future possibilities.",
      "Shared personal stories and found common ground.",
      "Laughter was a key component of the chat.",
    ],
    actionItems: [],
};


export const EchoWavePage: React.FC<EchoWavePageProps> = ({ setAvgVolume }) => {
  const { roomCode } = useParams<{ roomCode?: string }>();
  const navigate = useNavigate();

  const [convState, setConvState] = useState<ConversationState>(ConversationState.Idle);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(32));

  // Audio refs
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameId = useRef<number>(0);

  const isFriendsMode = !!roomCode;

  const cleanupAudio = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    setAvgVolume(0);
  }, [setAvgVolume]);


  const startTalking = async () => {
    if (convState !== ConversationState.Idle) return;
    setConvState(ConversationState.Connecting);
    setSummary(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = context;
      
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      source.connect(analyser); // We don't connect to destination to avoid feedback

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const renderFrame = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        setFrequencyData(new Uint8Array(dataArray));
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        setAvgVolume(avg);
        animationFrameId.current = requestAnimationFrame(renderFrame);
      };
      renderFrame();
      
      setConvState(ConversationState.Talking);

    } catch (err) {
      console.error('Failed to get mic or connect:', err);
      alert('Could not access microphone. Please check permissions.');
      setConvState(ConversationState.Idle);
      cleanupAudio();
    }
  };

  const stopTalking = useCallback(() => {
    if (convState !== ConversationState.Talking) return;
    setConvState(ConversationState.Summarizing);
    
    cleanupAudio();
    
    // Use a timeout to simulate summary generation for a better UX
    setTimeout(() => {
        setSummary(fakeSummary);
        setConvState(ConversationState.Finished);
    }, 1500);

  }, [convState, cleanupAudio]);

  const restart = () => {
    setConvState(ConversationState.Idle);
    setSummary(null);
  };

  useEffect(() => {
    return () => {
        cleanupAudio();
    };
  }, [cleanupAudio]);
  
  const renderContent = () => {
    switch (convState) {
      case ConversationState.Idle:
      case ConversationState.Connecting:
        return (
          <button
            onClick={startTalking}
            disabled={convState === ConversationState.Connecting}
            className="bg-white text-slate-900 rounded-full px-10 py-5 text-xl font-bold shadow-lg hover:shadow-2xl hover:scale-105 transform-gpu transition-all duration-300 disabled:opacity-50 disabled:scale-100"
          >
            {convState === ConversationState.Connecting ? 'Connecting...' : 'Start Talking'}
          </button>
        );
      case ConversationState.Talking:
        return (
          <div className="flex flex-col items-center gap-6 w-full px-4">
            <SoundWave frequencyData={frequencyData} />
            <div className="h-6 min-h-[24px]" />
            <button
              onClick={stopTalking}
              className="bg-red-500 text-white rounded-full px-8 py-4 font-bold shadow-lg hover:shadow-red-500/50 hover:scale-105 transform-gpu transition-all duration-300"
            >
              End Call
            </button>
          </div>
        );
      case ConversationState.Summarizing:
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto"></div>
            <p className="mt-4 text-lg">Generating Summary...</p>
          </div>
        );
      case ConversationState.Finished:
        return summary && <SummaryCard summary={summary} onRestart={restart} />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 relative">
        <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center">
            <Link to="/" className="text-2xl font-black tracking-tighter" style={{ textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>
                EchoWave
            </Link>
            {!isFriendsMode ? (
                <button onClick={() => navigate('/new')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors p-2 px-4 rounded-full text-sm font-bold">
                    <UsersIcon className="w-5 h-5" />
                    Invite Friends
                </button>
            ) : (
                <span className="text-sm text-gray-400">Friend Mode</span>
            )}
        </header>

        <main className="flex flex-col items-center justify-center text-center gap-8 flex-grow">
            {isFriendsMode && convState === ConversationState.Idle && roomCode && <RoomCodeDisplay roomCode={roomCode} />}
            {renderContent()}
        </main>
        
        <footer className="absolute bottom-6 text-center text-sm text-gray-500">
            <p>Voice chats that turn sound into art.</p>
        </footer>
    </div>
  );
};
