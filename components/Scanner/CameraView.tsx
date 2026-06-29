import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, FONTS } from '../../constants/colors';

interface Props {
  onScanned: (data: string) => void;
  isScanned: boolean;
}

const CORNER_SIZE = 32;
const CORNER_THICK = 3;
const FRAME_SIZE = 220;
const ACCENT = COLORS.accent;

function ScanFrame({ lineY }: { lineY: Animated.Value }) {
  const bar = (style: object) => (
    <View style={[{ position: 'absolute', backgroundColor: ACCENT }, style]} />
  );

  return (
    <View style={{ width: FRAME_SIZE, height: FRAME_SIZE, position: 'relative' }}>
      {/* Top-left */}
      {bar({ top: 0, left: 0, width: CORNER_THICK, height: CORNER_SIZE })}
      {bar({ top: 0, left: 0, width: CORNER_SIZE, height: CORNER_THICK })}
      {/* Top-right */}
      {bar({ top: 0, right: 0, width: CORNER_THICK, height: CORNER_SIZE })}
      {bar({ top: 0, right: 0, width: CORNER_SIZE, height: CORNER_THICK })}
      {/* Bottom-left */}
      {bar({ bottom: 0, left: 0, width: CORNER_THICK, height: CORNER_SIZE })}
      {bar({ bottom: 0, left: 0, width: CORNER_SIZE, height: CORNER_THICK })}
      {/* Bottom-right */}
      {bar({ bottom: 0, right: 0, width: CORNER_THICK, height: CORNER_SIZE })}
      {bar({ bottom: 0, right: 0, width: CORNER_SIZE, height: CORNER_THICK })}

      {/* Animated scan line */}
      <Animated.View
        style={[
          styles.scanLine,
          {
            transform: [
              {
                translateY: lineY.interpolate({
                  inputRange: [0, 1],
                  outputRange: [6, FRAME_SIZE - 8],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

export function ScannerCameraView({ onScanned, isScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const lineY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(lineY, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(lineY, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [lineY]);

  if (!permission) return <View style={styles.fill} />;

  if (!permission.granted) {
    return (
      <View style={styles.permBox}>
        <Text style={styles.permText}>Camera access is needed to scan QR codes.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        enableTorch={torchOn}
        onBarcodeScanned={isScanned ? undefined : ({ data }) => onScanned(data)}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Dimmed surround + frame overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top dim */}
        <View style={styles.dimTop} />
        {/* Middle row */}
        <View style={styles.dimMiddle}>
          <View style={styles.dimSide} />
          <ScanFrame lineY={lineY} />
          <View style={styles.dimSide} />
        </View>
        {/* Bottom dim + hint */}
        <View style={styles.dimBottom}>
          <Text style={styles.hint}>Align QR code within the frame</Text>
        </View>
      </View>

      <Pressable
        style={styles.torchBtn}
        onPress={() => setTorchOn((v) => !v)}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M13 2L4.5 13.5H11L10 22L20.5 10H13.5L13 2Z"
            fill={torchOn ? COLORS.accent : 'rgba(255,255,255,0.85)'}
            stroke={torchOn ? COLORS.accent : 'rgba(255,255,255,0.85)'}
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
    </View>
  );
}

const DIM = 'rgba(0,0,0,0.56)';

const styles = StyleSheet.create({
  fill: { flex: 1 },
  permBox: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  permBtn: {
    height: 48,
    paddingHorizontal: 24,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#fff' },
  dimTop: { backgroundColor: DIM, flex: 1 },
  dimMiddle: { flexDirection: 'row', height: FRAME_SIZE },
  dimSide: { flex: 1, backgroundColor: DIM },
  dimBottom: {
    backgroundColor: DIM,
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
  },
  hint: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.5)',
  },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.accent,
  },
  torchBtn: {
    position: 'absolute',
    bottom: 80,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
