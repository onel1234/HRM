export function normalizeNic(value?: string): string | undefined {
  if (!value) return undefined;
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

export function normalizePassport(value?: string): string | undefined {
  if (!value) return undefined;
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

export function isSriLankanNic(value: string): boolean {
  const nic = normalizeNic(value);
  if (!nic) return false;
  return /^\d{9}[VX]$/.test(nic) || /^\d{12}$/.test(nic);
}
