/**
 * Persists registration progress to localStorage.
 * This prevents losing leadId/step when user refreshes or navigates.
 */

const STORAGE_KEY = "contabilia-registration";

export interface RegistrationProgress {
  leadId: string | null;
  currentStep: number;
  leadData?: {
    nome: string;
    email: string;
    telefone: string;
  };
}

export function saveRegistrationProgress(progress: RegistrationProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // localStorage not available
  }
}

export function loadRegistrationProgress(): RegistrationProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RegistrationProgress;
  } catch {
    return null;
  }
}

export function clearRegistrationProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage not available
  }
}
