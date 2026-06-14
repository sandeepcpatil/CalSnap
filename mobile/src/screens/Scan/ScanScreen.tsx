import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/ScanNavigator';
import { supabase } from '../../services/supabase';
import { analyzeFood } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { PaywallModal } from '../Paywall/PaywallModal';

type Props = { navigation: NativeStackNavigationProp<ScanStackParamList, 'ScanCamera'> };

export function ScanScreen({ navigation }: Props) {
  const { session, profile } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const isOverFreeLimit = (profile?.scan_count ?? 0) >= 5 && !profile?.is_subscribed;

  const handleCapture = async () => {
    if (isOverFreeLimit) {
      setShowPaywall(true);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await processPhoto(async () => {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
      return photo?.uri ?? null;
    });
  };

  const handlePickFromLibrary = async () => {
    if (isOverFreeLimit) {
      setShowPaywall(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      await processPhoto(async () => result.assets[0].uri);
    }
  };

  const processPhoto = async (getUri: () => Promise<string | null>) => {
    setIsAnalyzing(true);
    try {
      const rawUri = await getUri();
      if (!rawUri) return;

      // Compress to max 1024px before uploading
      const compressed = await ImageManipulator.manipulateAsync(
        rawUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Upload to Supabase Storage
      const fileName = `${session!.user.id}/${Date.now()}.jpg`;
      const response = await fetch(compressed.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('food-images')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // Get a 1-hour signed URL for the backend to use
      const { data: signedData, error: signedError } = await supabase.storage
        .from('food-images')
        .createSignedUrl(fileName, 3600);

      if (signedError || !signedData?.signedUrl) throw new Error('Could not get signed URL');

      // Call backend (server enforces scan count gate)
      const { result } = await analyzeFood(signedData.signedUrl, session!.access_token);

      navigation.navigate('ScanResult', {
        imageUri: compressed.uri,
        imageStorageUrl: signedData.signedUrl,
        result,
      });
    } catch (err: any) {
      if (err?.statusCode === 402 || err?.code === 'scan_limit_reached') {
        setShowPaywall(true);
      } else {
        Alert.alert('Analysis failed', err.message ?? 'Please try again with a clearer photo.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text variant="headlineSmall" style={styles.permissionTitle}>Camera access needed</Text>
        <Text variant="bodyMedium" style={styles.permissionText}>
          CalSnap needs camera access to scan your food.
        </Text>
        <Button mode="contained" onPress={requestPermission} style={styles.permissionButton}>
          Grant Permission
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={cameraType} />

      {/* Overlay UI */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text variant="titleMedium" style={styles.topTitle}>Scan Food</Text>
          <TouchableOpacity
            onPress={() => setCameraType(cameraType === 'back' ? 'front' : 'back')}
            style={styles.flipButton}
          >
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Viewfinder frame */}
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          <Text variant="bodySmall" style={styles.hint}>Point camera at your food</Text>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={handlePickFromLibrary} style={styles.sideButton} disabled={isAnalyzing}>
            <Ionicons name="images-outline" size={26} color="#fff" />
            <Text variant="labelSmall" style={styles.sideButtonLabel}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCapture} style={styles.captureButton} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <ActivityIndicator animating color="#01696f" size="small" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>

          <View style={styles.sideButton} />
        </View>
      </SafeAreaView>

      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  permissionTitle: { color: '#01696f', fontWeight: '700' },
  permissionText: { color: '#546e7a', textAlign: 'center' },
  permissionButton: { borderRadius: 12, backgroundColor: '#01696f' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topTitle: { color: '#fff', fontWeight: '700' },
  flipButton: { padding: 8 },
  viewfinder: {
    flex: 1,
    margin: 40,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#fff', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hint: { color: 'rgba(255,255,255,0.7)', marginBottom: 16 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingVertical: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sideButton: { width: 50, alignItems: 'center', gap: 4 },
  sideButtonLabel: { color: '#fff' },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
});
