
export enum ConversationState {
  Idle,
  Connecting,
  Talking,
  Summarizing,
  Finished,
}

export interface Summary {
  title: string;
  keyPoints: string[];
  actionItems: string[];
}
