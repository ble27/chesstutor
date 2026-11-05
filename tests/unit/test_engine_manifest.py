import hashlib
import io
import tarfile
from dataclasses import replace

import pytest

from services.adapters.engine_binary import (
    Artifact,
    engine_identity,
    install_engine,
    selected_artifact,
    verify_binary,
)

PLATFORMS = ["darwin-arm64", "linux-x86_64"]
STOCKFISH_17_1_MACOS_SHA256 = "9345c44970093cabed9757be86a9ca86809a5b6ca1bdc654cf51a5eed7568858"


@pytest.mark.parametrize("platform", PLATFORMS)
def test_every_supported_platform_pins_the_stockfish_19_release(platform):
    artifact = selected_artifact(platform)
    assert artifact.version == "19"
    assert "/releases/download/sf_19/stockfish-" in artifact.archive_url
    assert artifact.archive_url.endswith(".tar.gz")
    assert artifact.source_url == "https://github.com/official-stockfish/Stockfish/tree/sf_19"
    assert artifact.binary_path.startswith("stockfish/stockfish-")


@pytest.mark.parametrize("platform", PLATFORMS)
def test_pinned_checksums_are_full_sha256_digests(platform):
    artifact = selected_artifact(platform)
    for digest in (artifact.archive_sha256, artifact.binary_sha256):
        assert len(digest) == 64 and set(digest) <= set("0123456789abcdef")
    assert artifact.archive_sha256 != artifact.binary_sha256


def test_stockfish_19_results_never_share_an_identity_with_17_1_results():
    current = selected_artifact("darwin-arm64")
    previous = replace(current, version="17.1", binary_sha256=STOCKFISH_17_1_MACOS_SHA256)
    assert engine_identity(current)["version"] == "19"
    assert engine_identity(current) != engine_identity(previous)
    assert current.binary_sha256 != STOCKFISH_17_1_MACOS_SHA256


def gzip_release(tmp_path) -> tuple[object, Artifact]:
    """Stockfish 19 ships `.tar.gz`; the installer must verify and extract it."""
    destination = tmp_path / "release.tar.gz"
    with tarfile.open(destination, "w:gz") as archive:
        for name, data in [
            ("stockfish/stockfish-fixture-universal", b"fixture engine 19"),
            ("stockfish/Copying.txt", b"fixture license"),
        ]:
            member = tarfile.TarInfo(name)
            member.size = len(data)
            archive.addfile(member, io.BytesIO(data))
    spec = Artifact(
        "fixture",
        "19",
        "https://github.com/release.tar.gz",
        hashlib.sha256(destination.read_bytes()).hexdigest(),
        "stockfish/stockfish-fixture-universal",
        hashlib.sha256(b"fixture engine 19").hexdigest(),
        "https://github.com/source",
    )
    return destination, spec


def test_a_stale_cached_archive_from_an_older_pin_is_not_reused(tmp_path, monkeypatch):
    archive, spec = gzip_release(tmp_path)
    stale_dir = tmp_path / ".cache" / "stockfish"
    stale_dir.mkdir(parents=True)
    # The previous release was cached under the platform name alone.
    (stale_dir / "fixture.tar").write_bytes(b"archive from the previous pin")
    downloads: list[str] = []

    def fake_download(artifact: Artifact, destination) -> None:
        downloads.append(artifact.version)
        destination.write_bytes(archive.read_bytes())

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("services.adapters.engine_binary.download_archive", fake_download)
    destination = tmp_path / "bin" / "stockfish"
    install_engine(destination, spec)
    assert downloads == ["19"]
    assert verify_binary(destination, spec)["version"] == "19"


def test_installer_verifies_and_extracts_a_gzip_release_archive(tmp_path):
    archive, spec = gzip_release(tmp_path)
    destination = tmp_path / "bin" / "stockfish"
    install_engine(destination, spec, archive)
    assert verify_binary(destination, spec)["version"] == "19"
    assert destination.read_bytes() == b"fixture engine 19"
    assert destination.with_name("stockfish-LICENSE.txt").read_text() == "fixture license"
