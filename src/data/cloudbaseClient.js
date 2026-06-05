import cloudbase from "@cloudbase/js-sdk/app";
import "@cloudbase/js-sdk/auth";
import "@cloudbase/js-sdk/database";

const cloudbaseEnvId = import.meta.env.VITE_CLOUDBASE_ENV_ID;

let cloudbaseApp = null;
let cloudbaseAuth = null;
let cloudbaseDb = null;

export const isCloudBaseConfigured = Boolean(cloudbaseEnvId);

if (!isCloudBaseConfigured) {
  console.warn("CloudBase 环境变量 VITE_CLOUDBASE_ENV_ID 缺失，云同步已降级为本机数据");
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
    console.warn("CloudBase 初始化失败，云同步已降级为本机数据", error);
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
    console.warn("CloudBase Auth 初始化失败", error);
    return null;
  }
}

export function getCloudBaseDb() {
  if (cloudbaseDb) return cloudbaseDb;

  const app = getCloudBaseApp();
  if (!app) return null;

  try {
    cloudbaseDb = app.database();
    return cloudbaseDb;
  } catch (error) {
    console.warn("CloudBase 数据库初始化失败", error);
    return null;
  }
}

function normalizeCloudBaseUser(user) {
  if (!user) return null;

  const id =
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
    uid: user.uid || id,
    email: user.email || user.username || "",
    provider: "cloudbase",
    raw: user,
  };
}

function normalizeSignInResult(result) {
  const user =
    result?.data?.user ||
    result?.user ||
    result?.loginState?.user ||
    result?.state?.user ||
    null;

  return normalizeCloudBaseUser(user);
}

export async function getCloudBaseCurrentUser() {
  const auth = getCloudBaseAuth();
  if (!auth) return null;

  try {
    const loginState = auth.hasLoginState?.() || (await auth.getLoginState?.());
    return normalizeCloudBaseUser(loginState?.user || auth.currentUser || null);
  } catch (error) {
    console.warn("读取 CloudBase 登录状态失败", error);
    return null;
  }
}

export async function signUpCloudBaseWithEmail(email, password) {
  const auth = getCloudBaseAuth();
  if (!auth) {
    throw new Error("CloudBase 未配置，无法注册账号");
  }

  const result = auth.signUpWithEmailAndPassword
    ? await auth.signUpWithEmailAndPassword(email, password)
    : await auth.signUp({ email, password });

  return normalizeSignInResult(result) || (await getCloudBaseCurrentUser());
}

export async function signInCloudBaseWithEmail(email, password) {
  const auth = getCloudBaseAuth();
  if (!auth) {
    throw new Error("CloudBase 未配置，无法登录账号");
  }

  const result = auth.signInWithPassword
    ? await auth.signInWithPassword({ email, password })
    : await auth.signInWithEmailAndPassword(email, password);

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
