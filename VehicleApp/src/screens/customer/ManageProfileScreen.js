import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { customerAPI } from '../../api';
import SuccessToast from '../../components/SuccessToast';
import { Colors, Radius, Shadow } from '../../constants/theme';
import { useAppAlert } from '../../context/AppAlertContext';
import { useAuth } from '../../context/AuthContext';

const SECURITY_QUESTIONS = [
  "What is your mother's name?",
  "What is your father's name?",
  'What is your school name?',
  "What is your best friend's name?",
];

function SectionCard({ title, subtitle, children }) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function FieldLabel({ children }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function FieldError({ message }) {
  if (!message) {
    return null;
  }

  return <Text style={styles.fieldError}>{message}</Text>;
}

function IconInput({
  icon,
  containerStyle,
  inputStyle,
  secureTextEntry = false,
  isVisible = false,
  onToggleVisibility,
  ...props
}) {
  return (
    <View style={[styles.iconInputWrap, containerStyle]}>
      <MaterialCommunityIcons name={icon} size={18} color="#6b7280" style={styles.iconInputIcon} />
      <TextInput
        {...props}
        secureTextEntry={secureTextEntry ? !isVisible : false}
        style={[styles.iconInputField, inputStyle]}
        placeholderTextColor={props.placeholderTextColor || '#9ca3af'}
      />
      {secureTextEntry ? (
        <Pressable onPress={onToggleVisibility} hitSlop={10} style={styles.visibilityButton}>
          <MaterialCommunityIcons
            name={isVisible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color="#6b7280"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ManageProfileScreen({ navigation }) {
  const route = useRoute();
  const { user, logout } = useAuth();
  const { showAlert } = useAppAlert();
  const initialProfile = route.params?.initialProfile || null;
  const toastTimeoutRef = useRef(null);
  const navigationTimeoutRef = useRef(null);
  const [profile, setProfile] = useState(initialProfile);
  const [isSecurityPickerOpen, setIsSecurityPickerOpen] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [securityForm, setSecurityForm] = useState({
    question: initialProfile?.securityQuestion || '',
    answer: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    securityAnswer: '',
  });
  const [deleteForm, setDeleteForm] = useState({
    currentPassword: '',
    securityAnswer: '',
  });
  const [touched, setTouched] = useState({
    question: false,
    answer: false,
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
    securityAnswer: false,
    deleteCurrentPassword: false,
    deleteSecurityAnswer: false,
  });
  const [sectionFeedback, setSectionFeedback] = useState({
    security: '',
    password: '',
    delete: '',
  });
  const [visibility, setVisibility] = useState({
    setupAnswer: false,
    securityAnswer: false,
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
    deleteCurrentPassword: false,
    deleteSecurityAnswer: false,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await customerAPI.getProfile();
        setProfile(data || null);
        setSecurityForm((current) => ({
          ...current,
          question: data?.securityQuestion || '',
        }));
      } catch (_) {
        // Keep screen functional with auth fallback data.
      }
    };

    load();

    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  const showSuccessToast = (message) => {
    setToastMessage(message);
    setShowToast(true);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
    }, 1800);
  };

  const getSecurityError = (field) => {
    if (field === 'question' && !securityForm.question) {
      return 'Select a security question.';
    }

    if (field === 'answer') {
      const value = securityForm.answer.trim();
      if (!value) {
        return 'Enter your security answer.';
      }
      if (value.length < 2) {
        return 'Security answer is too short.';
      }
    }

    return '';
  };

  const getPasswordError = (field) => {
    const savedQuestion = profile?.securityQuestion;

    if (field === 'currentPassword' && !passwordForm.currentPassword) {
      return 'Enter your current password.';
    }

    if (field === 'newPassword') {
      if (!passwordForm.newPassword) {
        return 'Enter a new password.';
      }
      if (
        passwordForm.currentPassword
        && passwordForm.newPassword
        && passwordForm.newPassword === passwordForm.currentPassword
      ) {
        return 'New password cannot be the same as your current password.';
      }
      if (passwordForm.newPassword.length < 8) {
        return 'New password must be at least 8 characters.';
      }
    }

    if (field === 'confirmPassword') {
      if (!passwordForm.confirmPassword) {
        return 'Confirm your new password.';
      }
      if (passwordForm.confirmPassword !== passwordForm.newPassword) {
        return 'New passwords do not match.';
      }
    }

    if (field === 'securityAnswer') {
      if (!savedQuestion) {
        return 'Save a security question first.';
      }
      if (!passwordForm.securityAnswer.trim()) {
        return 'Enter your saved security answer.';
      }
    }

    return '';
  };

  const getDeleteError = (field) => {
    const savedQuestionValue = profile?.securityQuestion || '';

    if (field === 'securityAnswer') {
      if (!savedQuestionValue) {
        return 'Save a security question first.';
      }
      if (!deleteForm.securityAnswer.trim()) {
        return 'Enter your saved security answer.';
      }
    }

    if (field === 'currentPassword' && !deleteForm.currentPassword) {
      return 'Enter your current password.';
    }

    return '';
  };

  const securityErrors = useMemo(
    () => ({
      question: getSecurityError('question'),
      answer: getSecurityError('answer'),
    }),
    [securityForm],
  );

  const passwordErrors = useMemo(
    () => ({
      currentPassword: getPasswordError('currentPassword'),
      newPassword: getPasswordError('newPassword'),
      confirmPassword: getPasswordError('confirmPassword'),
      securityAnswer: getPasswordError('securityAnswer'),
    }),
    [passwordForm, profile?.securityQuestion, securityForm.question],
  );
  const deleteErrors = useMemo(
    () => ({
      currentPassword: getDeleteError('currentPassword'),
      securityAnswer: getDeleteError('securityAnswer'),
    }),
    [deleteForm, profile?.securityQuestion],
  );

  const canSaveSecurityQuestion = !securityErrors.question && !securityErrors.answer && !isSavingQuestion;
  const canChangePassword =
    !passwordErrors.currentPassword &&
    !passwordErrors.newPassword &&
    !passwordErrors.confirmPassword &&
    !passwordErrors.securityAnswer &&
    !isChangingPassword;
  const canDeleteAccount =
    !deleteErrors.currentPassword &&
    !deleteErrors.securityAnswer &&
    !isDeletingAccount;

  const buildDeletePreviewMessage = (preview) => {
    const pendingCount = Number(preview?.counts?.pendingBookings || 0);
    const pendingMessage = pendingCount > 0
      ? `${pendingCount} pending booking${pendingCount === 1 ? '' : 's'} will be automatically marked as "Cancelled - Account Deleted".`
      : 'No pending bookings need to be cancelled.';

    return [
      pendingMessage,
      'Your login access will be disabled and your personal account details will be anonymized.',
      'Booking, payment, refund, review, and inquiry history will stay saved for business records.',
    ].join('\n\n');
  };

  const confirmDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      setSectionFeedback((current) => ({ ...current, delete: '' }));
      await customerAPI.deleteAccount({
        currentPassword: deleteForm.currentPassword,
        securityAnswer: deleteForm.securityAnswer.trim(),
      });
      await logout();
    } catch (error) {
      setSectionFeedback((current) => ({
        ...current,
        delete: error?.response?.data?.message || 'Unable to delete your account right now.',
      }));
      showAlert(
        'Delete Account Failed',
        error?.response?.data?.message || 'Unable to delete your account right now.',
        undefined,
        { tone: 'danger' },
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleSecuritySave = async () => {
    if (isSecurityQuestionLocked) {
      return;
    }

    setTouched((current) => ({
      ...current,
      question: true,
      answer: true,
    }));
    setSectionFeedback((current) => ({ ...current, security: '' }));

    if (!canSaveSecurityQuestion) {
      return;
    }

    try {
      setIsSavingQuestion(true);
      const payload = {
        securityQuestion: securityForm.question,
        securityAnswer: securityForm.answer.trim(),
      };
      const { data } = await customerAPI.updateSecurityQuestion(payload);

      setProfile((current) => ({
        ...(current || {}),
        securityQuestion: data?.securityQuestion || payload.securityQuestion,
      }));
      setSecurityForm((current) => ({
        ...current,
        answer: '',
      }));
      setTouched((current) => ({
        ...current,
        answer: false,
      }));
      setIsSecurityPickerOpen(false);
      showSuccessToast('Security question saved');
    } catch (error) {
      setSectionFeedback((current) => ({
        ...current,
        security: error?.response?.data?.message || 'Unable to save security question right now.',
      }));
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handlePasswordChange = async () => {
    setTouched((current) => ({
      ...current,
      currentPassword: true,
      newPassword: true,
      confirmPassword: true,
      securityAnswer: true,
    }));
    setSectionFeedback((current) => ({ ...current, password: '' }));

    if (!canChangePassword) {
      if (!savedQuestion) {
        setSectionFeedback((current) => ({
          ...current,
          password: 'Please select a security question and save your answer before changing password.',
        }));
      }
      return;
    }

    try {
      setIsChangingPassword(true);
      await customerAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        securityAnswer: passwordForm.securityAnswer.trim(),
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        securityAnswer: '',
      });
      setTouched((current) => ({
        ...current,
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
        securityAnswer: false,
      }));
      showSuccessToast('Password updated successfully');
      navigationTimeoutRef.current = setTimeout(() => {
        navigation.goBack();
      }, 900);
    } catch (error) {
      setSectionFeedback((current) => ({
        ...current,
        password: error?.response?.data?.message || 'Unable to change password right now.',
      }));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setTouched((current) => ({
      ...current,
      deleteCurrentPassword: true,
      deleteSecurityAnswer: true,
    }));
    setSectionFeedback((current) => ({ ...current, delete: '' }));

    if (!canDeleteAccount) {
      if (!savedQuestion) {
        setSectionFeedback((current) => ({
          ...current,
          delete: 'Please save a security question before deleting your account.',
        }));
      }
      return;
    }

    try {
      setIsDeletingAccount(true);
      const { data } = await customerAPI.previewDeleteAccount({
        currentPassword: deleteForm.currentPassword,
        securityAnswer: deleteForm.securityAnswer.trim(),
      });

      if (!data?.allowed) {
        const message = data?.message || 'Your account cannot be deleted while active booking or refund work is still open.';
        setSectionFeedback((current) => ({
          ...current,
          delete: message,
        }));
        showAlert('Account Deletion Blocked', message, undefined, { tone: 'danger' });
        return;
      }

      showAlert(
        'Confirm Account Deletion',
        buildDeletePreviewMessage(data),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Account', style: 'destructive', onPress: confirmDeleteAccount },
        ],
        { tone: 'danger' },
      );
    } catch (error) {
      setSectionFeedback((current) => ({
        ...current,
        delete: error?.response?.data?.message || 'Unable to validate account deletion right now.',
      }));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const requireSecurityAnswerFirst = () => {
    if (!savedQuestion) {
      setSectionFeedback((current) => ({
        ...current,
        password: 'Please select a security question and save your answer before changing password.',
      }));
      return false;
    }

    if (!passwordForm.securityAnswer.trim()) {
      setTouched((current) => ({
        ...current,
        securityAnswer: true,
      }));
      return false;
    }
    return true;
  };

  const handleProtectedPasswordFieldChange = (field, value) => {
    if (!requireSecurityAnswerFirst()) {
      return;
    }

    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const toggleVisibility = (key) => {
    setVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const displayedEmail = profile?.email || user?.email || 'Not available';
  const savedQuestion = profile?.securityQuestion || '';
  const isSecurityQuestionLocked = Boolean(savedQuestion);

  return (
    <View style={styles.screen}>
      <SuccessToast visible={showToast} message={toastMessage} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#111111" />
            </TouchableOpacity>
            <Text style={styles.pageTitle}>Manage Profile</Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <SectionCard
            title="Account Info"
            subtitle="Your email stays locked here so account identity remains consistent."
          >
            <FieldLabel>Email</FieldLabel>
            <View style={styles.lockedField}>
              <TextInput
                value={displayedEmail}
                editable={false}
                style={styles.lockedInput}
                placeholderTextColor="#9ca3af"
              />
              <MaterialCommunityIcons name="lock-outline" size={18} color="#6b7280" />
            </View>
          </SectionCard>

          <SectionCard
            title="Security Question Setup"
            subtitle="Choose one question and save the answer you will use for password verification."
          >
            <FieldLabel>Security Question</FieldLabel>
            <Pressable
              onPress={() => {
                if (!isSecurityQuestionLocked) {
                  setIsSecurityPickerOpen((current) => !current);
                }
              }}
              style={[
                styles.selectField,
                isSecurityQuestionLocked ? styles.lockedSelectField : null,
                touched.question && securityErrors.question ? styles.inputErrorBorder : null,
              ]}
            >
              <Text style={[styles.selectValue, !securityForm.question && styles.placeholderText]}>
                {securityForm.question || 'Select a security question'}
              </Text>
              <MaterialCommunityIcons
                name={isSecurityQuestionLocked ? 'lock-outline' : (isSecurityPickerOpen ? 'chevron-up' : 'chevron-down')}
                size={22}
                color="#6b7280"
              />
            </Pressable>
            <FieldError message={touched.question ? securityErrors.question : ''} />

            {!isSecurityQuestionLocked && isSecurityPickerOpen ? (
              <View style={styles.optionList}>
                {SECURITY_QUESTIONS.map((question) => {
                  const isSelected = securityForm.question === question;

                  return (
                    <Pressable
                      key={question}
                      onPress={() => {
                        setSecurityForm((current) => ({ ...current, question }));
                        setTouched((current) => ({ ...current, question: true }));
                        setIsSecurityPickerOpen(false);
                      }}
                      style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                    >
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                        {question}
                      </Text>
                      {isSelected ? (
                        <MaterialCommunityIcons name="check-circle" size={20} color="#111111" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <FieldLabel>Answer</FieldLabel>
            <IconInput
              icon="shield-key-outline"
              value={securityForm.answer}
              onChangeText={(value) => setSecurityForm((current) => ({ ...current, answer: value }))}
              onBlur={() => setTouched((current) => ({ ...current, answer: true }))}
              placeholder={isSecurityQuestionLocked ? 'Saved and locked' : 'Enter your answer'}
              placeholderTextColor="#9ca3af"
              editable={!isSecurityQuestionLocked}
              secureTextEntry
              isVisible={visibility.setupAnswer}
              onToggleVisibility={() => toggleVisibility('setupAnswer')}
              containerStyle={[
                styles.textInput,
                isSecurityQuestionLocked ? styles.lockedInputSurface : null,
                touched.answer && securityErrors.answer ? styles.inputErrorBorder : null,
              ]}
            />
            <FieldError message={!isSecurityQuestionLocked && touched.answer ? securityErrors.answer : ''} />

            {savedQuestion ? (
              <Text style={styles.helperText}>
                Saved question is locked for security. You can use this same answer when changing your password.
              </Text>
            ) : null}
            {sectionFeedback.security ? (
              <Text style={styles.sectionError}>{sectionFeedback.security}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!canSaveSecurityQuestion || isSecurityQuestionLocked) && styles.buttonDisabled,
              ]}
              onPress={handleSecuritySave}
              disabled={!canSaveSecurityQuestion || isSecurityQuestionLocked}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryButtonText}>
                {isSecurityQuestionLocked
                  ? 'Security Question Locked'
                  : (isSavingQuestion ? 'Saving...' : 'Save Security Question')}
              </Text>
            </TouchableOpacity>
          </SectionCard>

          <SectionCard
            title="Change Password"
            subtitle="Confirm your current password and your saved security answer before updating."
          >
            <FieldLabel>Your Security Question</FieldLabel>
            <View style={styles.lockedField}>
              <TextInput
                value={savedQuestion || 'No security question saved yet'}
                editable={false}
                style={styles.lockedInput}
                placeholderTextColor="#9ca3af"
              />
              <MaterialCommunityIcons name="shield-check-outline" size={18} color="#6b7280" />
            </View>

            <FieldLabel>Security Answer</FieldLabel>
            <IconInput
              icon="shield-key-outline"
              value={passwordForm.securityAnswer}
              onChangeText={(value) => {
                setTouched((current) => ({ ...current, securityAnswer: true }));
                setPasswordForm((current) => ({ ...current, securityAnswer: value }));
              }}
              onBlur={() => setTouched((current) => ({ ...current, securityAnswer: true }))}
              placeholder={savedQuestion ? 'Enter saved answer' : 'Save a question first'}
              placeholderTextColor="#9ca3af"
              secureTextEntry
              isVisible={visibility.securityAnswer}
              onToggleVisibility={() => toggleVisibility('securityAnswer')}
              editable={Boolean(savedQuestion)}
              containerStyle={[
                styles.textInput,
                !savedQuestion ? styles.lockedInputSurface : null,
                touched.securityAnswer && passwordErrors.securityAnswer ? styles.inputErrorBorder : null,
              ]}
            />
            <FieldError message={touched.securityAnswer ? passwordErrors.securityAnswer : ''} />

            <FieldLabel>Current Password</FieldLabel>
            <IconInput
              icon="lock-outline"
              value={passwordForm.currentPassword}
              onFocus={requireSecurityAnswerFirst}
              onChangeText={(value) => handleProtectedPasswordFieldChange('currentPassword', value)}
              onBlur={() => setTouched((current) => ({ ...current, currentPassword: true }))}
              placeholder="Enter current password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              isVisible={visibility.currentPassword}
              onToggleVisibility={() => toggleVisibility('currentPassword')}
              containerStyle={[
                styles.textInput,
                touched.currentPassword && passwordErrors.currentPassword ? styles.inputErrorBorder : null,
              ]}
            />
            <FieldError message={touched.currentPassword ? passwordErrors.currentPassword : ''} />

            <FieldLabel>New Password</FieldLabel>
            <IconInput
              icon="form-textbox-password"
              value={passwordForm.newPassword}
              onFocus={requireSecurityAnswerFirst}
              onChangeText={(value) => handleProtectedPasswordFieldChange('newPassword', value)}
              onBlur={() => setTouched((current) => ({ ...current, newPassword: true }))}
              placeholder="At least 8 characters"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              isVisible={visibility.newPassword}
              onToggleVisibility={() => toggleVisibility('newPassword')}
              containerStyle={[
                styles.textInput,
                touched.newPassword && passwordErrors.newPassword ? styles.inputErrorBorder : null,
              ]}
            />
            <FieldError message={touched.newPassword ? passwordErrors.newPassword : ''} />

            <FieldLabel>Confirm New Password</FieldLabel>
            <IconInput
              icon="check-decagram-outline"
              value={passwordForm.confirmPassword}
              onFocus={requireSecurityAnswerFirst}
              onChangeText={(value) => handleProtectedPasswordFieldChange('confirmPassword', value)}
              onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
              placeholder="Re-enter new password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              isVisible={visibility.confirmPassword}
              onToggleVisibility={() => toggleVisibility('confirmPassword')}
              containerStyle={[
                styles.textInput,
                touched.confirmPassword && passwordErrors.confirmPassword ? styles.inputErrorBorder : null,
              ]}
            />
            <FieldError message={touched.confirmPassword ? passwordErrors.confirmPassword : ''} />

            {sectionFeedback.password ? (
              <Text style={styles.sectionError}>{sectionFeedback.password}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.accentButton, !canChangePassword && styles.buttonDisabled]}
              onPress={handlePasswordChange}
              disabled={!canChangePassword}
              activeOpacity={0.9}
            >
              <Text style={styles.accentButtonText}>
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </Text>
            </TouchableOpacity>
          </SectionCard>

          <SectionCard
            title="Delete Account"
            subtitle="Verify your security answer and current password before closing your account."
          >
            <View style={styles.deleteAlertCard}>
              <View style={styles.deleteAlertBadge}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#b91c1c" />
                <Text style={styles.deleteAlertBadgeText}>Account closure</Text>
              </View>
              <Text style={styles.deleteAlertTitle}>Important records will stay saved</Text>
              <Text style={styles.deleteAlertCopy}>
                Your login access will be disabled and personal details will be anonymized. Booking, payment,
                refund, review, and inquiry history remains preserved for business records.
              </Text>
            </View>

            <FieldLabel>Your Security Question</FieldLabel>
            <View style={[styles.lockedField, styles.deleteLockedField]}>
              <TextInput
                value={savedQuestion || 'No security question saved yet'}
                editable={false}
                style={styles.lockedInput}
                placeholderTextColor="#9ca3af"
              />
              <MaterialCommunityIcons name="shield-alert-outline" size={18} color="#b91c1c" />
            </View>

            <FieldLabel>Security Answer</FieldLabel>
            <IconInput
              icon="shield-key-outline"
              value={deleteForm.securityAnswer}
              onChangeText={(value) => setDeleteForm((current) => ({ ...current, securityAnswer: value }))}
              onBlur={() => setTouched((current) => ({ ...current, deleteSecurityAnswer: true }))}
              placeholder={savedQuestion ? 'Enter saved answer' : 'Save a question first'}
              placeholderTextColor="#9ca3af"
              secureTextEntry
              isVisible={visibility.deleteSecurityAnswer}
              onToggleVisibility={() => toggleVisibility('deleteSecurityAnswer')}
              editable={Boolean(savedQuestion)}
              containerStyle={[
                styles.textInput,
                styles.deleteInputSurface,
                !savedQuestion ? styles.lockedInputSurface : null,
                touched.deleteSecurityAnswer && deleteErrors.securityAnswer ? styles.inputErrorBorder : null,
              ]}
            />
            <FieldError message={touched.deleteSecurityAnswer ? deleteErrors.securityAnswer : ''} />

            <FieldLabel>Current Password</FieldLabel>
            <IconInput
              icon="lock-outline"
              value={deleteForm.currentPassword}
              onChangeText={(value) => setDeleteForm((current) => ({ ...current, currentPassword: value }))}
              onBlur={() => setTouched((current) => ({ ...current, deleteCurrentPassword: true }))}
              placeholder="Enter current password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              isVisible={visibility.deleteCurrentPassword}
              onToggleVisibility={() => toggleVisibility('deleteCurrentPassword')}
              containerStyle={[
                styles.textInput,
                styles.deleteInputSurface,
                touched.deleteCurrentPassword && deleteErrors.currentPassword ? styles.inputErrorBorder : null,
              ]}
            />
            <FieldError message={touched.deleteCurrentPassword ? deleteErrors.currentPassword : ''} />

            {sectionFeedback.delete ? (
              <Text style={styles.sectionError}>{sectionFeedback.delete}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.deleteButton, !canDeleteAccount && styles.buttonDisabled]}
              onPress={handleDeleteAccount}
              disabled={!canDeleteAccount}
              activeOpacity={0.9}
            >
              <Text style={styles.deleteButtonText}>
                {isDeletingAccount ? 'Checking Account...' : 'Delete My Account'}
              </Text>
            </TouchableOpacity>
          </SectionCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 54,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  sectionWrap: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.6,
  },
  sectionSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: '#6b7280',
  },
  sectionCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#edf2f7',
    ...Shadow.sm,
  },
  fieldLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  lockedField: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedSelectField: {
    backgroundColor: '#f9fafb',
  },
  lockedInput: {
    flex: 1,
    fontSize: 16,
    color: '#6b7280',
    paddingVertical: 16,
  },
  lockedInputSurface: {
    backgroundColor: '#f9fafb',
    color: '#6b7280',
  },
  deleteLockedField: {
    borderColor: '#fecaca',
    backgroundColor: '#fff7f7',
  },
  textInput: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111111',
    backgroundColor: '#FFFFFF',
  },
  deleteInputSurface: {
    borderColor: '#fecaca',
    backgroundColor: '#fff7f7',
  },
  iconInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconInputIcon: {
    marginRight: 12,
  },
  iconInputField: {
    flex: 1,
    fontSize: 16,
    color: '#111111',
    paddingVertical: 16,
  },
  visibilityButton: {
    marginLeft: 12,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectField: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  selectValue: {
    flex: 1,
    fontSize: 16,
    color: '#111111',
    paddingRight: 12,
  },
  placeholderText: {
    color: '#9ca3af',
  },
  optionList: {
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  optionRow: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionRowSelected: {
    backgroundColor: '#f9fafb',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
    paddingRight: 10,
  },
  optionTextSelected: {
    fontWeight: '700',
  },
  inputErrorBorder: {
    borderColor: Colors.danger,
  },
  fieldError: {
    marginTop: 6,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger,
  },
  helperText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#6b7280',
  },
  sectionError: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.danger,
    fontWeight: '600',
  },
  deleteAlertCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteAlertBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
  },
  deleteAlertBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#b91c1c',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  deleteAlertTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '900',
    color: '#7f1d1d',
    letterSpacing: -0.4,
  },
  deleteAlertCopy: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#7f1d1d',
  },
  primaryButton: {
    marginTop: 18,
    height: 52,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  accentButton: {
    marginTop: 18,
    height: 54,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe500',
  },
  accentButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },
  deleteButton: {
    marginTop: 18,
    height: 52,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b91c1c',
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
