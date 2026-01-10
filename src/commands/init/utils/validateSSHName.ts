type ValidationResult = { isValid: boolean; error?: string };
type ValidatorFn = (value: string) => ValidationResult;

/**
 * Reserved words that match exactly (Full match)
 */
const FORBIDDEN_WORDS = [
  "user",
  "admin",
  "root",
  "administrator",
  "sover",
  "guest",
  "password",
  "ubuntu",
  "debian",
  "proxmox",
];

/**
 * Dangerous patterns (Substring match)
 * Rejects names like "admin-sover" or "test-user"
 */
const DANGEROUS_ROOTS = [
  "admin",
  "root",
  "user",
  "guest",
  "password",
  "sover",
  "svstack",
  "master",
  "slave",
  "test",
];

const isNotTrivial = (username: string): ValidationResult => {
  const normalized = username.toLowerCase().trim();
  if (FORBIDDEN_WORDS.includes(normalized)) {
    return {
      isValid: false,
      error: `"${username}" is a reserved system name and cannot be used for security reasons.`,
    };
  }
  return { isValid: true };
};

const hasValidFormat = (username: string): ValidationResult => {
  // Linux compatible: starts with letter/underscore, lowercase, numbers, '-' or '_'
  // Max length 32 chars
  const regex = /^[a-z_][a-z0-9_-]{2,31}$/;

  if (!regex.test(username)) {
    return {
      isValid: false,
      error: "Username must start with a letter and contain only lowercase, numbers, '-' or '_'.",
    };
  }
  return { isValid: true };
};

const isNotTooSimilarToForbidden = (username: string): ValidationResult => {
  const normalized = username.toLowerCase().trim();
  const foundForbidden = DANGEROUS_ROOTS.find((forbidden) => normalized.includes(forbidden));

  if (foundForbidden) {
    return {
      isValid: false,
      error: `Security risk: Username contains a forbidden keyword ("${foundForbidden}").`,
    };
  }
  return { isValid: true };
};

const isNotGeneric = (username: string): ValidationResult => {
  if (/^\d+$/.test(username)) {
    return {
      isValid: false,
      error: "Username cannot be composed only of numbers.",
    };
  }
  return { isValid: true };
};

/**
 * Functional Validator
 * Returns null if valid, or a ValidationResult object with the error message
 */
export const validateSshUsername = (username: string): ValidationResult | null => {
  const validators: ValidatorFn[] = [
    (val) =>
      val.length < 4
        ? { isValid: false, error: "Username is too short (min 4 characters)." }
        : { isValid: true },
    isNotTrivial,
    isNotTooSimilarToForbidden,
    isNotGeneric,
    hasValidFormat,
  ];

  for (const validator of validators) {
    const res = validator(username);
    if (!res.isValid) return res;
  }

  return null;
};
