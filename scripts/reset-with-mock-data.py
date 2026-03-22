#!/usr/bin/env python3.11

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import shutil
import sqlite3
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


SMALL_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAbUlEQVR4nO3PQQ0AIBDAMMC/"
    "58MCP7KkVbCtOfO1rQNeNaAqQFWgKkBVoCpAVaAqQFWgKkBVoCpAVaAqQFWgKkBVoCpAVaAqQFWg"
    "KkBVoCpAVaAqQFWgKkBVoCpAVaAqQFWgKkBVoCpA9QG5SgI+z6t6yAAAAABJRU5ErkJggg=="
)

SMALL_JPG_BASE64 = (
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQDxAQEA8QDw8PDw8QEA8PDw8PDw8PFREWFhUR"
    "FRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGi0fHyUtLS0tLS0tLS0t"
    "LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAEAAQAMBIgACEQEDEQH/"
    "xAAXAAADAQAAAAAAAAAAAAAAAAAAAQID/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQ"
    "AAAB9oAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCcf/EABQRAQAAAAAAAA"
    "AAAAAAAAAAAAD/2gAIAQMBAT8BJ//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8BJ//Z"
)


@dataclass(frozen=True)
class DeviceSeed:
    id: str
    source_ip: str
    user_agent: str
    device_type: str
    device_vendor: str
    device_model: str
    browser_name: str
    browser_version: str
    os_name: str
    os_version: str
    tailscale_user: str
    tailscale_login: str
    tailscale_node: str
    tailscale_tailnet: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Back up current live data, clear it, and seed mock data.")
    parser.add_argument(
        "--repo-root",
        default=Path(__file__).resolve().parents[1],
        type=Path,
        help="Repository root, defaults to the current Kipdok checkout.",
    )
    parser.add_argument(
        "--backup-root",
        default=None,
        type=Path,
        help="Directory where timestamped backups are written. Defaults to a sibling Kipdok-backups directory.",
    )
    return parser.parse_args()


