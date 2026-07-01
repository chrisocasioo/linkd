import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApi } from '../lib/api';
import { COLORS, FONTS } from '../constants/colors';

export default function OnboardingScreen() {
  const router = useRouter();
  const api = useApi();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    api.getMe().then((u) => {
      if (u.displayName) setName(u.displayName);
      if (u.email) setEmail(u.email);
    }).catch(() => {}).finally(() => setLoadingUser(false));
  }, []);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await api.updateMe({ displayName: name.trim() || undefined });

      if (photoUri) {
        await api.uploadPhoto(photoUri);
      }

      const base = (name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'user').slice(0, 20);
      let username = base;
      try {
        const { available } = await api.checkUsername(base);
        if (!available) username = base.slice(0, 16) + Math.floor(1000 + Math.random() * 9000);
      } catch {}
      await api.updateMe({ username });

      const workCard = await api.addCard({ name: 'Work', accentColor: '#C9A84C' });
      const workFieldPromises: Promise<any>[] = [];
      if (email.trim()) workFieldPromises.push(api.addField(workCard.id, { type: 'email', value: email.trim() }));
      if (phone.trim()) workFieldPromises.push(api.addField(workCard.id, { type: 'phone', value: phone.trim() }));
      if (jobTitle.trim()) workFieldPromises.push(api.addField(workCard.id, { type: 'title', value: jobTitle.trim() }));
      if (company.trim()) workFieldPromises.push(api.addField(workCard.id, { type: 'company', value: company.trim() }));
      await Promise.all(workFieldPromises);

      const personalCard = await api.addCard({ name: 'Personal', accentColor: '#7C3AED' });
      if (email.trim()) await api.addField(personalCard.id, { type: 'email', value: email.trim() });

      router.replace('/(tabs)/cards');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
      setSubmitting(false);
    }
  };

  if (loadingUser) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const steps = [
    renderStep0,
    renderStep1,
    renderStep2,
    renderStep3,
  ];

  function renderStep0() {
    return (
      <>
        <Text style={styles.stepTitle}>Let's start with{'\n'}the basics</Text>
        <Text style={styles.stepSub}>What should people call you?</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={COLORS.textTertiary}
            autoCorrect={false}
          />
        </View>
        <Pressable
          style={[styles.continueBtn, !name.trim() && styles.continueBtnDim]}
          onPress={() => name.trim() && setStep(1)}
          disabled={!name.trim()}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>
      </>
    );
  }

  function renderStep1() {
    return (
      <>
        <Text style={styles.stepTitle}>Tell us about{'\n'}your work</Text>
        <Text style={styles.stepSub}>We'll add this to your Work card.</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>JOB TITLE</Text>
          <TextInput
            style={styles.input}
            value={jobTitle}
            onChangeText={setJobTitle}
            placeholder="e.g. Founder"
            placeholderTextColor={COLORS.textTertiary}
            autoCorrect={false}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>COMPANY</Text>
          <TextInput
            style={styles.input}
            value={company}
            onChangeText={setCompany}
            placeholder="e.g. Acme Inc"
            placeholderTextColor={COLORS.textTertiary}
            autoCorrect={false}
          />
        </View>
        <Pressable style={styles.continueBtn} onPress={() => setStep(2)}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>
        <Pressable style={styles.skipBtn} onPress={() => setStep(2)}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </Pressable>
      </>
    );
  }

  function renderStep2() {
    return (
      <>
        <Text style={styles.stepTitle}>Make your card{'\n'}stand out</Text>
        <Text style={styles.stepSub}>Add a profile photo to show on your card.</Text>
        <Pressable style={styles.photoPicker} onPress={pickPhoto}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.photoPlaceholderText}>Tap to add photo</Text>
            </View>
          )}
        </Pressable>
        <Pressable style={styles.continueBtn} onPress={() => setStep(3)}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>
        <Pressable style={styles.skipBtn} onPress={() => setStep(3)}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </Pressable>
      </>
    );
  }

  function renderStep3() {
    return (
      <>
        <Text style={styles.stepTitle}>Almost done!</Text>
        <Text style={styles.stepSub}>How can people reach you?</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>PHONE</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 000 0000"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="phone-pad"
          />
        </View>
        <Pressable
          style={[styles.continueBtn, submitting && styles.continueBtnDim]}
          onPress={handleFinish}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#0C0C0E" size="small" />
          ) : (
            <Text style={styles.continueBtnText}>Let's go</Text>
          )}
        </Pressable>
        <Pressable style={styles.skipBtn} onPress={handleFinish} disabled={submitting}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </Pressable>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Progress bar */}
          <View style={styles.progressBar}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.progressSegment, i <= step && styles.progressSegmentActive]}
              />
            ))}
          </View>

          {/* Back arrow for steps 1+ */}
          {step > 0 && (
            <Pressable style={styles.backBtn} onPress={() => setStep((s) => s - 1)} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color={COLORS.text} />
            </Pressable>
          )}

          <View style={styles.stepContent}>
            {steps[step]()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  progressSegmentActive: {
    backgroundColor: COLORS.accent,
  },
  backBtn: {
    marginTop: 12,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  stepContent: {
    marginTop: 32,
    gap: 16,
  },
  stepTitle: {
    fontSize: 32,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  stepSub: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  inputGroup: { gap: 6 },
  inputLabel: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  input: {
    height: 52,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  photoPicker: {
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    alignItems: 'center',
    gap: 10,
  },
  photoPlaceholderText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  continueBtn: {
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  continueBtnDim: { opacity: 0.5 },
  continueBtnText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#0C0C0E',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipBtnText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
});
