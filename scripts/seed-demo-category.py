#!/usr/bin/env python3
"""Seed demo leave_types category + wire it into the existing Leave Request Form."""
import json
import urllib.request

BASE = "http://localhost:3001/api"


def call(method: str, path: str, token: str | None = None, body: dict | None = None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(req, data) as res:
        payload = res.read()
    return json.loads(payload) if payload else None


token = call("POST", "/auth/login", body={"email": "admin@bpms.local", "password": "admin123"})["accessToken"]
print("logged in")

# 1) Create leave_types category if missing
cats = call("GET", "/categories", token)
existing = next((c for c in cats if c["key"] == "leave_types"), None)
if existing:
    cat_id = existing["id"]
    print(f"category leave_types already exists id={cat_id}")
else:
    cat = call("POST", "/categories", token, {
        "key": "leave_types",
        "name": "انواع مرخصی",
        "description": "لیست مشترک انواع مرخصی برای فرم درخواست مرخصی",
        "items": [
            {"value": "Annual", "label": "مرخصی سالانه"},
            {"value": "Sick", "label": "مرخصی استعلاجی"},
            {"value": "Unpaid", "label": "مرخصی بدون حقوق"},
        ],
    })
    cat_id = cat["id"]
    print(f"created category leave_types id={cat_id}")

# 2) Wire leaveType field of Leave Request Form to the category
processes = call("GET", "/processes", token)
target = None
for p in processes:
    for f in call("GET", f"/forms?processId={p['id']}", token):
        if f["name"] == "Leave Request Form":
            target = f
            break
    if target:
        break

if not target:
    print("Leave Request Form not found — skip wiring")
else:
    changed = False
    for field in target["fields"]:
        if field.get("name") == "leaveType" and field.get("type") == "select":
            if field.get("categoryId") != cat_id:
                field["categoryId"] = cat_id
                changed = True
    if changed:
        call("PATCH", f"/forms/{target['id']}", token, {
            "name": target["name"],
            "description": target.get("description"),
            "fields": target["fields"],
            "processId": target["processId"],
        })
        print(f"Leave Request Form updated: leaveType.categoryId={cat_id}")
    else:
        print("Leave Request Form already wired")

# 3) Verify
cats = call("GET", "/categories", token)
for c in cats:
    print(f"verify: {c['key']} items={len(c['items'])} usage={c['usage']}")
