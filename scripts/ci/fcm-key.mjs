// Загружает ключ FCM V1 (сервисный аккаунт Firebase) в Expo для пушей на Android.
// Берёт JSON из секрета FCM_SERVICE_ACCOUNT_JSON и токен EXPO_TOKEN. Ключ не печатается в журнал.
const PROJECT = '@rilyton/ryadom';
const PACKAGE = 'kz.ryadom.app';
const token = process.env.EXPO_TOKEN;
const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
if (!token) throw new Error('Нет секрета EXPO_TOKEN');
if (!raw) throw new Error('Нет секрета FCM_SERVICE_ACCOUNT_JSON');
let key;
try { key = JSON.parse(raw); } catch { throw new Error('FCM_SERVICE_ACCOUNT_JSON — не JSON. Вставь файл целиком, от { до }'); }
if (key.type !== 'service_account' || !key.private_key || !key.client_email) throw new Error('Это не ключ сервисного аккаунта (нужен файл из Firebase → Сервисные аккаунты → Создать закрытый ключ)');
if (key.project_id !== 'ryadom-17ea3') console.warn(`Внимание: ключ от проекта ${key.project_id}, а google-services.json — от ryadom-17ea3`);

async function gql(query, variables) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map(e => e.message).join('; '));
  return body.data;
}

const { app } = await gql(`query($name: String!, $pkg: String) { app { byFullName(fullName: $name) {
  id ownerAccount { id name }
  androidAppCredentials(filter: { applicationIdentifier: $pkg }) { id googleServiceAccountKeyForFcmV1 { id clientEmail } }
} } }`, { name: PROJECT, pkg: PACKAGE });
const project = app.byFullName;
console.log(`Проект ${PROJECT}, владелец ${project.ownerAccount.name}`);
let creds = project.androidAppCredentials[0];
const old = creds?.googleServiceAccountKeyForFcmV1;
if (old?.clientEmail === key.client_email) { console.log(`Ключ ${old.clientEmail} уже подключён — ничего делать не нужно`); process.exit(0); }

const created = await gql(`mutation($input: GoogleServiceAccountKeyInput!, $account: ID!) { googleServiceAccountKey {
  createGoogleServiceAccountKey(googleServiceAccountKeyInput: $input, accountId: $account) { id clientEmail }
} }`, { input: { jsonKey: key }, account: project.ownerAccount.id });
const keyId = created.googleServiceAccountKey.createGoogleServiceAccountKey.id;

if (!creds) {
  const made = await gql(`mutation($input: AndroidAppCredentialsInput!, $app: ID!, $pkg: String!) { androidAppCredentials {
    createAndroidAppCredentials(androidAppCredentialsInput: $input, appId: $app, applicationIdentifier: $pkg) { id }
  } }`, { input: { googleServiceAccountKeyForFcmV1Id: keyId }, app: project.id, pkg: PACKAGE });
  creds = made.androidAppCredentials.createAndroidAppCredentials;
} else {
  await gql(`mutation($creds: ID!, $key: ID!) { androidAppCredentials {
    setGoogleServiceAccountKeyForFcmV1(id: $creds, googleServiceAccountKeyId: $key) { id }
  } }`, { creds: creds.id, key: keyId });
}
console.log(`Готово: ключ ${key.client_email} подключён к ${PACKAGE}. Пуши на Android включатся в новой APK.`);
