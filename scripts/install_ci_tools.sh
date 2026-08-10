#!/usr/bin/env bash

set -euo pipefail

terraform_version="1.14.4"
terraform_sha256="4a24b18865d9419ba7882567cb7429dd1525b3e2029a9e38f612d476ba8c3dea"
task_version="3.51.1"
task_sha256="da7e92f0ff961ef2aae7cfecbad8d1fd2a08d7b09ba968673adf7ff389b243b5"
gitleaks_version="8.30.0"
gitleaks_sha256="79a3ab579b53f71efd634f3aaf7e04a0fa0cf206b7ed434638d1547a2470a66e"

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "This installer only supports GitHub's Linux x86_64 runners." >&2
  exit 1
fi

install_dir="${RUNNER_TEMP:?RUNNER_TEMP is required}/deployment-tools/bin"
download_dir="${RUNNER_TEMP}/deployment-tools/downloads"
mkdir -p "${install_dir}" "${download_dir}"

install_terraform() {
  local archive="${download_dir}/terraform.zip"
  curl --fail --location --silent --show-error \
    --output "${archive}" \
    "https://releases.hashicorp.com/terraform/${terraform_version}/terraform_${terraform_version}_linux_amd64.zip"
  echo "${terraform_sha256}  ${archive}" | sha256sum --check
  unzip -q -o "${archive}" terraform -d "${install_dir}"
}

install_task() {
  local archive="${download_dir}/task.tar.gz"
  curl --fail --location --silent --show-error \
    --output "${archive}" \
    "https://github.com/go-task/task/releases/download/v${task_version}/task_linux_amd64.tar.gz"
  echo "${task_sha256}  ${archive}" | sha256sum --check
  tar --extract --gzip --file "${archive}" --directory "${install_dir}" task
}

install_gitleaks() {
  local archive="${download_dir}/gitleaks.tar.gz"
  curl --fail --location --silent --show-error \
    --output "${archive}" \
    "https://github.com/gitleaks/gitleaks/releases/download/v${gitleaks_version}/gitleaks_${gitleaks_version}_linux_x64.tar.gz"
  echo "${gitleaks_sha256}  ${archive}" | sha256sum --check
  tar --extract --gzip --file "${archive}" --directory "${install_dir}" gitleaks
}

for tool in "$@"; do
  case "${tool}" in
    terraform) install_terraform ;;
    task) install_task ;;
    gitleaks) install_gitleaks ;;
    *)
      echo "Unsupported deployment tool: ${tool}" >&2
      exit 1
      ;;
  esac
done

echo "${install_dir}" >> "${GITHUB_PATH:?GITHUB_PATH is required}"
