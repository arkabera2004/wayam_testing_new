/**
 * A stub of the slice of the GitHub API the export flow uses, so the whole
 * path (connect -> encrypt -> blobs -> tree -> commit -> ref -> PR) can be
 * exercised without real credentials or writing to a real repository.
 *
 * Modes, set with MODE:
 *   ok        - a normal export
 *   nochange  - the tree comes back identical, so there is nothing to export
 *   prfail    - the PR call fails, to check the branch is cleaned up
 */
import { createServer } from "node:http";

const MODE = process.env.MODE ?? "ok";
const PORT = Number(process.env.PORT ?? 877);

const BASE_TREE = "basetree000000000000000000000000000000000";
const calls = [];
const refs = new Set();

function send(res, code, body) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    const path = url.pathname;
    const body = raw ? JSON.parse(raw) : null;
    calls.push(`${req.method} ${path}`);

    // Lets the test read back what actually happened.
    if (path === "/__calls") return send(res, 200, { calls, refs: [...refs] });

    if (path === "/user") return send(res, 200, { login: "octo", name: "Octo", avatar_url: "", html_url: "" });

    if (/^\/repos\/[^/]+\/[^/]+$/.test(path)) {
      return send(res, 200, {
        full_name: "acme/shopstack", html_url: "https://github.com/acme/shopstack",
        private: false, default_branch: "main", description: null, updated_at: null, language: "TypeScript",
      });
    }

    if (path.endsWith("/git/ref/heads/main")) return send(res, 200, { object: { sha: "basecommit" } });

    if (/\/git\/commits\/basecommit$/.test(path)) return send(res, 200, { tree: { sha: BASE_TREE } });

    if (path.endsWith("/git/blobs")) {
      if (!body?.content || body.encoding !== "base64") return send(res, 422, { message: "bad blob" });
      return send(res, 201, { sha: `blob${calls.length}` });
    }

    if (path.endsWith("/git/trees")) {
      if (body?.base_tree !== BASE_TREE) return send(res, 422, { message: "base_tree missing" });
      // nochange: hand back the base tree so the caller must stop.
      return send(res, 201, { sha: MODE === "nochange" ? BASE_TREE : "newtree" });
    }

    if (path.endsWith("/git/commits")) {
      if (!Array.isArray(body?.parents) || body.parents[0] !== "basecommit") {
        return send(res, 422, { message: "bad parents" });
      }
      return send(res, 201, { sha: "newcommit" });
    }

    if (path.endsWith("/git/refs") && req.method === "POST") {
      refs.add(body.ref);
      return send(res, 201, { ref: body.ref });
    }

    if (path.includes("/git/refs/heads/") && req.method === "DELETE") {
      refs.delete(path.slice(path.indexOf("/git/refs/") + 10).replace(/^/, "refs/"));
      refs.forEach((r) => { if (path.endsWith(r.replace("refs/", ""))) refs.delete(r); });
      return send(res, 204, {});
    }

    if (path.endsWith("/pulls")) {
      if (MODE === "prfail") return send(res, 422, { message: "No commits between main and the branch" });
      return send(res, 201, { html_url: "https://github.com/acme/shopstack/pull/1" });
    }

    return send(res, 404, { message: `stub has no route for ${req.method} ${path}` });
  });
}).listen(PORT, () => console.log(`fake github (${MODE}) on ${PORT}`));
