require("ts-node/register/transpile-only");

const { rateLimitRedisMiddleware } = require("./src/middleware/rateLimitRedis");

function makeReq() {
  return {
    method: "POST",
    baseUrl: "/api/game",
    path: "/open-box",
    originalUrl: "/api/game/open-box",
    ip: "127.0.0.1",
    headers: {},
    userId: "assert-user",
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function run() {
  const statuses = [];
  for (let i = 1; i <= 12; i += 1) {
    const req = makeReq();
    const res = makeRes();
    let nextCalled = false;
    await rateLimitRedisMiddleware(req, res, () => {
      nextCalled = true;
    });
    statuses.push({ request: i, status: nextCalled ? 200 : res.statusCode, body: res.body });
  }
  console.log(JSON.stringify(statuses, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
