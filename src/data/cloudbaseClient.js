import cloudbase from "@cloudbase/js-sdk";

const cloudbaseEnvId = import.meta.env.VITE_CLOUDBASE_ENV_ID;

let cloudbaseApp = null;
let cloudbaseAuth = null;

export const isCloudBaseConfigured = Boolean(cloudbaseEnvId);

if (!isCloudBaseConfigured) {
  console.warn(
    "CloudBase env var VITE_CLOUDBASE_ENV_ID is missing; cloud sync is using localStorage fallback."
  );
}

export function getCloudBaseEnvId() {
  return cloudbaseEnvId || "";
}

export function getCloudBaseApp() {
  if (!isCloudBaseConfigured) return null;
  if (cloudbaseApp) return cloudbaseApp;

  try {
    cloudbaseApp = cloudbase.init({
      env: cloudbaseEnvId,
      timeout: 15000,
    });

    return cloudbaseApp;
  } catch (error) {
    console.warn("CloudBase init failed; using localStorage fallback.", error);
    return null;
  }
}

export function getCloudBaseAuth() {
  if (cloudbaseAuth) return cloudbaseAuth;

  const app = getCloudBaseApp();
  if (!app) return null;

  try {
    cloudbaseAuth = app.auth({
      persistence: "local",
    });

    return cloudbaseAuth;
  } catch (error) {
    console.warn("CloudBase Auth init failed.", error);
    return null;
  }
}

export function getCloudBaseDb() {
  const app = getCloudBaseApp();
  if (!app) return null;

  try {
    return app.database();
  } catch (error) {
    console.warn("CloudBase database init failed.", error);
    return null;
  }
}

function normalizeCloudBaseUser(user) {
  if (!user) return null;

  const id =
    user.id ||
    user.sub ||
    user.uid ||
    user.user_id ||
    user.openid ||
    user.customUserId ||
    user.email ||
    user.username ||
    "";

  if (!id) return null;

  return {
    id,
    user_id: id,
    uid: user.uid || user.id || user.sub || id,
    email: user.email || user.username || user.user_metadata?.email || "",
    provider: "cloudbase",
    raw: user,
  };
}

function normalizeSignInResult(result) {
  const user =
    result?.data?.user ||
    result?.data?.session?.user ||
    result?.data?.session ||
    result?.user ||
    result?.loginState?.user ||
    result?.state?.user ||
    null;

  return normalizeCloudBaseUser(user);
}

function getAuthErrorMessage(error, fallbackMessage) {
  if (!error) return fallbackMessage;

  return (
    error.message ||
    error.error_description ||
    error.loginMethodHint ||
    error.helpMessage ||
    error.category ||
    fallbackMessage
  );
}

function assertCloudBaseAuthSuccess(result, fallbackMessage) {
  const authError = result?.error || result?.data?.error;

  if (authError) {
    const error = new Error(getAuthErrorMessage(authError, fallbackMessage));
    error.cause = authError;
    error.cloudbaseError = authError;
    throw error;
  }

  return result;
}

export async function getCloudBaseCurrentUser() {
  const auth = getCloudBaseAuth();
  if (!auth) return null;

  try {
    const loginState = auth.hasLoginState?.() || (await auth.getLoginState?.());
    const currentUser = auth.getCurrentUser
      ? await auth.getCurrentUser(false)
      : auth.currentUser;

    return normalizeCloudBaseUser(loginState?.user || currentUser || auth.currentUser || null);
  } catch (error) {
    console.warn("Failed to read CloudBase login state.", error);
    return null;
  }
}

export async function signUpCloudBaseWithEmail(email, password) {
  const auth = getCloudBaseAuth();
  if (!auth) {
    throw new Error("CloudBase is not configured; cannot sign up.");
  }

  const result = auth.signUp
    ? await auth.signUp({ email, password })
    : await auth.signUpWithEmailAndPassword(email, password);

  assertCloudBaseAuthSuccess(result, "CloudBase sign up failed.");

  return normalizeSignInResult(result) || (await getCloudBaseCurrentUser());
}

export async function signInCloudBaseWithEmail(email, password) {
  const auth = getCloudBaseAuth();
  if (!auth) {
    throw new Error("CloudBase is not configured; cannot sign in.");
  }

  const result = auth.signInWithPassword
    ? await auth.signInWithPassword({ email, password })
    : await auth.signInWithEmailAndPassword(email, password);

  assertCloudBaseAuthSuccess(result, "CloudBase sign in failed.");

  return normalizeSignInResult(result) || (await getCloudBaseCurrentUser());
}

export async function signInCloudBaseAnonymously() {
  const auth = getCloudBaseAuth();
  if (!auth?.signInAnonymously) {
    throw new Error("CloudBase is not configured or anonymous sign in is unavailable.");
  }

  const result = await auth.signInAnonymously({});

  assertCloudBaseAuthSuccess(result, "CloudBase anonymous sign in failed.");

  return normalizeSignInResult(result) || (await getCloudBaseCurrentUser());
}

export async function signOutCloudBase() {
  const auth = getCloudBaseAuth();
  if (!auth) return;

  await auth.signOut();
}

export function onCloudBaseAuthStateChange(callback) {
  const auth = getCloudBaseAuth();
  if (!auth?.onAuthStateChange) {
    return () => {};
  }

  const {
    data: { subscription },
  } = auth.onAuthStateChange(async () => {
    callback(await getCloudBaseCurrentUser());
  });

  return () => subscription.unsubscribe();
}
