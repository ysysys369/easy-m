// ============================================================================
// קישורים משפטיים
// ============================================================================
// הגדרות ה-URL הפעילות נמצאות ב-config/appConfig.ts (TERMS_URL, PRIVACY_URL).
// קובץ זה מספק חלופה עם תמיכה ב-EXPO_PUBLIC_ env vars.
// עדכן את הקישורים לפני הפצה לחנויות.

export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ||
  'https://docs.google.com/document/d/12NuX5iPw1qVLcbe3_XVPiVseot2YxiXgiSn7vJq--CE/edit?usp=sharing';

export const TERMS_OF_SERVICE_URL =
  process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL ||
  'https://docs.google.com/document/d/1MItfjzwqCUCRHeyggID3fvmNE1NvP6JNk_igNM9gozo/edit?usp=sharing';
