import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

interface SegmentedOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  compact = false,
}: SegmentedControlProps) {
  const { theme, isRTL } = useAppPreferences();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              compact && styles.optionCompact,
              {
                backgroundColor: selected ? theme.colors.accent : 'transparent',
              },
            ]}
            onPress={() => onChange(option.value)}
          >
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                {
                  color: selected ? theme.colors.accentContrast : theme.colors.textMuted,
                },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  option: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  optionCompact: {
    minHeight: 36,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 12,
  },
});
