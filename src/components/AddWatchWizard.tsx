/**
 * src/components/AddWatchWizard.tsx
 *
 * DEPRECATED — This component is no longer used.
 * The Smart Watch add/edit flow is now handled entirely within
 * WatchManagement.tsx via the inline WatchFormModal (flat Camera-style form).
 *
 * This file is retained as a placeholder to avoid breaking any future
 * references, but the component returns null and does nothing.
 */

export interface AddWatchWizardProps {
  onSave?: (...args: unknown[]) => unknown;
  onClose?: () => void;
  saving?: boolean;
}

export function AddWatchWizard(_props?: AddWatchWizardProps): null {
  void _props;
  return null;
}
