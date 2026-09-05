import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  formatFirebaseError,
  getUserProfile,
  saveProfileForCurrentUser,
  signInWithEmail,
  signInWithGoogleAccount,
  signOutUser,
  signUpWithEmail,
  updateUserProfile,
  type EditableProfileFields,
} from '../lib/userStore';
import type { AppUserProfile, UserRole } from '../types/auth';

interface AuthContextValue {
  user: User | null;
  profile: AppUserProfile | null;
  role: UserRole | null;
  loading: boolean;
  initializing: boolean;
  error: string | null;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signUp: (input: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
    elderId?: string;
  }) => Promise<void>;
  signInWithGoogle: (input: { role: UserRole; elderId?: string; fullName?: string }) => Promise<void>;

  updateProfile: (updates: Partial<EditableProfileFields>) => Promise<void>;
  enableGuestMode: (role?: UserRole) => void;

  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);



export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // FIX 1: Start as null — no auto-guest. Login page will be shown.
  const [profile, setProfile] = useState<AppUserProfile | null>(null);

  // FIX 2: Start as true so we wait for Firebase to restore session before routing.
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profileRef = useRef<AppUserProfile | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!auth) {
      setInitializing(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        const cached = window.localStorage.getItem('eldercare-guest-session');
        if (cached) {
          try {
            setProfile(JSON.parse(cached) as AppUserProfile);
          } catch {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
        setInitializing(false);
        setLoading(false);
        return;
      }

      // Real Firebase user — load their profile from Firestore
      try {
        const nextProfile = await getUserProfile(nextUser.uid);
        if (nextProfile) {
          setProfile(nextProfile);
          window.localStorage.removeItem('eldercare-guest-session');
        } else {
          // Auth user exists but no Firestore profile yet (mid-signup flow)
          setProfile(null);
        }
        // Only clear error on successful profile load
        setError(null);
      } catch (profileError: any) {
        // Firestore permissions error — show it clearly to the user
        const msg: string = profileError?.message ?? String(profileError);
        if (msg.includes('permission') || msg.includes('insufficient')) {
          setError(
            '⚠️ Firestore rules not deployed. Go to Firebase Console → Firestore → Rules and publish the rules. See console for details.'
          );
        }
        console.error('[Auth] Profile load failed:', profileError);
        setProfile(null);
      } finally {
        setInitializing(false);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const runAuthAction = async (action: () => Promise<any>) => {
    setError(null);
    setLoading(true);
    try {
      await action();
      // loading will be reset by onAuthStateChanged's finally block on success
    } catch (authError) {
      setError(formatFirebaseError(authError));
      // FIX 3: Reset loading on error (onAuthStateChanged won't fire on failed auth)
      setLoading(false);
      throw authError;
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      initializing,
      error,
      signIn: async (input) => {
        await runAuthAction(() => signInWithEmail(input));
      },
      signUp: async (input) => {
        if (user) {
          // User already authenticated (e.g. Google sign-in) — just save their profile
          setError(null);
          setLoading(true);
          try {
            const newProfile = await saveProfileForCurrentUser(user, input);
            setProfile(newProfile);
            window.localStorage.removeItem('eldercare-guest-session');
          } catch (err) {
            setError(formatFirebaseError(err));
          } finally {
            setLoading(false);
          }
        } else {
          // New email/password account
          await runAuthAction(() => signUpWithEmail(input));
        }
      },
      signInWithGoogle: async (input) => {
        await runAuthAction(() => signInWithGoogleAccount(input));
      },
      enableGuestMode: (guestRole: UserRole = 'admin') => {
        const guestProfile: AppUserProfile = {
          uid: `guest-${guestRole}`,
          fullName: `Guest ${guestRole.charAt(0).toUpperCase() + guestRole.slice(1)}`,
          email: `guest-${guestRole}@vitalcare.local`,
          role: guestRole,
          elderId: guestRole === 'elder' ? 'ELD-7K4P92' : undefined,
          linkedElderIds: guestRole === 'caregiver' ? ['ELD-7K4P92'] : undefined,
          authProvider: 'password',
          createdAt: new Date().toISOString(),
        };
        setProfile(guestProfile);
        window.localStorage.setItem('eldercare-guest-session', JSON.stringify(guestProfile));
      },

      updateProfile: async (updates) => {
        if (!profile) return;
        setLoading(true);
        setError(null);
        try {
          const updated = await updateUserProfile(profile, updates);
          setProfile(updated);
        } catch (err) {
          setError(formatFirebaseError(err));
        } finally {
          setLoading(false);
        }
      },
      logout: async () => {
        await signOutUser();
        setProfile(null);
        setUser(null);
        window.localStorage.removeItem('eldercare-guest-session');
      },
      clearError: () => setError(null),
    }),
    [user, profile, loading, initializing, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
