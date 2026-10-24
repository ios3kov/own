import React from 'react';
import { View,Text,TouchableOpacity,ScrollView } from 'react-native';
import { useThemedStyles } from '../../theme';
import { SPACING } from '../../constants';
import { createStyles } from './styles';
import { BackendFilter,ImageFilterDimension } from './types';
import { SD_VERSION_OPTIONS } from './constants';

interface Props {
  backendFilter: BackendFilter;
  setBackendFilter: (f: BackendFilter) => void;
  styleFilter: string;
  setStyleFilter: (f: string) => void;
  sdVersionFilter: string;
  setSdVersionFilter: (f: string) => void;
  imageFilterExpanded: ImageFilterDimension;
  setImageFilterExpanded: (d: ImageFilterDimension | ((prev: ImageFilterDimension) => ImageFilterDimension)) => void;
  hasActiveImageFilters: boolean;
  clearImageFilters: () => void;
  setUserChangedBackendFilter: (v: boolean) => void;
}

function getSdLabel(filter: string): string {
  return filter === 'all' ? 'Version' : (SD_VERSION_OPTIONS.find(o => o.key === filter)?.label ?? 'Version');
}

interface ExpandedSectionProps {
  imageFilterExpanded: ImageFilterDimension;
  backendFilter: BackendFilter;
  sdVersionFilter: string;
  styleFilter: string;
  setBackendFilter: (f: BackendFilter) => void;
  setSdVersionFilter: (f: string) => void;
  setStyleFilter: (f: string) => void;
  setImageFilterExpanded: (d: ImageFilterDimension | ((prev: ImageFilterDimension) => ImageFilterDimension)) => void;
  setUserChangedBackendFilter: (v: boolean) => void;
}

const FilterExpandedSection: React.FC<ExpandedSectionProps> = ({
  imageFilterExpanded, sdVersionFilter,
  setSdVersionFilter,
  setImageFilterExpanded,
}) => {
  const styles = useThemedStyles(createStyles);

  if (imageFilterExpanded === 'sdVersion') {
    return (
      <View style={styles.filterExpandedContent}>
        <View style={styles.filterChipWrap}>
          {SD_VERSION_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.key}
              style={[styles.filterChip, sdVersionFilter === option.key && styles.filterChipActive]}
              onPress={() => { setSdVersionFilter(option.key); setImageFilterExpanded(null); }}
            >
              <Text style={[styles.filterChipText, sdVersionFilter === option.key && styles.filterChipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return null;
};

export const ImageFilterBar: React.FC<Props> = ({
  backendFilter, setBackendFilter,
  styleFilter, setStyleFilter,
  sdVersionFilter, setSdVersionFilter,
  imageFilterExpanded, setImageFilterExpanded,
  hasActiveImageFilters, clearImageFilters,
  setUserChangedBackendFilter,
}) => {
  const styles = useThemedStyles(createStyles);

  const sdLabel = getSdLabel(sdVersionFilter);

  return (
    <View style={[styles.filterBar, { marginHorizontal: -SPACING.lg }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillRow} keyboardShouldPersistTaps="handled">
        {false}
        {((
          <TouchableOpacity
            style={[styles.filterPill, sdVersionFilter !== 'all' && styles.filterPillActive]}
            onPress={() => setImageFilterExpanded(prev => prev === 'sdVersion' ? null : 'sdVersion')}
          >
            <Text style={[styles.filterPillText, sdVersionFilter !== 'all' && styles.filterPillTextActive]}>
              {sdLabel} {imageFilterExpanded === 'sdVersion' ? '\u25B4' : '\u25BE'}
            </Text>
          </TouchableOpacity>
        ))}
        {false}
        {hasActiveImageFilters && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearImageFilters}>
            <Text style={styles.clearFiltersText}>Clear</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <FilterExpandedSection
        imageFilterExpanded={imageFilterExpanded}
        backendFilter={backendFilter}
        sdVersionFilter={sdVersionFilter}
        styleFilter={styleFilter}
        setBackendFilter={setBackendFilter}
        setSdVersionFilter={setSdVersionFilter}
        setStyleFilter={setStyleFilter}
        setImageFilterExpanded={setImageFilterExpanded}
        setUserChangedBackendFilter={setUserChangedBackendFilter}
      />
    </View>
  );
};
