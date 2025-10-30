
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';

const SIGNALING_SERVER_URL = 'https://webrtc-signal-server.glitch.me/';

export const CreateRoomRedirector: React.FC = () => {
    const navigate = useNavigate();
    const socketRef = useRef<any | null>(null);

    useEffect(() => {
        const socket = io(SIGNALING_SERVER_URL);
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to signaling server to create a room.');
            socket.emit('create-room');
        });

        socket.on('room-created', ({ code }: { code: string }) => {
            console.log(`Room created with code: ${code}`);
            socket.disconnect();
            navigate(`/join/${code}`, { replace: true });
        });
        
        socket.on('connect_error', (err) => {
            console.error('Failed to connect for room creation:', err);
            alert('Could not create a room. Please try again.');
            navigate('/', { replace: true });
        });

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [navigate]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-white">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto"></div>
            <p className="mt-4 text-lg">Creating a new room...</p>
        </div>
    );
};
