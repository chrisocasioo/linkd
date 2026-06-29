import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QROutput } from '../../components/QRGenerator/QROutput';
import { TypeSelector } from '../../components/QRGenerator/TypeSelector';
import { URLForm } from '../../components/QRGenerator/URLForm';
import { WiFiForm } from '../../components/QRGenerator/WiFiForm';
import { COLORS, FONTS } from '../../constants/colors';
import { QRType } from '../../lib/qr';

interface GeneratedQR {
  type: QRType;
  value: string;
  label: string;
  key: string;
}

export default function GenerateScreen() {
  const [activeType, setActiveType] = useState<QRType>('url');
  const [generated, setGenerated] = useState<GeneratedQR | null>(null);

  const handleTypeChange = (type: QRType) => {
    setActiveType(type);
    setGenerated(null);
  };

  const handleGenerate = (value: string, label: string) => {
    if (generated && generated.type === activeType && generated.value === value) return;
    setGenerated({ type: activeType, value, label, key: Date.now().toString() });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Generate</Text>
        <Text style={styles.subtitle}>Create a QR code</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TypeSelector activeType={activeType} onChange={handleTypeChange} />

        {activeType === 'url' ? (
          <URLForm onGenerate={handleGenerate} />
        ) : (
          <WiFiForm onGenerate={handleGenerate} />
        )}

        {generated && (
          <QROutput
            key={generated.key}
            type={generated.type}
            value={generated.value}
            label={generated.label}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  title: {
    fontSize: 22,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 12, paddingBottom: 40 },
});
