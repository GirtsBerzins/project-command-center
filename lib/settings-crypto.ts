import { createCipheriv, createHash, randomBytes } from "crypto"

const ENCRYPTION_PREFIX = "enc:v1:"

function getKeyMaterial() {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY?.trim()
  if (!raw) return null
  return createHash("sha256").update(raw).digest()
}

export function isSettingsEncryptionEnabled() {
  return !!getKeyMaterial()
}

export function encryptSettingValue(plainText: string) {
  const key = getKeyMaterial()
  if (!key) return plainText

  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${ENCRYPTION_PREFIX}${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`
}
