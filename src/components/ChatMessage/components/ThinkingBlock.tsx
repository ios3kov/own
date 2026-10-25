import {ReplyTextLayout} from './ReplyTextLayout';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MarkdownText } from '../../MarkdownText';
import type { ParsedContent } from '../types';

interface ThinkingBlockProps {
  replyTraceId?:string;
  parsedContent: ParsedContent;
  showThinking: boolean;
  onToggle: () => void;
  styles: any;
}

export function ThinkingBlock({
  parsedContent,
  replyTraceId,
  showThinking,
  onToggle,
  styles,
}: Readonly<ThinkingBlockProps>) {
  return (
    <View testID="thinking-block" style={styles.thinkingBlock}>
      <TouchableOpacity
        testID="thinking-block-toggle"
        style={styles.thinkingHeader}
        onPress={onToggle}
      >
        <View style={styles.thinkingHeaderIconBox}>
          <Text style={styles.thinkingHeaderIconText}>
            {(() => {
              if (parsedContent.thinkingLabel?.includes('Enhanced')) return 'E';
              return parsedContent.isThinkingComplete ? 'T' : '...';
            })()}
          </Text>
        </View>
        <View style={styles.thinkingHeaderTextContainer}>
          <Text testID="thinking-block-title" style={styles.thinkingHeaderText}>
            {parsedContent.thinkingLabel || (parsedContent.isThinkingComplete ? 'Thought process' : 'Thinking...')}
          </Text>
          {!showThinking && !!parsedContent.thinking && (
            <Text style={styles.thinkingPreview} numberOfLines={2} ellipsizeMode="tail">
              {parsedContent.thinking.slice(0, 80)}
              {parsedContent.thinking.length > 80 ? '...' : ''}
            </Text>
          )}
        </View>
        <Text style={styles.thinkingToggle}>
          {showThinking ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>
      {showThinking && parsedContent.thinking != null && (
        <View testID="thinking-block-content" style={styles.thinkingBlockContent}>
          <ReplyTextLayout traceId={parsedContent.thinking.trim() ? replyTraceId : undefined} testID="reasoning-layout">
            <MarkdownText dimmed streaming={!parsedContent.isThinkingComplete}>{parsedContent.thinking}</MarkdownText>
          </ReplyTextLayout>
        </View>
      )}
    </View>
  );
}
