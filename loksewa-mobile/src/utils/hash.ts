/**
 * SHA-256 hex digest that works on-device (expo-crypto) and under Node/vitest
 * (globalThis.crypto.subtle). expo-crypto is imported lazily so importing this
 * module never pulls native modules into a unit-test environment.
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);

  try {
    const mod = await import('expo-crypto');
    return await mod.digestStringAsync(mod.CryptoDigestAlgorithm.SHA256, input);
  } catch (error) {
    // Node / test fallback using WebCrypto when expo-crypto is unavailable.
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw error;
    const hashBuffer = await subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}