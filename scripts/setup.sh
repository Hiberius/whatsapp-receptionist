#!/usr/bin/env bash
# whatsapp-receptionist — interactive setup wizard
# Usage: ./scripts/setup.sh
# Tested on: macOS 14+, Ubuntu 22.04+
# Requires: bash 3.2+ (POSIX-compatible, no zsh-only features)

# --------------------------------------------------------------------------- #
#  Safety flags — but NOT set -e so we can handle errors gracefully           #
# --------------------------------------------------------------------------- #
set -uo pipefail

# --------------------------------------------------------------------------- #
#  Constants                                                                   #
# --------------------------------------------------------------------------- #
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$REPO_ROOT/setup.log"
ENV_EXAMPLE="$REPO_ROOT/.env.example"
ENV_LOCAL="$REPO_ROOT/.env.local"
REQUIRED_NODE_MAJOR=22

# ANSI colours (disabled if not a terminal)
if [ -t 1 ]; then
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; BOLD=''; RESET=''
fi

# --------------------------------------------------------------------------- #
#  Logging helpers                                                              #
# --------------------------------------------------------------------------- #
log()  { printf '%s\n' "$*" | tee -a "$LOG_FILE"; }
info() { printf "${CYAN}  %s${RESET}\n" "$*" | tee -a "$LOG_FILE"; }
ok()   { printf "${GREEN}  [ok] %s${RESET}\n" "$*" | tee -a "$LOG_FILE"; }
warn() { printf "${YELLOW}  [warn] %s${RESET}\n" "$*" | tee -a "$LOG_FILE"; }
err()  { printf "${RED}  [error] %s${RESET}\n" "$*" | tee -a "$LOG_FILE" >&2; }

# --------------------------------------------------------------------------- #
#  Banner                                                                      #
# --------------------------------------------------------------------------- #
print_banner() {
  printf "${BOLD}${CYAN}"
  cat <<'EOF'
  ___         _                 _
 / _ \       | |               (_)
/ /_\ \_ __ _| |__  _ __ ___  __  ____   __ _  _
|  _  | '_ \| '_ \| '__/ _ \/ _` |/ _ \ / _` |/ _ \
| | | | | | | |_) | | | (_) | (_| | (_) | (_| | (_) |
\_| |_/_| |_|_.__/|_|  \___/ \__, |\___/ \__, |\___/
                               __/ |       __/ |
  whatsapp-receptionist       |___/       |___/
  AI Receptionist SaaS — Next.js 15 + Supabase + Anthropic
EOF
  printf "${RESET}\n"
  log "=== Setup started at $(date) ==="
  log "Log file: $LOG_FILE"
  log ""
}

# --------------------------------------------------------------------------- #
#  OS detection                                                                #
# --------------------------------------------------------------------------- #
detect_os() {
  case "$(uname -s)" in
    Darwin*)  OS="macos"   ;;
    Linux*)   OS="linux"   ;;
    CYGWIN*|MINGW*|MSYS*)
      err "Windows detected. This script requires macOS or Linux."
      err "On Windows, please use WSL2: https://learn.microsoft.com/windows/wsl/install"
      exit 1
      ;;
    *) OS="unknown" ;;
  esac
  ok "Detected OS: $OS"
}

# --------------------------------------------------------------------------- #
#  Prerequisite checks                                                         #
# --------------------------------------------------------------------------- #
check_prerequisites() {
  log ""
  log "${BOLD}1. Checking prerequisites${RESET}"

  # git
  if ! command -v git >/dev/null 2>&1; then
    err "git is required but not found."
    err "  macOS:  brew install git  or  xcode-select --install"
    err "  Linux:  apt-get install git  or  yum install git"
    exit 1
  fi
  ok "git $(git --version | awk '{print $3}')"

  # node
  if ! command -v node >/dev/null 2>&1; then
    err "Node.js is required but not found."
    err "  Install via: https://nodejs.org  or  https://github.com/nvm-sh/nvm"
    err "  Required: Node.js $REQUIRED_NODE_MAJOR.x"
    exit 1
  fi

  NODE_VERSION_FULL="$(node --version)"
  NODE_MAJOR="$(echo "$NODE_VERSION_FULL" | sed 's/v\([0-9]*\).*/\1/')"

  if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
    err "Node.js $REQUIRED_NODE_MAJOR.x required, found $NODE_VERSION_FULL."
    err "  Update via: https://github.com/nvm-sh/nvm"
    err "  Or:         nvm install $REQUIRED_NODE_MAJOR && nvm use $REQUIRED_NODE_MAJOR"
    exit 1
  fi
  ok "Node.js $NODE_VERSION_FULL"

  # npm
  if ! command -v npm >/dev/null 2>&1; then
    err "npm is required but not found (it ships with Node.js — something is wrong)."
    exit 1
  fi
  ok "npm $(npm --version)"
}

