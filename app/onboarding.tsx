import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@clerk/clerk-expo';
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
  const { signOut } = useAuth();
  const api = useApi();

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [hasKnownEmail, setHasKnownEmail] = useState(false);
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');

  useEffect(() => {
    api.getMe().then((u) => {
      if (u.displayName) {
        const parts = u.displayName.split(' ');
        setFirstName(parts[0] ?? '');
        if (parts.length === 2) { setLastName(parts[1]); }
        else if (parts.length >= 3) { setMiddleName(parts[1]); setLastName(parts.slice(2).join(' ')); }
        // Sign in with Apple (or Google) already supplied a name — Apple's
        // Sign in with Apple guidelines prohibit re-requiring info the
        // provider already gave, so skip straight past the name step
        // instead of just pre-filling it. Still reachable via the back
        // arrow on step 1 if someone wants to edit it.
        setUsername((parts[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user');
        setStep(1);
      }
      // Every sign-up path (Apple, Google, or email/password) already gives
      // us a real email before onboarding is ever reached — an editable
      // input here still reads as "asking again" to Apple's reviewers even
      // pre-filled and skippable, so show it as confirmed text instead of a
      // field to fill in.
      if (u.email) { setEmail(u.email); setHasKnownEmail(true); }
    }).catch(() => {}).finally(() => setLoadingUser(false));
  }, []);

  // Suggest a username from the first name until the person edits it themselves
  const suggestUsername = () => (firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'user').slice(0, 20);
  const goToUsernameStep = () => {
    if (!usernameTouched) setUsername(suggestUsername());
    setStep(1);
  };

  useEffect(() => {
    if (step !== 1 || !username) { setUsernameStatus('idle'); return; }
    if (!/^[a-z0-9_-]{3,30}$/.test(username)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { available } = await api.checkUsername(username);
        if (!cancelled) setUsernameStatus(available ? 'ok' : 'taken');
      } catch {
        if (!cancelled) setUsernameStatus('idle');
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username, step]);

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

  const handleFinish = async (skipContact = false) => {
    setSubmitting(true);
    const displayName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ');
    // Skip on the contact step means the cards start without email/phone
    const contactEmail = skipContact ? '' : email.trim();
    const contactPhone = skipContact ? '' : phone.trim();
    try {
      await api.updateMe({ displayName: displayName || undefined });

      // Profile photo still backs the vCard avatar; the two starter cards get
      // their own copies below so each stays independently editable.
      if (photoUri) {
        await api.uploadPhoto(photoUri);
      }

      await api.updateMe({ username });

      const workCard = await api.addCard({ name: 'Work', accentColor: '#C9973A' });
      const workFieldPromises: Promise<any>[] = [];
      if (photoUri) workFieldPromises.push(api.uploadCardPhoto(workCard.id, photoUri));
      if (contactEmail) workFieldPromises.push(api.addField(workCard.id, { type: 'email', value: contactEmail }));
      if (contactPhone) workFieldPromises.push(api.addField(workCard.id, { type: 'phone', value: contactPhone }));
      if (jobTitle.trim()) workFieldPromises.push(api.addField(workCard.id, { type: 'title', value: jobTitle.trim() }));
      if (company.trim()) workFieldPromises.push(api.addField(workCard.id, { type: 'company', value: company.trim() }));
      await Promise.all(workFieldPromises);

      const personalCard = await api.addCard({ name: 'Personal', accentColor: '#7C3AED' });
      if (photoUri) await api.uploadCardPhoto(personalCard.id, photoUri);
      if (contactEmail) await api.addField(personalCard.id, { type: 'email', value: contactEmail });
      if (contactPhone) await api.addField(personalCard.id, { type: 'phone', value: contactPhone });

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
    renderStep4,
  ];

  function renderStep0() {
    return (
      <>
        <Text style={styles.stepTitle}>Let's start with{'\n'}the basics</Text>
        <Text style={styles.stepSub}>What should people call you?</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>FIRST NAME</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={COLORS.textTertiary}
            autoCorrect={false}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>MIDDLE NAME</Text>
          <TextInput
            style={styles.input}
            value={middleName}
            onChangeText={setMiddleName}
            placeholder="Middle name (optional)"
            placeholderTextColor={COLORS.textTertiary}
            autoCorrect={false}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>LAST NAME</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={COLORS.textTertiary}
            autoCorrect={false}
          />
        </View>
        <Pressable
          style={[styles.continueBtn, !firstName.trim() && styles.continueBtnDim]}
          onPress={() => firstName.trim() && goToUsernameStep()}
          disabled={!firstName.trim()}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>
      </>
    );
  }

  function renderStep1() {
    const canContinue = usernameStatus === 'ok' || usernameStatus === 'idle';
    const statusText =
      usernameStatus === 'checking' ? 'Checking…'
      : usernameStatus === 'ok' ? 'Available'
      : usernameStatus === 'taken' ? 'That username is taken'
      : usernameStatus === 'invalid' ? '3–30 characters: letters, numbers, _ or -'
      : '';
    return (
      <>
        <Text style={styles.stepTitle}>Choose your{'\n'}link</Text>
        <Text style={styles.stepSub}>This is how people find your cards. You can change it later in Settings.</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>USERNAME</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(v) => { setUsernameTouched(true); setUsername(v.toLowerCase().replace(/\s/g, '')); }}
            placeholder="username"
            placeholderTextColor={COLORS.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
          <Text style={{ marginTop: 8, fontSize: 13, color: COLORS.textTertiary }}>
            {`linkd.biz/${username || 'username'}/work`}
          </Text>
          {!!statusText && (
            <Text style={{ marginTop: 4, fontSize: 13, color: usernameStatus === 'ok' ? COLORS.accent : COLORS.textSecondary }}>
              {statusText}
            </Text>
          )}
        </View>
        <Pressable
          style={[styles.continueBtn, (!username || !canContinue) && styles.continueBtnDim]}
          onPress={() => username && canContinue && setStep(2)}
          disabled={!username || !canContinue}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>
      </>
    );
  }

  function renderStep2() {
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
        <Pressable style={styles.continueBtn} onPress={() => setStep(3)}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>
        <Pressable
          style={styles.skipBtn}
          onPress={() => { setJobTitle(''); setCompany(''); setStep(3); }}
        >
          <Text style={styles.skipBtnText}>Skip</Text>
        </Pressable>
      </>
    );
  }

  function renderStep3() {
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
        <Pressable style={styles.continueBtn} onPress={() => setStep(4)}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>
        <Pressable
          style={styles.skipBtn}
          onPress={() => { setPhotoUri(null); setStep(4); }}
        >
          <Text style={styles.skipBtnText}>Skip</Text>
        </Pressable>
      </>
    );
  }

  function renderStep4() {
    return (
      <>
        <Text style={styles.stepTitle}>Almost done!</Text>
        <Text style={styles.stepSub}>How can people reach you?</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>EMAIL</Text>
          {hasKnownEmail ? (
            <View style={styles.staticField}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.textSecondary} />
              <Text style={styles.staticFieldText}>{email}</Text>
            </View>
          ) : (
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
          )}
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
          onPress={() => handleFinish()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#0C0C0E" size="small" />
          ) : (
            <Text style={styles.continueBtnText}>Let's go</Text>
          )}
        </Pressable>
        <Pressable style={styles.skipBtn} onPress={() => handleFinish(true)} disabled={submitting}>
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
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[styles.progressSegment, i <= step && styles.progressSegmentActive]}
              />
            ))}
          </View>

          {/* Back arrow — step 0 signs out and returns to auth; steps 1+ go to previous step */}
          <Pressable
            style={styles.backBtn}
            onPress={step === 0 ? async () => { await signOut(); router.replace('/(auth)/sign-up'); } : () => setStep((s) => s - 1)}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </Pressable>

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
  staticField: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
  },
  staticFieldText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
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
