import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setError('Firebase Auth is not configured.');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setLoading(true);
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await getUserProfile(nextUser.uid);
        if (!nextProfile) {
          setError('User profile is missing. Complete signup or ask an admin to create your access.');
          setProfile(null);
        } else {
          setProfile(nextProfile);
          setError(null);
        }
      } catch (profileError) {
        setError(formatFirebaseError(profileError));
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const runAuthAction = async (action: () => Promise<AppUserProfile | void>) => {
    setError(null);
    setLoading(true);
    try {
      const result = await action();
      if (result) {
        setProfile(result);
      }
    } catch (authError) {
      setError(formatFirebaseError(authError));
      throw authError;
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
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
      logout: async () => {
        await signOutUser();
        setProfile(null);
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