# --------------------------------------------------------------------------- #
#  .env.local setup                                                            #
# --------------------------------------------------------------------------- #
setup_env_file() {
  log ""
  log "${BOLD}2. Environment file${RESET}"

  if [ ! -f "$ENV_EXAMPLE" ]; then
    err ".env.example not found at $ENV_EXAMPLE. Is this the correct repo root?"
    exit 1
  fi

  if [ -f "$ENV_LOCAL" ]; then
    ok ".env.local already exists — skipping copy (no overwrite)"
  else
    cp "$ENV_EXAMPLE" "$ENV_LOCAL"
    ok ".env.local created from .env.example"
    info "Edit .env.local and fill in your credentials before running npm run dev"
  fi
}

# --------------------------------------------------------------------------- #
#  Interactive env wizard                                                      #
# --------------------------------------------------------------------------- #
prompt_var() {
  local key="$1"
  local label="$2"
  local required="$3"   # "yes" or "no"
  local example="$4"
  local link="$5"

  local current_val=""
  # read existing value from .env.local (if any)
  if [ -f "$ENV_LOCAL" ]; then
    current_val="$(grep -E "^${key}=" "$ENV_LOCAL" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')"
  fi

  # If already set (non-empty), skip
  if [ -n "$current_val" ]; then
    ok "$key already set — skipping"
    return
  fi

  printf "\n${BOLD}${CYAN}%s${RESET}\n" "$label"
  if [ -n "$link" ]; then
    printf "  Where to find it: ${YELLOW}%s${RESET}\n" "$link"
  fi
  if [ -n "$example" ]; then
    printf "  Example format:   %s\n" "$example"
  fi
  if [ "$required" = "yes" ]; then
    printf "  ${RED}[REQUIRED]${RESET} Press Enter to skip and fill in manually later.\n"
  else
    printf "  ${YELLOW}[OPTIONAL]${RESET} Press Enter to skip.\n"
  fi

  printf "  Value: "
  read -r input_val

  if [ -n "$input_val" ]; then
    # Escape any slashes in value for sed
    escaped_val="$(printf '%s' "$input_val" | sed 's|[&/\\]|\\&|g')"
    if grep -qE "^${key}=" "$ENV_LOCAL" 2>/dev/null; then
      # Replace existing line (use temp file for portability)
      sed "s|^${key}=.*|${key}=\"${escaped_val}\"|" "$ENV_LOCAL" > "${ENV_LOCAL}.tmp" && mv "${ENV_LOCAL}.tmp" "$ENV_LOCAL"
    else
      printf '\n%s="%s"\n' "$key" "$input_val" >> "$ENV_LOCAL"
    fi
    ok "$key saved"
  else
    warn "$key skipped — fill in $ENV_LOCAL manually before running the app"
  fi
}

