// vitest -> node:test compatibility shim.
//
// vitest 4 cannot start in this Linux sandbox: it loads its bundler through
// rolldown, and the only native binding installed is win32-x64 (node_modules was
// installed on the user's Windows host). npm is 403-blocked so the correct
// binding cannot be fetched. Node 22's built-in test runner needs no native
// bindings at all, so this file maps the vitest surface the suite actually uses
// onto node:test, letting the tests produce a real verdict here.
//
// Preload with: node --require ./tests/_shim.cjs --test <files>
// This is a sandbox-only harness. It is NOT a replacement for `npm test`, which
// runs the real vitest on the user's machine.

const nodeTest = require("node:test");
const assert = require("node:assert/strict");

globalThis.describe = nodeTest.describe;
globalThis.it = nodeTest.it;
globalThis.test = nodeTest.test;

// vitest's beforeAll/afterAll are node:test's before/after.
globalThis.beforeAll = nodeTest.before;
globalThis.afterAll = nodeTest.after;
globalThis.beforeEach = nodeTest.beforeEach;
globalThis.afterEach = nodeTest.afterEach;

function fmt(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return require("node:util").inspect(v, { depth: 2 });
  } catch {
    return String(v);
  }
}

function matchesError(err, expected) {
  if (expected === undefined) return true;
  const message = err && err.message !== undefined ? String(err.message) : String(err);
  if (expected instanceof RegExp) return expected.test(message);
  if (typeof expected === "string") return message.includes(expected);
  if (typeof expected === "function") return err instanceof expected;
  return true;
}

function buildMatchers(actual, negated) {
  const ok = (pass, msg) => {
    if (negated ? pass : !pass) {
      assert.fail(negated ? `NOT: ${msg}` : msg);
    }
  };

  return {
    toBe(expected) {
      ok(Object.is(actual, expected), `expected ${fmt(actual)} to be ${fmt(expected)}`);
    },
    toEqual(expected) {
      let pass = true;
      try {
        assert.deepStrictEqual(actual, expected);
      } catch {
        pass = false;
      }
      ok(pass, `expected ${fmt(actual)} to equal ${fmt(expected)}`);
    },
    toBeDefined() {
      ok(actual !== undefined, `expected ${fmt(actual)} to be defined`);
    },
    toBeUndefined() {
      ok(actual === undefined, `expected ${fmt(actual)} to be undefined`);
    },
    toBeNull() {
      ok(actual === null, `expected ${fmt(actual)} to be null`);
    },
    toBeTruthy() {
      ok(Boolean(actual), `expected ${fmt(actual)} to be truthy`);
    },
    toBeFalsy() {
      ok(!actual, `expected ${fmt(actual)} to be falsy`);
    },
    toMatch(re) {
      const s = String(actual);
      const pass = re instanceof RegExp ? re.test(s) : s.includes(String(re));
      ok(pass, `expected ${fmt(s)} to match ${re}`);
    },
    toContain(needle) {
      const pass = typeof actual === "string"
        ? actual.includes(needle)
        : Array.isArray(actual) && actual.includes(needle);
      ok(pass, `expected ${fmt(actual)} to contain ${fmt(needle)}`);
    },
    toHaveLength(n) {
      ok(actual != null && actual.length === n,
        `expected length ${actual == null ? "<nullish>" : actual.length} to be ${n}`);
    },
    toHaveProperty(key) {
      ok(actual != null && key in actual, `expected ${fmt(actual)} to have property ${fmt(key)}`);
    },
    toBeInstanceOf(ctor) {
      ok(actual instanceof ctor, `expected ${fmt(actual)} to be instance of ${ctor.name}`);
    },
    toBeGreaterThan(n) {
      ok(actual > n, `expected ${fmt(actual)} > ${fmt(n)}`);
    },
    toBeLessThan(n) {
      ok(actual < n, `expected ${fmt(actual)} < ${fmt(n)}`);
    },
    toThrow(expected) {
      if (typeof actual !== "function") assert.fail("toThrow needs a function");
      let threw = false;
      let err;
      try {
        actual();
      } catch (e) {
        threw = true;
        err = e;
      }
      ok(threw && matchesError(err, expected),
        threw
          ? `threw ${fmt(err)}, which does not match ${expected}`
          : "expected function to throw, it did not");
    },
  };
}

function expect(actual) {
  const api = buildMatchers(actual, false);
  api.not = buildMatchers(actual, true);

  const settle = (wantRejection) => {
    const mk = (negated) => ({
      async toThrow(expected) {
        let threw = false;
        let err;
        try {
          await actual;
        } catch (e) {
          threw = true;
          err = e;
        }
        const pass = wantRejection ? threw && matchesError(err, expected) : !threw;
        if (negated ? pass : !pass) {
          assert.fail(
            wantRejection
              ? (threw ? `rejected with ${fmt(err)}, which does not match ${expected}`
                       : "expected promise to reject, it resolved")
              : `expected promise to resolve, it rejected with ${fmt(err)}`
          );
        }
      },
      async toBe(expected) {
        const v = await actual;
        if (negated ? Object.is(v, expected) : !Object.is(v, expected)) {
          assert.fail(`expected resolved ${fmt(v)} to be ${fmt(expected)}`);
        }
      },
      async toBeDefined() {
        const v = await actual;
        if (negated ? v !== undefined : v === undefined) {
          assert.fail(`expected resolved ${fmt(v)} to be defined`);
        }
      },
    });
    const o = mk(false);
    o.not = mk(true);
    return o;
  };

  api.rejects = settle(true);
  api.resolves = settle(false);
  return api;
}

expect.any = (ctor) => ({ __any: ctor });
globalThis.expect = expect;

// Minimal vi surface: only fn/spyOn/clearAllMocks are used by this suite.
globalThis.vi = {
  fn(impl) {
    const calls = [];
    const f = (...args) => {
      calls.push(args);
      return impl ? impl(...args) : undefined;
    };
    f.mock = { calls };
    f.mockClear = () => { calls.length = 0; };
    f.mockReturnValue = (v) => { impl = () => v; return f; };
    f.mockResolvedValue = (v) => { impl = () => Promise.resolve(v); return f; };
    return f;
  },
  spyOn(obj, key) {
    const original = obj[key];
    const spy = globalThis.vi.fn((...a) => original.apply(obj, a));
    spy.mockRestore = () => { obj[key] = original; };
    obj[key] = spy;
    return spy;
  },
  clearAllMocks() {},
  restoreAllMocks() {},
};
