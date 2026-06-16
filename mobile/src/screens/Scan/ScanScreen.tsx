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
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.glassBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleBadge}>
            <Text style={styles.titleBadgeText}>AI Scanner</Text>
          </View>
          <TouchableOpacity style={styles.glassBtn}>
            <Ionicons name="help-circle-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Viewfinder frame */}
        <View style={styles.viewfinderWrap}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.hintWrap}>
            <Text style={styles.hint}>Point at your food</Text>
          </View>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={handlePickFromLibrary} style={styles.sideButton} disabled={isAnalyzing}>
            <View style={styles.glassBtn}>
              <Ionicons name="images-outline" size={26} color="#fff" />
            </View>
            <Text style={styles.sideLabel}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCapture} style={styles.captureButton} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <ActivityIndicator animating color="#004f54" size="small" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCameraType(cameraType === 'back' ? 'front' : 'back')}
            style={styles.sideButton}
            disabled={isAnalyzing}
          >
            <View style={styles.glassBtn}>
              <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
            </View>
            <Text style={styles.sideLabel}>Flip</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16, backgroundColor: '#f7fafa' },
  permissionTitle: { color: '#004f54', fontWeight: '700' },
  permissionText: { color: '#3f4949', textAlign: 'center' },
  permissionButton: { borderRadius: 50, backgroundColor: '#004f54' },
  overlay: { flex: 1, justifyContent: 'space-between' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  titleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  titleBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  viewfinderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
  viewfinder: {
    width: 280,
    height: 280,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#fff',
    borderWidth: 4,
  },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 40 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 40 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 40 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 40 },
  hintWrap: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 50,
  },
  hint: { color: '#fff', fontSize: 16, fontWeight: '700' },

  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  sideButton: { alignItems: 'center', gap: 6 },
  sideLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff' },
});
