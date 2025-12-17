/**
 * Validates a Brazilian CPF number using the official algorithm
 * @param cpf - CPF string (with or without formatting)
 * @returns true if valid, false otherwise
 */
export function validateCpf(cpf: string): boolean {
  // Remove non-numeric characters
  const cleanCpf = cpf.replace(/\D/g, "");

  // Must have 11 digits
  if (cleanCpf.length !== 11) {
    return false;
  }

  // Reject known invalid patterns (all same digits)
  if (/^(\d)\1{10}$/.test(cleanCpf)) {
    return false;
  }

  // Calculate first verification digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanCpf.charAt(9))) {
    return false;
  }

  // Calculate second verification digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanCpf.charAt(10))) {
    return false;
  }

  return true;
}

/**
 * Formats a CPF string to the standard format (000.000.000-00)
 * @param cpf - CPF string (numbers only or partially formatted)
 * @returns Formatted CPF string
 */
export function formatCpf(value: string): string {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9)
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
}
