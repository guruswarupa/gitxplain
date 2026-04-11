# Packaging

This directory contains packaging assets for Homebrew, AUR, and Debian releases.

## Homebrew tap

Template formula: `packaging/homebrew-tap/Formula/gitxplain.rb`

Create and publish the tap repository:

```bash
gh repo create guruswarupa/homebrew-tap --public --clone
cd homebrew-tap
mkdir -p Formula
cp /path/to/gitxplain/packaging/homebrew-tap/Formula/gitxplain.rb Formula/gitxplain.rb
git add Formula/gitxplain.rb
git commit -m "Add gitxplain formula"
git push -u origin main
```

After each new npm publish, update the formula `url` and replace `"<SHA256_PLACEHOLDER>"` with the tarball SHA-256, then push the change.

## AUR

Template files:

- `packaging/aur/PKGBUILD`
- `packaging/aur/.SRCINFO`

Generate `.SRCINFO` after updating `PKGBUILD`:

```bash
cd /path/to/gitxplain/packaging/aur
makepkg --printsrcinfo > .SRCINFO
```

Create and publish the AUR package:

```bash
git clone ssh://aur@aur.archlinux.org/gitxplain.git aur-gitxplain
cd aur-gitxplain
cp /path/to/gitxplain/packaging/aur/PKGBUILD .
cp /path/to/gitxplain/packaging/aur/.SRCINFO .
makepkg --printsrcinfo > .SRCINFO
git add PKGBUILD .SRCINFO
git commit -m "Initial gitxplain release"
git push
```

Replace `"<SHA256_PLACEHOLDER>"` with the npm tarball SHA-256 before publishing.

## Debian

Build the Debian package from this repository:

```bash
./scripts/build-deb.sh
```

The package is written to `dist/gitxplain_<version>_all.deb`.
