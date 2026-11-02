#!/usr/bin/env python3
"""
Publish one extension to the store, in one command.

    python3 tools/publish.py \
        --file ~/my-extension.js \
        --id my-extension \
        --name "My extension" \
        --desc "What it does, in one line" \
        --pattern "*" \
        --category "Privacy" \
        --key ~/nijatva-store-signing-key.pem

What it does, in order:
  1. copies the script into extensions/
  2. computes its sha256 and upserts the entry in extensions/index.json
  3. signs the index with the store key
  4. runs the same checks CI runs, so a broken commit is caught here

Nothing is pushed - commit and push the three files afterwards.
"""
import argparse, base64, hashlib, json, pathlib, re, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXT = ROOT / "extensions"
INDEX = EXT / "index.json"
SIG = EXT / "index.json.sig"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--id", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--desc", required=True)
    ap.add_argument("--pattern", default="*")
    ap.add_argument("--category", default="Productivity")
    ap.add_argument("--version", default="1.0")
    ap.add_argument("--key", required=True)
    a = ap.parse_args()

    src = pathlib.Path(a.file).expanduser()
    if not src.exists():
        sys.exit(f"no such file: {src}")
    text = src.read_text(encoding="utf-8")

    if not text.strip():
        sys.exit("the script is empty")
    if re.search(r"\bchrome\s*\.", text):
        sys.exit("uses chrome.*, which cannot work in a WebView")

    # 1. into the folder
    dest = EXT / src.name
    shutil.copyfile(src, dest)

    # 2. the entry, with the hash of exactly what the browser will read
    body = dest.read_text(encoding="utf-8")
    sha = hashlib.sha256(body.encode("utf-8")).hexdigest()
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    entry = {
        "id": a.id, "name": a.name, "desc": a.desc, "pattern": a.pattern,
        "file": dest.name, "version": a.version, "category": a.category, "sha256": sha,
    }
    entries = [e for e in idx.get("extensions", []) if e.get("id") != a.id]
    entries.append(entry)
    entries.sort(key=lambda e: e["id"])
    out = {"schema": 2, "version": idx.get("version", 1), "extensions": entries}
    INDEX.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")

    # 3. sign exactly the bytes just written
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    key = serialization.load_pem_private_key(pathlib.Path(a.key).expanduser().read_bytes(), password=None)
    raw = INDEX.read_bytes()
    SIG.write_text(base64.b64encode(key.sign(raw, ec.ECDSA(hashes.SHA256()))).decode() + "\n")

    # 4. the same gate CI runs
    r = subprocess.run([sys.executable.replace("python", "node") if False else "node",
                        str(ROOT / "tools" / "validate.js")], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    if r.returncode != 0:
        sys.exit("the checks failed - nothing to commit")

    print(f"\nadded {entry['id']} ({dest.name}), sha256 {sha[:12]}...")
    print("commit these three, then push:")
    print(f"  extensions/{dest.name}")
    print("  extensions/index.json")
    print("  extensions/index.json.sig")


if __name__ == "__main__":
    main()
