
import React from 'react';
import { Summary } from '../types';

interface SummaryCardProps {
  summary: Summary;
  onRestart: () => void;
}

const CheckIcon = () => (
    <svg className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
);

const BoltIcon = () => (
    <svg className="w-5 h-5 text-yellow-400 mr-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.5H3.086a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
    </svg>
);


export const SummaryCard: React.FC<SummaryCardProps> = ({ summary, onRestart }) => {
  return (
    <div className="w-full max-w-lg bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl animate-fade-in">
        <h2 className="text-3xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500" style={{ textShadow: '0 0 10px rgba(255,255,255,0.1)' }}>
            {summary.title}
        </h2>

        <div>
            <h3 className="font-bold text-lg mb-3 flex items-center"><CheckIcon />Key Points</h3>
            <ul className="space-y-2 pl-2">
                {summary.keyPoints.map((point, index) => (
                    <li key={index} className="text-gray-300">{point}</li>
                ))}
            </ul>
        </div>
        
        {summary.actionItems && summary.actionItems.length > 0 && (
            <div>
                <h3 className="font-bold text-lg mb-3 flex items-center"><BoltIcon />Action Items</h3>
                <ul className="space-y-2 pl-2">
                    {summary.actionItems.map((item, index) => (
                        <li key={index} className="text-gray-300">{item}</li>
                    ))}
                </ul>
            </div>
        )}

        <button
            onClick={onRestart}
            className="w-full mt-4 bg-white text-slate-900 rounded-full px-6 py-3 font-bold shadow-lg hover:shadow-xl hover:scale-105 transform-gpu transition-all duration-300"
        >
            Talk Again
        </button>
    </div>
  );
};
