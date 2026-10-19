const TOKEN_KEY = "sovann.token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember: boolean) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

const EMAIL_KEY = "sovann.email";

export function readSavedEmail() {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

export function saveEmail(email: string, remember: boolean) {
  try {
    if (remember) localStorage.setItem(EMAIL_KEY, email);
    else localStorage.removeItem(EMAIL_KEY);
  } catch {
    /* storage blocked */
  }
}

export function saveProductImage(id: string, dataUrl: string) {
  try {
    localStorage.setItem(`productImage:${id}`, dataUrl);
  } catch {
    /* quota */
  }
}

export function readProductImage(id: string, fallback?: string | null) {
  if (typeof window === "undefined") return fallback || "";
  try {
    return localStorage.getItem(`productImage:${id}`) || fallback || "";
  } catch {
    return fallback || "";
  }
}

const UNREADABLE_IMAGE = "Could not read that image. Use a JPG, PNG or WebP file.";

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(UNREADABLE_IMAGE));
    reader.onload = () => {
      const original = String(reader.result || "");
      const image = new Image();
      image.onload = () => {
        const max = 480;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error(UNREADABLE_IMAGE));
          return;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      // Never fall back to the original file: full-size photos exceed the server's request limit.
      image.onerror = () => reject(new Error(UNREADABLE_IMAGE));
      image.src = original;
    };
    reader.readAsDataURL(file);
  });
}