run_env_wizard() {
  log ""
  log "${BOLD}3. Environment wizard${RESET}"
  info "I'll ask for the most important credentials. All others can be filled in .env.local later."
  info "Press Enter to skip any variable."

  # --- Supabase (REQUIRED for any DB operation) ---
  prompt_var \
    "NEXT_PUBLIC_SUPABASE_URL" \
    "Supabase project URL" \
    "yes" \
    "https://abcxyz.supabase.co" \
    "https://supabase.com/dashboard -> your project -> Settings -> API"

  prompt_var \
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    "Supabase anon (public) key" \
    "yes" \
    "eyJhbGc..." \
    "https://supabase.com/dashboard -> your project -> Settings -> API -> anon key"

  prompt_var \
    "SUPABASE_SERVICE_ROLE_KEY" \
    "Supabase service role key (server-side only, never expose client-side)" \
    "yes" \
    "eyJhbGc..." \
    "https://supabase.com/dashboard -> your project -> Settings -> API -> service_role key"

  # --- Anthropic (REQUIRED for AI replies) ---
  prompt_var \
    "ANTHROPIC_API_KEY" \
    "Anthropic API key" \
    "yes" \
    "sk-ant-api03-..." \
    "https://console.anthropic.com/settings/keys"

  # --- Upstash Redis (REQUIRED for rate limiting + queue) ---
  prompt_var \
    "UPSTASH_REDIS_REST_URL" \
    "Upstash Redis REST URL" \
    "yes" \
    "https://your-db.upstash.io" \
    "https://console.upstash.com -> your database -> REST API"

  prompt_var \
    "UPSTASH_REDIS_REST_TOKEN" \
    "Upstash Redis REST token" \
    "yes" \
    "AXxx..." \
    "https://console.upstash.com -> your database -> REST API -> token"

  # --- Internal secrets ---
  prompt_var \
    "INTERNAL_JOB_SECRET" \
    "Internal job secret (random string for cron job auth, min 32 chars)" \
    "yes" \
    "$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | head -c 40 || echo 'generate-a-random-string-here')" \
    ""

  prompt_var \
    "WHATSAPP_WEBHOOK_HEADER_SECRET" \
    "WhatsApp webhook header secret (random string, set same in 360dialog)" \
    "yes" \
    "$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | head -c 40 || echo 'generate-a-random-string-here')" \
    ""

  # --- WhatsApp (OPTIONAL for local dev without real messages) ---
  prompt_var \
    "WHATSAPP_API_KEY" \
    "360dialog WhatsApp API key (optional for local dev without real WA messages)" \
    "no" \
    "your-360dialog-api-key" \
    "https://hub.360dialog.com -> Developer -> API keys"

  # --- Stripe (OPTIONAL for billing in local dev) ---
  prompt_var \
    "STRIPE_SECRET_KEY" \
    "Stripe secret key (optional — use test key for local billing)" \
    "no" \
    "sk_test_..." \
    "https://dashboard.stripe.com/test/apikeys"

  # --- ElevenLabs (OPTIONAL for voice features) ---
  prompt_var \
    "ELEVENLABS_API_KEY" \
    "ElevenLabs API key (optional — required only for voice STT/TTS)" \
    "no" \
    "your-elevenlabs-key" \
    "https://elevenlabs.io/app/settings/api-keys"
}

# --------------------------------------------------------------------------- #
#  Supabase: local vs cloud                                                    #
# --------------------------------------------------------------------------- #
ask_supabase_mode() {
  log ""
  log "${BOLD}4. Supabase: local or cloud?${RESET}"
  printf "\n  Do you want to use:\n"
  printf "    ${CYAN}[1]${RESET} Supabase Cloud (recommended — you already have a project)\n"
  printf "    ${CYAN}[2]${RESET} Supabase local (Docker-based, for fully offline dev)\n"
  printf "    ${CYAN}[Enter]${RESET} Skip (configure later)\n"
  printf "\n  Choice [1/2]: "
  read -r sb_choice

  case "$sb_choice" in
    2)
      info "Local Supabase setup selected."
      if ! command -v docker >/dev/null 2>&1; then
        warn "Docker is not installed. Install it from https://docs.docker.com/get-docker/"
        warn "Then re-run: npx supabase init && npx supabase start"
      else
        info "Initialising local Supabase project..."
        if [ ! -f "$REPO_ROOT/supabase/config.toml" ]; then
          (cd "$REPO_ROOT" && npx supabase init) 2>&1 | tee -a "$LOG_FILE" || warn "supabase init failed — run manually: npx supabase init"
        else
          ok "supabase/config.toml already exists — skipping init"
        fi
        info "Starting local Supabase containers (this may take a minute on first run)..."
        (cd "$REPO_ROOT" && npx supabase start) 2>&1 | tee -a "$LOG_FILE" || {
          warn "supabase start failed — check Docker is running and re-run: npx supabase start"
        }
        info "Copy the local credentials printed above into .env.local"
      fi
      ;;
    1|"")
      ok "Using Supabase Cloud — credentials configured in wizard above"
      ;;
    *)
      warn "Unknown choice '$sb_choice' — skipping Supabase local setup"
      ;;
  esac
}

# --------------------------------------------------------------------------- #
#  Apply migrations                                                            #
# --------------------------------------------------------------------------- #
run_migrations() {
  log ""
  log "${BOLD}5. Database migrations${RESET}"

  # Check if SUPABASE_DB_URL or NEXT_PUBLIC_SUPABASE_URL is set
  local sb_url=""
  if [ -f "$ENV_LOCAL" ]; then
    sb_url="$(grep -E "^NEXT_PUBLIC_SUPABASE_URL=" "$ENV_LOCAL" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')"
  fi

  if [ -z "$sb_url" ]; then
    warn "NEXT_PUBLIC_SUPABASE_URL not set — skipping migrations"
    warn "Run manually after configuring .env.local: npx supabase db push"
    return
  fi

  printf "\n  Run ${CYAN}npx supabase db push${RESET} to apply migrations? [y/N]: "
  read -r do_migrate
  case "$do_migrate" in
    y|Y|yes|YES)
      info "Applying Supabase migrations..."
      (cd "$REPO_ROOT" && npx supabase db push) 2>&1 | tee -a "$LOG_FILE" || {
        warn "Migration failed. Check your Supabase credentials and re-run: npx supabase db push"
        warn "See setup.log for details."
      }
      ;;
    *)
      info "Skipping migrations — run manually: npx supabase db push"
      ;;
  esac
}