def parse_env(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in raw_line:
            continue
        key, value = raw_line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        elif value.startswith("'") and value.endswith("'"):
            value = value[1:-1]
        values[key] = value
    return values


def safe_unlink(path: Path) -> None:
    if path.is_file() or path.is_symlink():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def reset_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    for child in path.iterdir():
        safe_unlink(child)


def backup_sqlite(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source) as src_conn, sqlite3.connect(target) as dst_conn:
        src_conn.backup(dst_conn)


def copy_if_exists(source: Path, target: Path) -> bool:
    if not source.exists():
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        shutil.copytree(source, target, dirs_exist_ok=True)
    else:
        shutil.copy2(source, target)
    return True


def to_backup_relative(path: Path) -> Path:
    return Path("absolute") / str(path).lstrip("/")


def common_manifest_section(env: dict[str, str], db_path: Path, data_root: Path) -> dict[str, Any]:
    return {
        "database_url": env.get("DATABASE_URL"),
        "database_path": str(db_path),
        "data_root": str(data_root),
    }


def inspect_live_references(db_path: Path) -> tuple[dict[str, int], list[Path], list[Path]]:
    counts: dict[str, int] = {}
    stored_paths: list[Path] = []
    log_paths: list[Path] = []
    with sqlite3.connect(db_path) as conn:
      cur = conn.cursor()
      for table in ["AdminUser", "Session", "DeviceInfo", "Item", "MessageContent", "FileAsset", "AccessEvent"]:
          counts[table] = cur.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
      stored_paths = [Path(row[0]) for row in cur.execute('SELECT storedPath FROM "FileAsset"').fetchall()]
      log_paths = [Path(row[0]) for row in cur.execute('SELECT logFilePath FROM "MessageContent"').fetchall()]
    return counts, stored_paths, log_paths


def backup_live_data(repo_root: Path, env: dict[str, str], db_path: Path, data_root: Path, backup_root: Path) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_dir = backup_root / f"pre-mock-reset-{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)

    counts, stored_paths, log_paths = inspect_live_references(db_path)
    missing_paths: list[str] = []

    backup_sqlite(db_path, backup_dir / "database" / db_path.name)
    copy_if_exists(data_root, backup_dir / "repo-data")

    referenced_dir = backup_dir / "referenced-files"
    for source in sorted({*stored_paths, *log_paths}, key=str):
        target = referenced_dir / to_backup_relative(source)
        copied = copy_if_exists(source, target)
        if not copied:
            missing_paths.append(str(source))

    manifest = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        **common_manifest_section(env, db_path, data_root),
        "table_counts": counts,
        "referenced_file_count": len(stored_paths),
        "referenced_log_count": len(log_paths),
        "missing_referenced_paths": missing_paths,
    }
    (backup_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return backup_dir


def write_bytes(path: Path, payload: bytes) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return hashlib.sha256(payload).hexdigest()


def file_payloads() -> dict[str, bytes]:
    markdown = (
        "# Weekly Kipdok Review\n\n"
        "- README screenshots refreshed with mock content\n"
        "- Live data archived before reset\n"
        "- Dashboard now shows a stable extension mix\n"
    ).encode("utf-8")
    text = (
        "Kipdok mock intake\n"
        "-------------------\n"
        "Use this file to keep the inbox and dashboard populated for README screenshots.\n"
    ).encode("utf-8")
    png_bytes = base64.b64decode(SMALL_PNG_BASE64)
    jpg_bytes = base64.b64decode(SMALL_JPG_BASE64)

    zip_buffer = Path("/tmp/kipdok-mock-assets.zip")
    with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("overview.txt", "Mock archive for README screenshots.\n")
        archive.writestr("notes/seed.txt", "Contains seeded files, images, and message entries.\n")
    zip_bytes = zip_buffer.read_bytes()
    zip_buffer.unlink(missing_ok=True)

    return {
        "weekly-kipdok-review.md": markdown,
        "handoff-summary.txt": text,
        "label-preview.png": png_bytes,
        "desk-photo.jpg": jpg_bytes,
        "mock-assets.zip": zip_bytes,
    }


def normalize_base(value: str) -> str:
    return "".join(char if char.isalnum() or char in "-_" else "-" for char in value).strip("-_")[:80] or "upload"


def write_file_asset(data_root: Path, when_ms: int, filename: str, payload: bytes) -> dict[str, Any]:
    extension = Path(filename).suffix
    safe_base = normalize_base(Path(filename).stem)
    sha256 = hashlib.sha256(payload).hexdigest()
    day = datetime.fromtimestamp(when_ms / 1000, tz=timezone.utc)
    relative_dir = Path("uploads") / day.strftime("%Y/%m/%d")
    stored_filename = f"{when_ms}-{safe_base}-{sha256[:12]}{extension}"
    full_path = data_root / relative_dir / stored_filename
    write_bytes(full_path, payload)
    return {
        "stored_filename": stored_filename,
        "stored_path": str(full_path),
        "extension": extension.lstrip(".") or None,
        "size_bytes": len(payload),
        "sha256": sha256,
    }


def append_message_log(data_root: Path, item_id: str, content: str, device: DeviceSeed, when_ms: int) -> str:
    when = datetime.fromtimestamp(when_ms / 1000, tz=timezone.utc)
    log_path = data_root / "messages" / f"{when.strftime('%Y-%m-%d')}.log"
    entry = {
        "messageId": item_id,
        "timestamp": when.isoformat(),
        "sourceIp": device.source_ip,
        "userAgent": device.user_agent,
        "deviceType": device.device_type,
        "deviceVendor": device.device_vendor,
        "deviceModel": device.device_model,
        "browserName": device.browser_name,
        "browserVersion": device.browser_version,
        "osName": device.os_name,
        "osVersion": device.os_version,
        "tailscaleUser": device.tailscale_user,
        "tailscaleLogin": device.tailscale_login,
        "tailscaleNode": device.tailscale_node,
        "tailscaleTailnet": device.tailscale_tailnet,
        "content": content,
    }
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return str(log_path)


def clear_database(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    for table in ["Session", "AccessEvent", "FileAsset", "MessageContent", "Item", "DeviceInfo", "AdminUser"]:
        cur.execute(f'DELETE FROM "{table}"')
    conn.commit()
    cur.execute("VACUUM")


def seed_mock_data(repo_root: Path, db_path: Path, data_root: Path) -> dict[str, int]:
    uploads_root = data_root / "uploads"
    messages_root = data_root / "messages"
    logs_root = data_root / "logs"
    export_root = data_root / "export"
    db_root = data_root / "db"

    for path in [uploads_root, messages_root, logs_root, export_root, db_root]:
        reset_directory(path)

    devices = {
        "desktop": DeviceSeed(
            id="mock_device_desktop",
            source_ip="100.64.10.12",
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36",
            device_type="desktop",
            device_vendor="Apple",
            device_model="MacBook Air",
            browser_name="Chrome",
            browser_version="135.0",
            os_name="macOS",
            os_version="15.4",
            tailscale_user="operator@example.com",
            tailscale_login="operator@example.com",
            tailscale_node="studio-mac",
            tailscale_tailnet="example-tailnet",
        ),
        "phone": DeviceSeed(
            id="mock_device_phone",
            source_ip="100.64.10.28",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
            device_type="mobile",
            device_vendor="Apple",
            device_model="iPhone",
            browser_name="Safari",
            browser_version="18.3",
            os_name="iOS",
            os_version="18.3",
            tailscale_user="operator@example.com",
            tailscale_login="operator@example.com",
            tailscale_node="field-phone",
            tailscale_tailnet="example-tailnet",
        ),
        "tablet": DeviceSeed(
            id="mock_device_tablet",
            source_ip="100.64.10.44",
            user_agent="Mozilla/5.0 (iPad; CPU OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
            device_type="tablet",
            device_vendor="Apple",
            device_model="iPad",
            browser_name="Safari",
            browser_version="18.3",
            os_name="iPadOS",
            os_version="18.3",
            tailscale_user="operator@example.com",
            tailscale_login="operator@example.com",
            tailscale_node="review-ipad",
            tailscale_tailnet="example-tailnet",
        ),
    }

    base = datetime.now(timezone.utc).replace(minute=12, second=0, microsecond=0)
    messages = [
        {
            "id": "mock_item_message_01",
            "title": "Sprint handoff summary",
            "content": "README screenshots refreshed.\nMock seed data is ready for inbox and dashboard verification.",
            "device": devices["desktop"],
            "when": base - timedelta(days=7),
        },
        {
            "id": "mock_item_message_02",
            "title": "Weekend NAS checklist",
            "content": "1. Check backups\n2. Review uploads\n3. Confirm Tailnet access remains healthy",
            "device": devices["phone"],
            "when": base - timedelta(days=4, hours=3),
        },
        {
            "id": "mock_item_message_03",
            "title": "March review ideas",
            "content": "Capture a cleaner dashboard state with file, image, archive, and message coverage.",
            "device": devices["tablet"],
            "when": base - timedelta(days=1, hours=6),
        },
    ]

    file_data = file_payloads()
    files = [
        {
            "id": "mock_item_file_01",
            "filename": "weekly-kipdok-review.md",
            "mime": "text/markdown",
            "device": devices["desktop"],
            "when": base - timedelta(days=6, hours=2),
        },
        {
            "id": "mock_item_file_02",
            "filename": "label-preview.png",
            "mime": "image/png",
            "device": devices["phone"],
            "when": base - timedelta(days=3, hours=5),
        },
        {
            "id": "mock_item_file_03",
            "filename": "desk-photo.jpg",
            "mime": "image/jpeg",
            "device": devices["tablet"],
            "when": base - timedelta(days=2, hours=1),
        },
        {
            "id": "mock_item_file_04",
            "filename": "mock-assets.zip",
            "mime": "application/zip",
            "device": devices["desktop"],
            "when": base - timedelta(hours=18),
        },
    ]

    with sqlite3.connect(db_path) as conn:
        clear_database(conn)
        cur = conn.cursor()

        for device in devices.values():
            cur.execute(
                """
                INSERT INTO "DeviceInfo" (
                  id, sourceIp, userAgent, deviceType, deviceVendor, deviceModel,
                  browserName, browserVersion, osName, osVersion,
                  tailscaleUser, tailscaleLogin, tailscaleNode, tailscaleTailnet, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    device.id,
                    device.source_ip,
                    device.user_agent,
                    device.device_type,
                    device.device_vendor,
                    device.device_model,
                    device.browser_name,
                    device.browser_version,
                    device.os_name,
                    device.os_version,
                    device.tailscale_user,
                    device.tailscale_login,
                    device.tailscale_node,
                    device.tailscale_tailnet,
                    int(base.timestamp() * 1000),
                ),
            )

        for index, entry in enumerate(messages, start=1):
            when_ms = int(entry["when"].timestamp() * 1000)
            cur.execute(
                """
                INSERT INTO "Item" (id, type, title, createdAt, updatedAt, deviceInfoId)
                VALUES (?, 'message', ?, ?, ?, ?)
                """,
                (entry["id"], entry["title"], when_ms, when_ms, entry["device"].id),
            )
            log_file_path = append_message_log(data_root, entry["id"], entry["content"], entry["device"], when_ms)
            cur.execute(
                """
                INSERT INTO "MessageContent" (id, itemId, content, logFilePath)
                VALUES (?, ?, ?, ?)
                """,
                (f"mock_message_content_{index:02d}", entry["id"], entry["content"], log_file_path),
            )
            cur.execute(
                """
                INSERT INTO "AccessEvent" (id, action, itemId, deviceInfoId, detail, createdAt)
                VALUES (?, 'upload_message', ?, ?, ?, ?)
                """,
                (f"mock_event_upload_message_{index:02d}", entry["id"], entry["device"].id, entry["title"], when_ms + 4000),
            )

        for index, entry in enumerate(files, start=1):
            when_ms = int(entry["when"].timestamp() * 1000)
            asset = write_file_asset(data_root, when_ms, entry["filename"], file_data[entry["filename"]])
            cur.execute(
                """
                INSERT INTO "Item" (id, type, title, createdAt, updatedAt, deviceInfoId)
                VALUES (?, 'file', ?, ?, ?, ?)
                """,
                (entry["id"], entry["filename"], when_ms, when_ms, entry["device"].id),
            )
            cur.execute(
                """
                INSERT INTO "FileAsset" (
                  id, itemId, originalFilename, storedFilename, storedPath,
                  mimeType, extension, sizeBytes, sha256
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"mock_file_asset_{index:02d}",
                    entry["id"],
                    entry["filename"],
                    asset["stored_filename"],
                    asset["stored_path"],
                    entry["mime"],
                    asset["extension"],
                    asset["size_bytes"],
                    asset["sha256"],
                ),
            )
            cur.execute(
                """
                INSERT INTO "AccessEvent" (id, action, itemId, deviceInfoId, detail, createdAt)
                VALUES (?, 'upload_file', ?, ?, ?, ?)
                """,
                (
                    f"mock_event_upload_file_{index:02d}",
                    entry["id"],
                    entry["device"].id,
                    f"{entry['filename']}:{Path(entry['filename']).suffix}",
                    when_ms + 4000,
                ),
            )

        extra_events = [
            ("mock_event_login_01", "login", None, devices["desktop"].id, "login:mock-admin", int((base - timedelta(days=8)).timestamp() * 1000)),
            ("mock_event_login_02", "login", None, devices["phone"].id, "login:mock-admin", int((base - timedelta(days=2)).timestamp() * 1000)),
            (
                "mock_event_download_01",
                "download_file",
                "mock_item_file_04",
                devices["desktop"].id,
                "mock-assets.zip",
                int((base - timedelta(hours=8)).timestamp() * 1000),
            ),
            (
                "mock_event_view_01",
                "view_item",
                "mock_item_message_03",
                devices["tablet"].id,
                "detail-opened",
                int((base - timedelta(hours=5)).timestamp() * 1000),
            ),
        ]
        for event_id, action, item_id, device_id, detail, created_at in extra_events:
            cur.execute(
                """
                INSERT INTO "AccessEvent" (id, action, itemId, deviceInfoId, detail, createdAt)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (event_id, action, item_id, device_id, detail, created_at),
            )

        conn.commit()

    return {
        "message_count": len(messages),
        "file_count": len(files),
        "event_count": len(messages) + len(files) + len(extra_events),
    }


def main() -> None:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    env_path = repo_root / ".env"
    if not env_path.exists():
        raise SystemExit(f"Missing env file: {env_path}")

    env = parse_env(env_path)
    db_url = env.get("DATABASE_URL")
    if not db_url or not db_url.startswith("file:"):
        raise SystemExit("DATABASE_URL must use a sqlite file: URL for this script.")

    db_path = Path(db_url[5:]).expanduser()
    data_root = Path(env.get("DATA_ROOT") or "./data")
    if not data_root.is_absolute():
        data_root = (repo_root / data_root).resolve()

    backup_root = args.backup_root.resolve() if args.backup_root else repo_root.parent / "Kipdok-backups"
    backup_dir = backup_live_data(repo_root, env, db_path, data_root, backup_root)
    seed_summary = seed_mock_data(repo_root, db_path, data_root)

    summary = {
        "backup_dir": str(backup_dir),
        **common_manifest_section(env, db_path, data_root),
        **seed_summary,
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
