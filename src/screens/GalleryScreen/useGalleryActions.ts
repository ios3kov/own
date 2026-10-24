import { useState,useEffect,useCallback,useMemo } from 'react';
import { Share } from 'react-native';
import { showAlert,hideAlert,AlertState,initialAlertState } from '../../components/CustomAlert';
import { useAppStore,useChatStore } from '../../stores';
import { imageGenerationService,coreMLImageGeneratorService } from '../../services';
import type { ImageGenerationState } from '../../services';
import { GeneratedImage } from '../../types';

export const formatDate = (dateStr: string): string => {
  const ts = Number(dateStr);
  const date = Number.isNaN(ts) ? new Date(dateStr) : new Date(ts);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const useGalleryActions = (conversationId: string | undefined) => {
  const { generatedImages, removeGeneratedImage } = useAppStore();
  const conversations = useChatStore(s => s.conversations);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [alertState, setAlertState] = useState<AlertState>(initialAlertState);
  const [imageGenState, setImageGenState] = useState<ImageGenerationState>(
    imageGenerationService.getState()
  );

  useEffect(() => {
    const unsubscribe = imageGenerationService.subscribe((state) => {
      setImageGenState(state);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const syncFromDisk = async () => {
      try {
        const diskImages = await coreMLImageGeneratorService.getGeneratedImages();
        if (diskImages.length > 0) {
          const { generatedImages: storeImages, addGeneratedImage } = useAppStore.getState();
          const existingIds = new Set(storeImages.map(img => img.id));
          for (const img of diskImages) {
            if (!existingIds.has(img.id)) {
              addGeneratedImage(img);
            }
          }
        }
      } catch {
        // Silently fail
      }
    };
    syncFromDisk();
  }, []);

  const chatImageIds = useMemo(() => {
    if (!conversationId) return null;
    const convo = conversations.find(c => c.id === conversationId);
    if (!convo) return new Set<string>();
    const ids = new Set<string>();
    for (const msg of convo.messages) {
      if (msg.attachments) {
        for (const att of msg.attachments) {
          if (att.type === 'image') ids.add(att.id);
        }
      }
    }
    return ids;
  }, [conversationId, conversations]);

  const displayImages = useMemo(() => {
    if (!conversationId) return generatedImages;
    return generatedImages.filter(
      img => img.conversationId === conversationId || (chatImageIds && chatImageIds.has(img.id))
    );
  }, [generatedImages, conversationId, chatImageIds]);

  const handleDelete = useCallback((image: GeneratedImage) => {
    const doDelete = async () => {
      setAlertState(hideAlert());
      try {
        const removed = await coreMLImageGeneratorService.deleteGeneratedImage(image.id);
        if (removed === false) throw new Error('The image file could not be deleted.');
        removeGeneratedImage(image.id);
        if (selectedImage?.id === image.id) setSelectedImage(null);
      } catch {
        setAlertState(showAlert('Could not delete image', 'Your image is still in the gallery. Please try again.'));
      }
    };
    setAlertState(showAlert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { doDelete(); },
        },
      ]
    ));
  }, [selectedImage, removeGeneratedImage]);

  const toggleSelectMode = useCallback(() => {
    setIsSelectMode(prev => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleImageSelection = useCallback((imageId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setAlertState(showAlert(
      'Delete Images',
      `Are you sure you want to delete ${count} image${count > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const doDeleteSelected = async () => {
              setAlertState(hideAlert());
              for (const imageId of selectedIds) {
                try {
                  const removed = await coreMLImageGeneratorService.deleteGeneratedImage(imageId);
                  if (removed === false) throw new Error('Delete failed');
                  removeGeneratedImage(imageId);
                } catch {
                  setAlertState(showAlert('Could not delete all images', 'Some images could not be deleted. They remain in the gallery. Please try again.'));
                  return;
                }
              }
              setSelectedIds(new Set());
              setIsSelectMode(false);
            };
            doDeleteSelected();
          },
        },
      ]
    ));
  }, [selectedIds, removeGeneratedImage]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(displayImages.map(img => img.id)));
  }, [displayImages]);

  const handleSaveImage = useCallback(async (image: GeneratedImage) => {
    try {
      await Share.share({ url: `file://${image.imagePath}` });
    } catch (error: any) {
      setAlertState(showAlert('Error', `Failed to save image: ${error?.message || 'Unknown error'}`));
    }
  }, []);

  const handleCancelGeneration = useCallback(() => {
    imageGenerationService.cancelGeneration().catch(() => {});
  }, []);

  const closeViewer = useCallback(() => {
    setSelectedImage(null);
    setShowDetails(false);
  }, []);

  return {
    isSelectMode,
    selectedIds,
    selectedImage,
    setSelectedImage,
    showDetails,
    setShowDetails,
    alertState,
    setAlertState,
    imageGenState,
    displayImages,
    handleDelete,
    toggleSelectMode,
    toggleImageSelection,
    handleDeleteSelected,
    selectAll,
    handleSaveImage,
    handleCancelGeneration,
    closeViewer,
  };
};
