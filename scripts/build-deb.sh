#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_JSON="${ROOT_DIR}/package.json"
VERSION="$(node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).version" "${PACKAGE_JSON}")"
DESCRIPTION="$(node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).description" "${PACKAGE_JSON}")"
PACKAGE_NAME="gitxplain"
ARCHITECTURE="${DEB_ARCHITECTURE:-all}"
MAINTAINER="${DEB_MAINTAINER:-Guruswarupa <opensource@local.invalid>}"
OUTPUT_DIR="${ROOT_DIR}/dist"
BUILD_ROOT="$(mktemp -d)"
PACKAGE_ROOT="${BUILD_ROOT}/${PACKAGE_NAME}_${VERSION}"
INSTALL_ROOT="${PACKAGE_ROOT}/usr/lib/${PACKAGE_NAME}"
CONTROL_DIR="${PACKAGE_ROOT}/DEBIAN"
DOC_DIR="${PACKAGE_ROOT}/usr/share/doc/${PACKAGE_NAME}"
DEB_FILE="${OUTPUT_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCHITECTURE}.deb"

cleanup() {
  rm -rf "${BUILD_ROOT}"
}

trap cleanup EXIT

mkdir -p "${OUTPUT_DIR}" "${INSTALL_ROOT}" "${CONTROL_DIR}" "${DOC_DIR}" "${PACKAGE_ROOT}/usr/bin"

cp -a \
  "${ROOT_DIR}/cli" \
  "${ROOT_DIR}/prompts" \
  "${ROOT_DIR}/package.json" \
  "${ROOT_DIR}/README.md" \
  "${INSTALL_ROOT}/"

find "${PACKAGE_ROOT}" -type d -exec chmod 755 {} +
find "${PACKAGE_ROOT}" -type f -exec chmod 644 {} +
chmod 755 "${INSTALL_ROOT}/cli/index.js"
ln -s "../lib/${PACKAGE_NAME}/cli/index.js" "${PACKAGE_ROOT}/usr/bin/gitxplain"
ln -s "../lib/${PACKAGE_NAME}/cli/index.js" "${PACKAGE_ROOT}/usr/bin/gitxplore"

cat > "${CONTROL_DIR}/control" <<EOF
Package: ${PACKAGE_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCHITECTURE}
Maintainer: ${MAINTAINER}
Depends: nodejs (>= 18)
Homepage: https://github.com/guruswarupa/gitxplain
Description: ${DESCRIPTION}
 AI-powered Git commit explainer CLI distributed as a Debian package.
EOF

cat > "${DOC_DIR}/copyright" <<EOF
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: gitxplain
Source: https://github.com/guruswarupa/gitxplain

Files: *
License: MIT
EOF

dpkg-deb --root-owner-group --build "${PACKAGE_ROOT}" "${DEB_FILE}" >/dev/null
echo "${DEB_FILE}"
