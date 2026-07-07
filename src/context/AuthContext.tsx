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
  signInWithEmail,
  signInWithGoogleAccount,
  signOutUser,
  signUpWithEmail,
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
    elderId: string;
  }) => Promise<void>;
  signInWithGoogle: (input: { role: UserRole; elderId: string; fullName?: string }) => Promise<void>;
  enableGuestMode: () => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const GUEST_PROFILE: AppUserProfile = {
  uid: 'guest-user',
  fullName: 'Guest Admin',
  email: 'guest@vitalcare.local',
  role: 'admin',
  elderId: 'demo-resident',
  authProvider: 'password',
  createdAt: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  
  // Start with guest profile immediately to skip loading screens
  const [profile, setProfile] = useState<AppUserProfile | null>(() => {
    const cached = window.localStorage.getItem('eldercare-guest-session');
    return cached ? JSON.parse(cached) : GUEST_PROFILE;
  });

  const [initializing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profileRef = useRef<AppUserProfile | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        // Stay as guest or cached guest
        return;
      }

      try {
        const nextProfile = await getUserProfile(nextUser.uid);
        if (nextProfile) {
          setProfile(nextProfile);
          setError(null);
        }
      } catch (profileError) {
        console.error('Profile sync error:', profileError);
      }
    });

    return unsubscribe;
  }, []);

  const runAuthAction = async (action: () => Promise<any>) => {
    setError(null);
    setLoading(true);
    try {
      await action();
      // We don't set loading to false here, because onAuthStateChanged will handle it.
      // This prevents the "loading flicker" or premature loading=false.
    } catch (authError) {
      setError(formatFirebaseError(authError));
      setLoading(false); // Only set loading to false if there was an error, as onAuthStateChanged won't fire.
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
        await runAuthAction(() => signUpWithEmail(input));
      },
      signInWithGoogle: async (input) => {
        await runAuthAction(() => signInWithGoogleAccount(input));
      },
      enableGuestMode: () => {
        const guestProfile: AppUserProfile = {
          uid: 'guest-user',
          fullName: 'Guest Admin',
          email: 'guest@vitalcare.local',
          role: 'admin',
          elderId: 'demo-resident',
          authProvider: 'password',
          createdAt: new Date().toISOString(),
        };
        setProfile(guestProfile);
        window.localStorage.setItem('eldercare-guest-session', JSON.stringify(guestProfile));
      },
      logout: async () => {
        await signOutUser();
        setProfile(null);
        window.localStorage.removeItem('eldercare-guest-session');
      },
      clearError: () => setError(null),
    }),
    [user, profile, loading, error],
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