# --------------------------------------------------------------------------- #
#  npm install                                                                 #
# --------------------------------------------------------------------------- #
install_dependencies() {
  log ""
  log "${BOLD}6. Installing npm dependencies${RESET}"

  if [ -d "$REPO_ROOT/node_modules" ] && [ -f "$REPO_ROOT/node_modules/.package-lock.json" ]; then
    ok "node_modules already present — running npm ci to ensure sync"
  fi

  (cd "$REPO_ROOT" && npm ci) 2>&1 | tee -a "$LOG_FILE"
  local exit_code=$?

  if [ $exit_code -ne 0 ]; then
    err "npm ci failed (exit code $exit_code). See setup.log for details."
    err "Common fixes:"
    err "  - Delete node_modules and package-lock.json, then re-run setup.sh"
    err "  - Check Node.js version: node --version (need $REQUIRED_NODE_MAJOR.x)"
    exit 1
  fi
  ok "Dependencies installed"
}

# --------------------------------------------------------------------------- #
#  Optional: run tests                                                         #
# --------------------------------------------------------------------------- #
ask_run_tests() {
  log ""
  log "${BOLD}7. Run tests?${RESET}"
  printf "\n  Run ${CYAN}npm test${RESET} to verify the setup? [y/N]: "
  read -r do_test
  case "$do_test" in
    y|Y|yes|YES)
      info "Running tests..."
      (cd "$REPO_ROOT" && npm test) 2>&1 | tee -a "$LOG_FILE"
      local exit_code=$?
      if [ $exit_code -ne 0 ]; then
        warn "Some tests failed. This may be expected without full credentials."
        warn "Check setup.log for details."
      else
        ok "All tests passed"
      fi
      ;;
    *)
      info "Skipping tests — run manually: npm test"
      ;;
  esac
}

# --------------------------------------------------------------------------- #
#  Final summary                                                               #
# --------------------------------------------------------------------------- #
print_summary() {
  log ""
  log "======================================================================"
  printf "${GREEN}${BOLD}\n  Setup complete!\n${RESET}"
  log "======================================================================"
  printf "\n"
  printf "  ${BOLD}Next steps:${RESET}\n"
  printf "\n"
  printf "  1. ${CYAN}Edit .env.local${RESET} with any missing credentials\n"
  printf "     ${YELLOW}Required:${RESET} NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,\n"
  printf "              SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,\n"
  printf "              UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN\n"
  printf "\n"
  printf "  2. ${CYAN}Start the dev server:${RESET}\n"
  printf "       cd %s\n" "$REPO_ROOT"
  printf "       npm run dev\n"
  printf "\n"
  printf "  3. ${CYAN}Open the app:${RESET} http://localhost:3000\n"
  printf "\n"
  printf "  4. ${CYAN}Run quality gate:${RESET} npm run verify\n"
  printf "\n"
  printf "  5. Using Claude Code? ${BOLD}CLAUDE.md${RESET} has all the context:\n"
  printf "       claude\n"
  printf "\n"
  printf "  ${YELLOW}Log saved to:${RESET} setup.log\n"
  printf "\n"
  log "======================================================================"
  log "=== Setup completed at $(date) ==="
}

# --------------------------------------------------------------------------- #
#  Main                                                                        #
# --------------------------------------------------------------------------- #
main() {
  # Initialise log
  printf '=== Ambrogio.ai / whatsapp-receptionist setup ===\n' > "$LOG_FILE"
  printf 'Started: %s\n' "$(date)" >> "$LOG_FILE"
  printf 'Repo: %s\n\n' "$REPO_ROOT" >> "$LOG_FILE"

  print_banner
  detect_os
  check_prerequisites
  setup_env_file
  run_env_wizard
  ask_supabase_mode
  install_dependencies
  run_migrations
  ask_run_tests
  print_summary
}

main "$@"
