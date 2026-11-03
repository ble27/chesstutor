import hashlib
import io
import tarfile
from dataclasses import replace

import pytest

from services.adapters.engine_binary import Artifact, install_engine, verify_binary


def fixture_archive(tmp_path, binary_type=tarfile.REGTYPE):
    destination = tmp_path / "release.tar"
    with tarfile.open(destination, "w") as archive:
        for name, data in [
            ("stockfish/engine", b"fixture engine"),
            ("stockfish/Copying.txt", b"fixture license"),
        ]:
            member = tarfile.TarInfo(name)
            member.size, member.type = (
                len(data),
                binary_type if name.endswith("engine") else tarfile.REGTYPE,
            )
            archive.addfile(member, io.BytesIO(data))
    spec = Artifact(
        "fixture",
        "17.1",
        "https://github.com/release.tar",
        hashlib.sha256(destination.read_bytes()).hexdigest(),
        "stockfish/engine",
        hashlib.sha256(b"fixture engine").hexdigest(),
        "https://github.com/source",
    )
    return destination, spec


def test_installs_only_verified_binary_and_retains_license_and_provenance(tmp_path):
    archive, spec = fixture_archive(tmp_path)
    destination = tmp_path / "bin" / "stockfish"
    install_engine(destination, spec, archive)
    assert verify_binary(destination, spec)["binary_sha256"] == spec.binary_sha256
    assert destination.with_name("stockfish-LICENSE.txt").read_text() == "fixture license"
    assert destination.stat().st_mode & 0o111


@pytest.mark.parametrize("field", ["archive_sha256", "binary_sha256"])
def test_corrupted_artifacts_cannot_replace_existing_engine(tmp_path, field):
    archive, spec = fixture_archive(tmp_path)
    destination = tmp_path / "stockfish"
    destination.write_bytes(b"preserve me")
    with pytest.raises(ValueError):
        install_engine(destination, replace(spec, **{field: "0" * 64}), archive)
    assert destination.read_bytes() == b"preserve me"


def test_archive_links_are_not_extracted_or_followed(tmp_path):
    archive, spec = fixture_archive(tmp_path, tarfile.SYMTYPE)
    with pytest.raises(ValueError):
        install_engine(tmp_path / "stockfish", spec, archive)
