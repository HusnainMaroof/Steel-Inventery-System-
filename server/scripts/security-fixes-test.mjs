/**
 * Verifies Phase-0 security fixes. Requires server on PORT (default 4000).
 * Run: node scripts/security-fixes-test.mjs
 */
import "dotenv/config";

const API = (process.env.TRADEX_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@tradex.app";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "TradexAdmin2026";

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function api(token, method, path, body) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`Security fixes test → ${API}\n`);

  const login = await api(null, "POST", "/auth/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (login.status !== 200 || !login.data?.access_token) {
    console.error("Cannot login as super admin. Start the server and check ADMIN_EMAIL/PASSWORD.");
    process.exit(1);
  }
  const token = login.data.access_token;
  record("Super admin login", true);

  const owners = await api(token, "GET", "/owners");
  const hasPlaintextPassword = JSON.stringify(owners.data ?? {}).includes("loginPassword");
  record("Owners API does not expose loginPassword", !hasPlaintextPassword);

  const logout = await api(token, "POST", "/auth/logout");
  record("Logout endpoint returns 200", logout.status === 200);

  const afterLogout = await api(token, "GET", "/auth/me");
  record("Token invalid after logout", afterLogout.status === 401, `status=${afterLogout.status}`);

  const relogin = await api(null, "POST", "/auth/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  record("Re-login after logout", relogin.status === 200);
  const token2 = relogin.data.access_token;

  const me = await api(token2, "GET", "/auth/me");
  record("/auth/me works with new token", me.status === 200);

  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
  if (results.some((r) => !r.pass)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
