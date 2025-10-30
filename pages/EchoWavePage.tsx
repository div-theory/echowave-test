
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ConversationState, Summary } from '../types';
import { SoundWave } from '../components/SoundWave';
import { SummaryCard } from '../components/SummaryCard';
import { RoomCodeDisplay } from '../components/RoomCodeDisplay';
import { UsersIcon } from '../components/icons/UsersIcon';
import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';

interface EchoWavePageProps {
  setAvgVolume: (volume: number) => void;
}

const SIGNALING_SERVER_URL = 'https://webrtc-signal-server.glitch.me/';
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
];

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
  const [peerCount, setPeerCount] = useState(0);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  // Refs
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameId = useRef<number>(0);
  const socketRef = useRef<any | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const isFriendsMode = !!roomCode;

  const cleanupConnections = useCallback(() => {
    console.log('Cleaning up connections');
    if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
    }
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    setRemoteStreams(new Map());
    setPeerCount(0);
  }, []);

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
      
      startSignaling();
      setConvState(ConversationState.Talking);

    } catch (err) {
      console.error('Failed to get mic or connect:', err);
      alert('Could not access microphone. Please check permissions.');
      setConvState(ConversationState.Idle);
      cleanupAudio();
    }
  };

  const startSignaling = () => {
    socketRef.current = io(SIGNALING_SERVER_URL);

    const handleTrackEvent = (event: RTCTrackEvent, peerSocketId: string) => {
        console.log(`Received remote track from ${peerSocketId}`);
        setRemoteStreams(prev => new Map(prev).set(peerSocketId, event.streams[0]));
    };

    const createPeerConnection = (peerSocketId: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pc.onicecandidate = event => {
            if (event.candidate && socketRef.current) {
                socketRef.current.emit('ice_candidate', { target: peerSocketId, candidate: event.candidate });
            }
        };
        pc.ontrack = event => handleTrackEvent(event, peerSocketId);

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current!));
        }
        peersRef.current.set(peerSocketId, pc);
        return pc;
    };

    socketRef.current.on('connect', () => {
        console.log('Connected to signaling server');
        socketRef.current?.emit('join_room', roomCode || 'random');
    });

    socketRef.current.on('room_state', async (users: any) => {
        console.log('Room state updated:', users);
        const myId = socketRef.current!.id;
        const otherUsers = users.filter((id: string) => id !== myId);
        setPeerCount(otherUsers.length);
      
        const currentPeers = Array.from(peersRef.current.keys());
        const newUsers = otherUsers.filter((id: string) => !currentPeers.includes(id));
        const leftUsers = currentPeers.filter((id: string) => !otherUsers.includes(id));
        
        for (const userId of newUsers) {
            const pc = createPeerConnection(userId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('offer', { target: userId, sdp: pc.localDescription });
        }
    
        for (const userId of leftUsers) {
            peersRef.current.get(userId)?.close();
            peersRef.current.delete(userId);
            setRemoteStreams(prev => {
                const newMap = new Map(prev);
                newMap.delete(userId);
                return newMap;
            });
        }
    });

    socketRef.current.on('offer_received', async (data: { from: string, sdp: RTCSessionDescriptionInit }) => {
        const pc = createPeerConnection(data.from);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('answer', { target: data.from, sdp: pc.localDescription });
    });

    socketRef.current.on('answer_received', async (data: { from: string, sdp: RTCSessionDescriptionInit }) => {
        const pc = peersRef.current.get(data.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    });

    socketRef.current.on('ice_candidate_received', (data: { from: string, candidate: RTCIceCandidateInit }) => {
        const pc = peersRef.current.get(data.from);
        if (pc) pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    });
  };

  const stopTalking = useCallback(() => {
    if (convState !== ConversationState.Talking) return;
    setConvState(ConversationState.Summarizing);
    
    cleanupAudio();
    cleanupConnections();
    
    setTimeout(() => {
        setSummary(fakeSummary);
        setConvState(ConversationState.Finished);
    }, 1500);

  }, [convState, cleanupAudio, cleanupConnections]);

  const restart = () => {
    setConvState(ConversationState.Idle);
    setSummary(null);
  };

  useEffect(() => {
    return () => {
        cleanupAudio();
        cleanupConnections();
    };
  }, [cleanupAudio, cleanupConnections]);
  
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
        <div className="hidden">
            {Array.from(remoteStreams.values()).map((stream, index) => (
                <audio key={index} ref={audioEl => {
                    if (audioEl && audioEl.srcObject !== stream) {
                        audioEl.srcObject = stream;
                    }
                }} autoPlay playsInline />
            ))}
        </div>

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
            {isFriendsMode && convState !== ConversationState.Talking && roomCode && <RoomCodeDisplay roomCode={roomCode} peerCount={peerCount} />}
            {renderContent()}
        </main>
        
        <footer className="absolute bottom-6 text-center text-sm text-gray-500">
            <p>Voice chats that turn sound into art.</p>
        </footer>
    </div>
  );
};
