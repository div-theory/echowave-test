
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
  const [socketError, setSocketError] = useState(false);

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
    if (convState !== ConversationState.Idle && convState !== ConversationState.Finished) return;
    
    setConvState(ConversationState.Connecting);
    setSummary(null);
    setSocketError(false);

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

    } catch (err) {
      console.error('Failed to get mic:', err);
      alert('Could not access microphone. Please check permissions.');
      setConvState(ConversationState.Idle);
      cleanupAudio();
    }
  };

  const startSignaling = () => {
    if (socketRef.current) {
        socketRef.current.disconnect();
    }

    const socket = io(SIGNALING_SERVER_URL);
    socketRef.current = socket;

    const createPeerConnection = (peerSocketId: string, initiator: boolean = false): RTCPeerConnection => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        
        pc.onicecandidate = event => {
            if (event.candidate && socketRef.current) {
                socketRef.current.emit('signal', { target: peerSocketId, data: { type: 'candidate', candidate: event.candidate } });
            }
        };

        pc.ontrack = event => {
            console.log(`Received remote track from ${peerSocketId}`);
            setRemoteStreams(prev => new Map(prev).set(peerSocketId, event.streams[0]));
        };

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current!));
        }

        peersRef.current.set(peerSocketId, pc);
        
        if (initiator) {
            pc.createOffer()
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                  socketRef.current?.emit('signal', { target: peerSocketId, data: { type: 'offer', sdp: pc.localDescription } });
              })
              .catch(e => console.error("Error creating offer", e));
        }
        
        return pc;
    };


    socket.on('connect', () => {
        console.log('Connected to signaling server');
        setSocketError(false);
        setConvState(ConversationState.Talking);
        
        if (isFriendsMode) {
            socket.emit('join-room', roomCode);
        } else {
            socket.emit('join-random');
        }
    });
    
    socket.on('connect_error', (err: Error) => {
        console.error('Signaling server connection error:', err);
        setSocketError(true);
        setConvState(ConversationState.Idle);
        cleanupConnections();
        cleanupAudio();
    });

    // --- RANDOM MODE ---
    socket.on('matched', ({ partner, initiator }: { partner: string, initiator: boolean }) => {
        console.log(`Matched with ${partner}. Initiator: ${initiator}`);
        setPeerCount(1);
        createPeerConnection(partner, initiator);
    });

    // --- FRIENDS MODE ---
    socket.on('user-joined', ({ id, count }: { id: string, count: number }) => {
        console.log(`User ${id} joined the room. Total: ${count}`);
        setPeerCount(count - 1);
        createPeerConnection(id, true);
    });

    socket.on('user-left', ({ id, count }: { id: string, count: number }) => {
        console.log(`User ${id} left the room. Total: ${count}`);
        setPeerCount(count > 0 ? count - 1 : 0);
        if (peersRef.current.has(id)) {
            peersRef.current.get(id)?.close();
            peersRef.current.delete(id);
        }
        setRemoteStreams(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
        });
        if (!isFriendsMode) {
            stopTalking();
        }
    });
    
    socket.on('room-error', (message: string) => {
        console.error('Room error:', message);
        alert(`Error: ${message}. Redirecting to home.`);
        navigate('/');
    });

    // --- GENERIC WebRTC SIGNALING ---
    socket.on('signal', async ({ sender, data }: { sender: string, data: any }) => {
        let pc = peersRef.current.get(sender);

        if (data.type === 'offer') {
            if (!pc) {
                pc = createPeerConnection(sender, false);
            }
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('signal', { target: sender, data: { type: 'answer', sdp: pc.localDescription } });
        } else if (data.type === 'answer') {
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } else if (data.type === 'candidate') {
            if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
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
    setSocketError(false);
  };

  useEffect(() => {
    if (isFriendsMode && convState === ConversationState.Idle) {
      startTalking();
    }
    return () => {
        cleanupAudio();
        cleanupConnections();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFriendsMode, roomCode]);
  
  const renderContent = () => {
    if (socketError) {
        return (
            <div className="text-center bg-red-500/20 border border-red-500 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-2">Connection Failed</h3>
                <p className="text-red-200 mb-4">Could not connect to the signaling server.</p>
                <button
                    onClick={startTalking}
                    className="bg-white text-slate-900 rounded-full px-6 py-2 font-bold shadow-lg hover:shadow-xl hover:scale-105 transform-gpu transition-all duration-300"
                >
                    Retry
                </button>
            </div>
        )
    }

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
            {Array.from(remoteStreams.entries()).map(([socketId, stream]) => (
                <audio
                    key={socketId}
                    ref={audioEl => {
                        if (audioEl && audioEl.srcObject !== stream) {
                            audioEl.srcObject = stream;
                        }
                    }}
                    autoPlay
                    playsInline
                />
            ))}
        </div>

        <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center">
            <Link to="/" onClick={restart} className="text-2xl font-black tracking-tighter" style={{ textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>
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
            {isFriendsMode && convState !== ConversationState.Finished && roomCode && <RoomCodeDisplay roomCode={roomCode} peerCount={peerCount} />}
            {renderContent()}
        </main>
        
        <footer className="absolute bottom-6 text-center text-sm text-gray-500">
            <p>Voice chats that turn sound into art.</p>
        </footer>
    </div>
  );
};
