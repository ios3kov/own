import React, {useCallback,useLayoutEffect,useRef} from 'react';
import { ChatMessage } from '../../components';
import { Message } from '../../types';
import { ChatMessageItem } from './useChatScreen';

const StableChatMessage = React.memo(ChatMessage);

// Preserve the memoized row while actions still use the latest committed chat state.
function useCurrentCallback<Args extends unknown[]>(callback: (...args:Args)=>void) {
  const latest = useRef(callback);
  useLayoutEffect(() => {latest.current=callback;},[callback]);
  return useCallback((...args:Args) => latest.current(...args),[]);
}

type MessageRendererProps = {
  item: Message | ChatMessageItem;
  index: number;
  displayMessagesLength: number;
  animateLastN: number;
  imageModelLoaded: boolean;
  isStreaming: boolean;
  isGeneratingImage: boolean;
  showGenerationDetails: boolean;
  onCopy: (content: string) => void;
  onRetry: (message: Message) => void;
  onEdit: (message: Message, newContent: string) => void;
  onGenerateImage: (prompt: string) => void;
  onImagePress: (uri: string) => void;
};

export const MessageRenderer: React.FC<MessageRendererProps> = ({
  item,
  index,
  displayMessagesLength,
  animateLastN,
  imageModelLoaded,
  isStreaming,
  isGeneratingImage,
  showGenerationDetails,
  onCopy,
  onRetry,
  onEdit,
  onGenerateImage,
  onImagePress,
}) => {
  const copy=useCurrentCallback(onCopy);
  const retry=useCurrentCallback(onRetry);
  const edit=useCurrentCallback(onEdit);
  const generateImage=useCurrentCallback(onGenerateImage);
  const imagePress=useCurrentCallback(onImagePress);
  return <StableChatMessage
    message={item as Message}
    isStreaming={item.id === 'streaming'}
    onCopy={copy}
    onRetry={retry}
    onEdit={edit}
    onGenerateImage={generateImage}
    onImagePress={imagePress}
    canGenerateImage={imageModelLoaded && !isStreaming && !isGeneratingImage}
    showGenerationDetails={showGenerationDetails}
    animateEntry={animateLastN > 0 && index >= displayMessagesLength - animateLastN}
  />;
};
